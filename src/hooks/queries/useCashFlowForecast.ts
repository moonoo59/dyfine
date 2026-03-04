import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';

/**
 * 가처분 소득(Free Route Space) 예측 인터페이스
 * - 최근 3개월 실적을 기반으로 이번 달 잉여 자금을 추정
 */
export interface CashFlowForecast {
    /** 최근 3개월 평균 수입 */
    avgMonthlyIncome: number;
    /** 최근 3개월 평균 지출 (대출 상환 제외) */
    avgMonthlyExpense: number;
    /** 활성 대출의 월 원리금 합산 (최소 약정 납부액) */
    totalLoanPayment: number;
    /** 각 대출별 월 납입금 상세 */
    loanPayments: { loanId: number; loanName: string; monthlyPayment: number }[];
    /** 가처분 소득 = 평균수입 - 평균지출 - 대출납입 */
    freeRouteSpace: number;
    /** 기반이 된 실적 월 개수 (최대 3) */
    basedOnMonths: number;
}

/**
 * [Backend] 가처분 소득 예측 커스텀 훅
 *
 * 로직:
 * 1. v_monthly_category_actual View에서 최근 3개월 수입/지출 합산
 * 2. 활성 대출의 원금/이자 일정으로 월 최소 납부액 계산
 * 3. FRS = 평균수입 - 평균지출 - 대출납입
 *
 * [PM 관점] 이 FRS가 "시뮬레이터 슬라이더의 최대치"가 됩니다.
 */
export function useCashFlowForecast() {
    const { householdId } = useAuthStore();

    return useQuery<CashFlowForecast>({
        queryKey: ['cashflow_forecast', householdId],
        queryFn: async (): Promise<CashFlowForecast> => {
            if (!householdId) throw new Error('No household ID');

            // === 1. 최근 3개월의 YYYY-MM 키 생성 ===
            const now = new Date();
            const recentMonths: string[] = [];
            for (let i = 1; i <= 3; i++) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                recentMonths.push(
                    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                );
            }

            // === 2. v_monthly_category_actual View에서 수입/지출 합산 ===
            const { data: monthlyData } = await supabase
                .from('v_monthly_category_actual')
                .select('year_month, entry_type, total_inflow, total_outflow')
                .eq('household_id', householdId)
                .in('year_month', recentMonths);

            // 월별 수입/지출 집계
            const monthlyIncome: Record<string, number> = {};
            const monthlyExpense: Record<string, number> = {};

            (monthlyData || []).forEach((row: any) => {
                if (row.entry_type === 'income') {
                    monthlyIncome[row.year_month] = (monthlyIncome[row.year_month] || 0) + Number(row.total_inflow);
                } else if (row.entry_type === 'expense') {
                    monthlyExpense[row.year_month] = (monthlyExpense[row.year_month] || 0) + Number(row.total_outflow);
                }
            });

            // 실제 데이터가 있는 월 수 기준으로 평균
            const incomeMonths = Object.keys(monthlyIncome);
            const expenseMonths = Object.keys(monthlyExpense);
            const basedOnMonths = Math.max(incomeMonths.length, expenseMonths.length, 1);

            const totalIncome = Object.values(monthlyIncome).reduce((s, v) => s + v, 0);
            const totalExpense = Object.values(monthlyExpense).reduce((s, v) => s + v, 0);
            const avgMonthlyIncome = Math.round(totalIncome / basedOnMonths);
            const avgMonthlyExpense = Math.round(totalExpense / basedOnMonths);

            // === 3. 활성 대출의 월 원리금 납입액 계산 ===
            const { data: loansData } = await supabase
                .from('loans')
                .select('id, name, principal_original, term_months, repayment_type')
                .eq('household_id', householdId)
                .eq('is_active', true);

            // 각 대출의 최신 금리 가져오기
            const loanPayments: { loanId: number; loanName: string; monthlyPayment: number }[] = [];
            let totalLoanPayment = 0;

            for (const loan of (loansData || [])) {
                // 최신 금리 조회
                const { data: rateData } = await supabase
                    .from('loan_rate_history')
                    .select('annual_rate')
                    .eq('loan_id', loan.id)
                    .order('effective_date', { ascending: false })
                    .limit(1);

                // 현재 잔액 조회 (최신 원장)
                const { data: ledgerData } = await supabase
                    .from('loan_ledger_entries')
                    .select('balance_after')
                    .eq('loan_id', loan.id)
                    .order('posting_date', { ascending: false })
                    .limit(1);

                const annualRate = rateData?.[0]?.annual_rate || 0.045;
                const currentBalance = ledgerData?.[0]?.balance_after || loan.principal_original;
                const monthlyRate = annualRate / 12;

                // 남은 개월 수 추정 (원장 건수 기반)
                const { count } = await supabase
                    .from('loan_ledger_entries')
                    .select('id', { count: 'exact', head: true })
                    .eq('loan_id', loan.id);

                const elapsedMonths = Math.max(0, (count || 1) - 1);
                const remainMonths = Math.max(1, loan.term_months - elapsedMonths);

                // 월 납입금 계산
                let monthlyPayment = 0;
                if (loan.repayment_type === 'annuity' && monthlyRate > 0) {
                    // 원리금 균등: PMT 공식
                    monthlyPayment = (currentBalance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -remainMonths));
                } else if (loan.repayment_type === 'equal_principal') {
                    // 원금 균등: 원금/남은월수 + 이자
                    monthlyPayment = (currentBalance / remainMonths) + (currentBalance * monthlyRate);
                } else {
                    // 이자만 (interest_only)
                    monthlyPayment = currentBalance * monthlyRate;
                }

                monthlyPayment = Math.round(monthlyPayment);
                loanPayments.push({ loanId: loan.id, loanName: loan.name, monthlyPayment });
                totalLoanPayment += monthlyPayment;
            }

            // === 4. 가처분 소득(FRS) 계산 ===
            const freeRouteSpace = Math.max(0, avgMonthlyIncome - avgMonthlyExpense - totalLoanPayment);

            return {
                avgMonthlyIncome,
                avgMonthlyExpense,
                totalLoanPayment,
                loanPayments,
                freeRouteSpace,
                basedOnMonths,
            };
        },
        enabled: !!householdId,
        staleTime: 1000 * 60 * 5, // 5분 캐시
    });
}
