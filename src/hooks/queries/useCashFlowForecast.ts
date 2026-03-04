import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';

/**
 * 가처분 소득(Free Route Space) 예측 인터페이스
 *
 * [PM 관점] 모든 금액이 유기적으로 참조됩니다:
 * - 수입: 자동이체 규칙(schedule_type='monthly', 입금 방향)의 합산
 * - 고정지출: 자동이체 규칙(출금 방향)의 합산
 * - 변동지출: 예산 템플릿(budget_template_lines)의 월 한도 합산
 * - 대출납입: 활성 대출의 월 원리금 (일할이자 기반)
 * - FRS = 수입 - 고정지출 - 변동지출예산 - 대출납입
 */
export interface CashFlowForecast {
    /** 고정 수입 (자동이체 규칙 중 입금 항목 합산) */
    fixedIncome: number;
    /** 고정 지출 (자동이체 규칙 중 출금 항목 합산) */
    fixedExpense: number;
    /** 변동 지출 예산 한도 (budget_template_lines 합산) */
    budgetedExpense: number;
    /** 활성 대출의 월 원리금 합산 (일할이자 + 원금) */
    totalLoanPayment: number;
    /** 각 대출별 월 납입금 상세 */
    loanPayments: LoanPaymentDetail[];
    /** 가처분 소득 = 고정수입 - 고정지출 - 변동예산 - 대출납입 */
    freeRouteSpace: number;
    /** 데이터 출처 설명 */
    dataSource: string;
}

/** 각 대출의 월 납입 상세 */
export interface LoanPaymentDetail {
    loanId: number;
    loanName: string;
    repaymentType: string;
    /** 이번 달 이자 (일할계산 기반) */
    interestAmount: number;
    /** 이번 달 원금 상환분 */
    principalAmount: number;
    /** 합산 월 납입금 */
    monthlyPayment: number;
    /** 현재 잔액 */
    currentBalance: number;
    /** 연이율 */
    annualRate: number;
    /** 상환 우선순위 (워터폴용) */
    repaymentPriority: number | null;
    /** 남은 기간(개월) 계산용 */
    start_date: string;
    term_months: number;
    interest_pay_day: number;
    graduated_increase_rate: number;
}

/**
 * [Backend] 가처분 소득 예측 훅 (v2 — 예산/자동이체/대출 유기적 연동)
 *
 * [DB Architect 관점] 데이터 소스:
 * 1. auto_transfer_rules (is_active=true, schedule_type='monthly')
 *    → from_account_id만 있으면 '고정지출', to_account_id만 있으면 '고정수입', 둘 다 있으면 '이체'
 * 2. budget_template_lines (기본 템플릿의 카테고리별 월 한도)
 *    → 변동 지출 예산의 합계
 * 3. loans (is_active=true) + loan_rate_history + loan_ledger_entries
 *    → 일할이자(ACT/365) 기반 월 원리금 계산
 */
export function useCashFlowForecast() {
    const { householdId } = useAuthStore();

    return useQuery<CashFlowForecast>({
        queryKey: ['cashflow_forecast', householdId],
        queryFn: async (): Promise<CashFlowForecast> => {
            if (!householdId) throw new Error('No household ID');

            // =============================================
            // 1. 자동이체 규칙에서 고정 수입/지출 추출
            // =============================================
            const { data: rules } = await supabase
                .from('auto_transfer_rules')
                .select('from_account_id, to_account_id, amount_expected, category_id')
                .eq('household_id', householdId)
                .eq('is_active', true);

            let fixedIncome = 0;
            let fixedExpense = 0;

            (rules || []).forEach((rule: any) => {
                const amount = Number(rule.amount_expected || 0);
                if (rule.to_account_id && !rule.from_account_id) {
                    // 입금만 있는 경우 → 수입 (급여, 용돈 등)
                    fixedIncome += amount;
                } else if (rule.from_account_id && !rule.to_account_id) {
                    // 출금만 있는 경우 → 고정 지출 (관리비, 보험 등)
                    fixedExpense += amount;
                }
                // 둘 다 있으면 계좌 간 이체 → 현금흐름에 영향 없음
            });

            // =============================================
            // 2. 예산 템플릿에서 변동 지출 한도 추출
            // =============================================
            // 기본(is_default=true) 템플릿의 라인 합산
            const { data: defaultTemplate } = await supabase
                .from('budget_templates')
                .select('id')
                .eq('household_id', householdId)
                .eq('is_default', true)
                .limit(1)
                .single();

            let budgetedExpense = 0;
            if (defaultTemplate) {
                const { data: budgetLines } = await supabase
                    .from('budget_template_lines')
                    .select('monthly_amount')
                    .eq('template_id', defaultTemplate.id);

                budgetedExpense = (budgetLines || []).reduce(
                    (sum: number, line: any) => sum + Number(line.monthly_amount || 0), 0
                );
            }

            // =============================================
            // 3. 활성 대출의 월 원리금 계산 (일할이자 ACT/365)
            // =============================================
            const { data: loansData } = await supabase
                .from('loans')
                .select('id, name, principal_original, term_months, repayment_type, interest_pay_day, start_date, graduated_increase_rate, repayment_priority')
                .eq('household_id', householdId)
                .eq('is_active', true);

            const loanPayments: LoanPaymentDetail[] = [];
            let totalLoanPayment = 0;

            const today = new Date();
            const currentYear = today.getFullYear();
            const currentMonth = today.getMonth(); // 0-indexed

            for (const loan of (loansData || [])) {
                // 최신 금리
                const { data: rateData } = await supabase
                    .from('loan_rate_history')
                    .select('annual_rate')
                    .eq('loan_id', loan.id)
                    .order('effective_date', { ascending: false })
                    .limit(1);

                // 최신 원장(현재 잔액)
                const { data: ledgerData } = await supabase
                    .from('loan_ledger_entries')
                    .select('balance_after, posting_date')
                    .eq('loan_id', loan.id)
                    .order('posting_date', { ascending: false })
                    .limit(1);

                const annualRate = rateData?.[0]?.annual_rate || 0.045;
                const currentBalance = Number(ledgerData?.[0]?.balance_after || loan.principal_original);

                // === 일할이자 계산 (ACT/365) ===
                // 이번 달 이자 납입일 ~ 다음 달 이자 납입일 사이의 실제 일수
                const payDay = loan.interest_pay_day || 25;
                const periodStart = new Date(currentYear, currentMonth, payDay);
                const periodEnd = new Date(currentYear, currentMonth + 1, payDay);
                const actualDays = Math.round((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
                const dailyRate = annualRate / 365;
                const interestAmount = Math.round(currentBalance * dailyRate * actualDays);

                // === 상환 유형별 원금 계산 ===
                let principalAmount = 0;
                const loanStart = new Date(loan.start_date);
                const elapsedMonths = Math.max(0,
                    (currentYear - loanStart.getFullYear()) * 12 + currentMonth - loanStart.getMonth()
                );
                const remainMonths = Math.max(1, loan.term_months - elapsedMonths);

                switch (loan.repayment_type) {
                    case 'annuity': {
                        // 원리금균등: PMT 공식 (일할이자 보정)
                        const monthlyRate = annualRate / 12;
                        const pmt = monthlyRate > 0
                            ? (currentBalance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -remainMonths))
                            : currentBalance / remainMonths;
                        principalAmount = Math.round(pmt - interestAmount);
                        break;
                    }
                    case 'equal_principal': {
                        // 원금균등: 원금/남은개월수 (고정) + 이자(변동)
                        principalAmount = Math.round(currentBalance / remainMonths);
                        break;
                    }
                    case 'interest_only':
                    case 'bullet': {
                        // 이자만 / 만기일시상환: 원금 상환 0 (만기에 일괄)
                        principalAmount = 0;
                        break;
                    }
                    case 'graduated': {
                        // 체증식: 기본 원리금균등 기준으로 연차별 증가율 적용
                        const increaseRate = Number(loan.graduated_increase_rate || 0.10);
                        const elapsedYears = Math.floor(elapsedMonths / 12);
                        const monthlyRate = annualRate / 12;
                        // 기초 PMT (1년차 기준)
                        const basePmt = monthlyRate > 0
                            ? (currentBalance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -remainMonths))
                            : currentBalance / remainMonths;
                        // 연차별 증가 적용
                        const adjustedPmt = basePmt * Math.pow(1 + increaseRate, elapsedYears);
                        principalAmount = Math.round(adjustedPmt - interestAmount);
                        break;
                    }
                    default:
                        principalAmount = 0;
                }

                principalAmount = Math.max(0, principalAmount);
                const monthlyPayment = interestAmount + principalAmount;

                loanPayments.push({
                    loanId: loan.id,
                    loanName: loan.name,
                    repaymentType: loan.repayment_type,
                    interestAmount,
                    principalAmount,
                    monthlyPayment,
                    currentBalance,
                    annualRate,
                    repaymentPriority: loan.repayment_priority,
                    start_date: loan.start_date,
                    term_months: loan.term_months,
                    interest_pay_day: loan.interest_pay_day,
                    graduated_increase_rate: Number(loan.graduated_increase_rate || 0.10)
                });
                totalLoanPayment += monthlyPayment;
            }

            // =============================================
            // 4. 가처분 소득(FRS) 계산
            // =============================================
            const freeRouteSpace = Math.max(0, fixedIncome - fixedExpense - budgetedExpense - totalLoanPayment);

            const dataSource = `자동이체규칙(${(rules || []).length}건) + 예산템플릿 + 활성대출(${(loansData || []).length}건) 기반`;

            return {
                fixedIncome: Math.round(fixedIncome),
                fixedExpense: Math.round(fixedExpense),
                budgetedExpense: Math.round(budgetedExpense),
                totalLoanPayment: Math.round(totalLoanPayment),
                loanPayments,
                freeRouteSpace: Math.round(freeRouteSpace),
                dataSource,
            };
        },
        enabled: !!householdId,
        staleTime: 1000 * 60 * 5, // 5분 캐시
    });
}
