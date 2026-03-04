import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';

/** 대시보드 페이지에서 사용하는 요약 데이터 인터페이스 */
export interface DashboardData {
    /** 계좌별 실제 잔액 (opening_balance + 거래 합산) */
    accountBalances: { id: number; name: string; type: string; balance: number }[];
    /** 총 자산 (모든 활성 계좌 잔액 합산) */
    totalAssets: number;
    /** 현금성 잔액 (bank + virtual 계좌만) */
    cashBalance: number;
    /** 선택 기간 수입 합계 */
    periodIncome: number;
    /** 선택 기간 지출 합계 */
    periodExpense: number;
    /** 순증감 */
    netChange: number;
    /** 카테고리별 지출 데이터 (차트용) */
    expenseByCategory: { name: string; value: number }[];
    /** 카테고리별 수입 데이터 (Waterfall용) */
    incomeByCategory: { name: string; value: number }[];
    /** 최근 거래 내역 5건 */
    recentTransactions: any[];
    /** 미확인 자동이체 건수 */
    pendingTransferCount: number;
    /** 미확인 자동이체 총 금액 */
    pendingTransferAmount: number;
    /** 일별 잔액 추이 (Balance Chart용) */
    dailyBalances: { date: string; balance: number }[];
    /** 자금 흐름 데이터 (Sankey 대체 - 계좌 간 이체 흐름) */
    flowData: { from: string; to: string; amount: number }[];
    /** 총 투자 평가 금액 */
    investmentValue: number;
    /** 총 투자 수익(손실)액 */
    investmentProfit: number;
    /** 총 투자 수익률 */
    investmentProfitRate: number;
    /** 미납/예정 대출 건수 (이번 달) */
    pendingLoanCount: number;
}

/**
 * 대시보드 요약 데이터를 React Query로 관리하는 커스텀 훅 (Sprint 2 확장판)
 *
 * [Backend 관점] 개선사항:
 * - 기간 파라미터 지원 (startDate ~ endDate)
 * - 계좌별 실제 잔액 계산 (opening_balance + 거래 합산)
 * - 미확인 자동이체 건수/금액
 * - 일별 잔액 추이 데이터
 * - 자금 흐름(이체) 데이터
 *
 * @param startDate 시작일 (YYYY-MM-DD)
 * @param endDate   종료일 (YYYY-MM-DD)
 */
export function useDashboardData(startDate: string, endDate: string) {
    const { householdId } = useAuthStore();

    return useQuery<DashboardData>({
        queryKey: ['dashboard', householdId, startDate, endDate],
        queryFn: async (): Promise<DashboardData> => {
            if (!householdId) throw new Error('No household ID');

            // === 1. 계좌별 잔액 (v_account_balance_actual View 활용) ===
            const { data: balanceData } = await supabase
                .from('v_account_balance_actual')
                .select('account_id, account_name, account_type, current_balance')
                .eq('household_id', householdId);

            const accountBalances = (balanceData || []).map((acc: any) => ({
                id: acc.account_id,
                name: acc.account_name,
                type: acc.account_type,
                balance: Number(acc.current_balance || 0),
            }));

            const totalAssets = accountBalances.reduce((s, a) => s + a.balance, 0);
            const cashBalance = accountBalances
                .filter(a => ['bank', 'virtual', 'checking'].includes(a.type))
                .reduce((s, a) => s + a.balance, 0);

            // === 2 & 3. 기간 내 수입/지출 합산 + 카테고리별 (v_monthly_category_actual View 활용) ===
            // 현재 달의 실적만 가져오면 되지만, View는 YYYY-MM 기준입니다.
            // Dashboard 기간 파라미터가 월 단위일 가능성이 높으므로 View의 year_month 로 조회합니다.
            const startYearMonth = startDate.substring(0, 7); // 예: '2026-03'

            const { data: categoryData } = await supabase
                .from('v_monthly_category_actual')
                .select('entry_type, category_name, total_inflow, total_outflow')
                .eq('household_id', householdId)
                .eq('year_month', startYearMonth);

            let periodIncome = 0;
            let periodExpense = 0;
            const incCatMap: Record<string, number> = {};
            const expCatMap: Record<string, number> = {};

            categoryData?.forEach((row: any) => {
                const catName = row.category_name || (row.entry_type === 'income' ? '기타 수입' : '미분류');
                if (row.entry_type === 'income') {
                    const amt = Number(row.total_inflow);
                    periodIncome += amt;
                    incCatMap[catName] = (incCatMap[catName] || 0) + amt;
                } else if (row.entry_type === 'expense') {
                    const amt = Number(row.total_outflow);
                    periodExpense += amt;
                    expCatMap[catName] = (expCatMap[catName] || 0) + amt;
                }
            });

            const incomeByCategory = Object.keys(incCatMap)
                .map(k => ({ name: k, value: incCatMap[k] }))
                .sort((a, b) => b.value - a.value);

            const expenseByCategory = Object.keys(expCatMap)
                .map(k => ({ name: k, value: expCatMap[k] }))
                .sort((a, b) => b.value - a.value);

            // === 4. 이체 흐름 (Sankey 대체용) ===
            const { data: transferEntries } = await supabase
                .from('transaction_entries')
                .select('lines:transaction_lines(account_id, amount)')
                .eq('household_id', householdId)
                .eq('entry_type', 'transfer')
                .gte('occurred_at', startDate)
                .lte('occurred_at', endDate + 'T23:59:59');

            // 계좌 ID → 이름 매핑
            const accNameMap: Record<number, string> = {};
            accountBalances.forEach(a => { accNameMap[a.id] = a.name; });

            const flowMap: Record<string, number> = {};
            transferEntries?.forEach(entry => {
                const fromLine = entry.lines.find((l: any) => l.amount < 0);
                const toLine = entry.lines.find((l: any) => l.amount > 0);
                if (fromLine && toLine) {
                    const fromName = accNameMap[fromLine.account_id] || '알수없음';
                    const toName = accNameMap[toLine.account_id] || '알수없음';
                    const key = `${fromName}→${toName}`;
                    flowMap[key] = (flowMap[key] || 0) + Math.abs(Number(fromLine.amount));
                }
            });

            const flowData = Object.entries(flowMap).map(([key, amount]) => {
                const [from, to] = key.split('→');
                return { from, to, amount };
            }).sort((a, b) => b.amount - a.amount);

            // === 5. 미확인 자동이체 ===
            const { data: pendingData } = await supabase
                .from('auto_transfer_instances')
                .select('expected_amount')
                .eq('household_id', householdId)
                .eq('status', 'pending');

            const pendingTransferCount = pendingData?.length || 0;
            const pendingTransferAmount = pendingData?.reduce(
                (s, p) => s + Number(p.expected_amount), 0
            ) || 0;

            // === 6. 최근 거래 5건 ===
            const { data: recentTrx } = await supabase
                .from('transaction_entries')
                .select('id, occurred_at, entry_type, memo, category:categories(name), lines:transaction_lines(amount)')
                .eq('household_id', householdId)
                .order('occurred_at', { ascending: false })
                .limit(5);

            // === 7. 일별 잔액 추이 (단순화: 기간 내 일별 거래 누적) ===
            const { data: dailyTxns } = await supabase
                .from('transaction_entries')
                .select('occurred_at, lines:transaction_lines(amount)')
                .eq('household_id', householdId)
                .gte('occurred_at', startDate)
                .lte('occurred_at', endDate + 'T23:59:59')
                .order('occurred_at', { ascending: true });

            // 기간 시작 전 총 잔액 계산 (opening_balance + 기간 전 거래)
            const { data: priorLines } = await supabase
                .from('transaction_lines')
                .select('amount, entry:transaction_entries!inner(household_id, occurred_at)')
                .eq('entry.household_id', householdId)
                .lt('entry.occurred_at', startDate);

            let priorBalance = accountBalances.reduce((s: number, a: { balance: number }) => s + a.balance, 0);
            priorLines?.forEach(l => { priorBalance += Number(l.amount); });

            // 일별 변동 집계
            const dailyChangeMap: Record<string, number> = {};
            dailyTxns?.forEach(entry => {
                const dateStr = entry.occurred_at.split('T')[0];
                const change = entry.lines.reduce((s: number, l: any) => s + Number(l.amount), 0);
                dailyChangeMap[dateStr] = (dailyChangeMap[dateStr] || 0) + change;
            });

            // 누적 잔액 계산
            const dailyBalances: { date: string; balance: number }[] = [];
            let runningBalance = priorBalance;
            const start = new Date(startDate);
            const end = new Date(endDate);
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const ds = d.toISOString().split('T')[0];
                runningBalance += (dailyChangeMap[ds] || 0);
                dailyBalances.push({ date: ds, balance: runningBalance });
            }

            // === 8. 투자 자산 평가액 및 수익률 ===
            const { data: holdingsData } = await supabase
                .from('holdings')
                .select('quantity, avg_price, last_price')
                .eq('household_id', householdId)
                .gt('quantity', 0);

            let investmentInvested = 0;
            let investmentValue = 0;

            holdingsData?.forEach(h => {
                investmentInvested += (h.quantity * h.avg_price);
                investmentValue += (h.quantity * h.last_price);
            });

            const investmentProfit = investmentValue - investmentInvested;
            const investmentProfitRate = investmentInvested > 0 ? (investmentProfit / investmentInvested) * 100 : 0;

            // === 9. 이번 달 대출 납입 예정 (간단하게 활성 대출 건수로 표시) ===
            // 향후 custom_schedule 또는 ledger_entries와 연동 가능. 현재는 활성 대출 수첩 수
            const { data: loansData } = await supabase
                .from('loans')
                .select('id, principal_original, interest_pay_day')
                .eq('household_id', householdId)
                .eq('is_active', true);

            const pendingLoanCount = loansData?.length || 0;

            return {
                accountBalances,
                totalAssets,
                cashBalance,
                periodIncome,
                periodExpense,
                netChange: periodIncome - periodExpense,
                expenseByCategory,
                incomeByCategory,
                recentTransactions: recentTrx || [],
                pendingTransferCount,
                pendingTransferAmount,
                dailyBalances,
                flowData,
                investmentValue,
                investmentProfit,
                investmentProfitRate,
                pendingLoanCount,
            };
        },
        enabled: !!householdId,
        staleTime: 1000 * 60 * 2, // 2분 캐시
    });
}
