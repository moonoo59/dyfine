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

            // === 1. 계좌별 잔액 (opening_balance + 전체 거래 합산) ===
            const { data: accData } = await supabase
                .from('accounts')
                .select('id, name, account_type, opening_balance')
                .eq('household_id', householdId)
                .eq('is_active', true);

            // 각 계좌의 거래 합산 조회
            const { data: lineData } = await supabase
                .from('transaction_lines')
                .select('account_id, amount, entry:transaction_entries!inner(household_id)')
                .eq('entry.household_id', householdId);

            // 계좌별 거래 합산 맵
            const txnSumByAccount: Record<number, number> = {};
            lineData?.forEach(line => {
                txnSumByAccount[line.account_id] = (txnSumByAccount[line.account_id] || 0) + Number(line.amount);
            });

            // 계좌별 실제 잔액
            const accountBalances = (accData || []).map(acc => ({
                id: acc.id,
                name: acc.name,
                type: acc.account_type,
                balance: acc.opening_balance + (txnSumByAccount[acc.id] || 0),
            }));

            const totalAssets = accountBalances.reduce((s, a) => s + a.balance, 0);
            const cashBalance = accountBalances
                .filter(a => a.type === 'bank' || a.type === 'virtual')
                .reduce((s, a) => s + a.balance, 0);

            // === 2. 기간 내 수입 합산 ===
            const { data: incomeEntries } = await supabase
                .from('transaction_entries')
                .select('category_id, category:categories(name), lines:transaction_lines(amount)')
                .eq('household_id', householdId)
                .eq('entry_type', 'income')
                .gte('occurred_at', startDate)
                .lte('occurred_at', endDate + 'T23:59:59');

            let periodIncome = 0;
            const incCatMap: Record<string, number> = {};
            incomeEntries?.forEach(entry => {
                const amt = entry.lines.reduce(
                    (s: number, l: any) => s + (l.amount > 0 ? Number(l.amount) : 0), 0
                );
                periodIncome += amt;
                const catName = (entry.category as any)?.name || '기타 수입';
                incCatMap[catName] = (incCatMap[catName] || 0) + amt;
            });

            const incomeByCategory = Object.keys(incCatMap)
                .map(k => ({ name: k, value: incCatMap[k] }))
                .sort((a, b) => b.value - a.value);

            // === 3. 기간 내 지출 합산 + 카테고리별 ===
            const { data: expEntries } = await supabase
                .from('transaction_entries')
                .select('category_id, category:categories(name), lines:transaction_lines(amount)')
                .eq('household_id', householdId)
                .eq('entry_type', 'expense')
                .gte('occurred_at', startDate)
                .lte('occurred_at', endDate + 'T23:59:59');

            let periodExpense = 0;
            const expCatMap: Record<string, number> = {};
            expEntries?.forEach(entry => {
                const amt = entry.lines.reduce(
                    (s: number, l: any) => s + Math.abs(l.amount < 0 ? Number(l.amount) : 0), 0
                );
                periodExpense += amt;
                const catName = (entry.category as any)?.name || '미분류';
                expCatMap[catName] = (expCatMap[catName] || 0) + amt;
            });

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
            (accData || []).forEach(a => { accNameMap[a.id] = a.name; });

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

            let priorBalance = (accData || []).reduce((s, a) => s + a.opening_balance, 0);
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
            };
        },
        enabled: !!householdId,
        staleTime: 1000 * 60 * 2, // 2분 캐시
    });
}
