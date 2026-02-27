import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';

/** 대시보드 페이지에서 사용하는 요약 데이터 인터페이스 */
export interface DashboardData {
    /** 초기 잔액 기준 총 자산 */
    totalAssets: number;
    /** 선택 월 수입 합계 */
    monthlyIncome: number;
    /** 선택 월 지출 합계 */
    monthlyExpense: number;
    /** 카테고리별 지출 데이터 (차트용) */
    expenseByCategory: { name: string; value: number }[];
    /** 최근 거래 내역 5건 */
    recentTransactions: any[];
}

/**
 * 대시보드 요약 데이터를 React Query로 관리하는 커스텀 훅
 * - 총 자산, 당월 수입/지출, 카테고리별 지출 비율, 최근 거래 5건 반환
 * - householdId가 존재할 때만 실행 (enabled 옵션)
 * - 2분 캐시 유지 (staleTime)
 */
export function useDashboardData() {
    const { householdId } = useAuthStore();

    return useQuery<DashboardData>({
        queryKey: ['dashboard', householdId],
        queryFn: async (): Promise<DashboardData> => {
            if (!householdId) throw new Error('No household ID');

            // 1. 총 자산 (모든 활성 계좌의 opening_balance 합산)
            const { data: accData } = await supabase
                .from('accounts')
                .select('opening_balance')
                .eq('household_id', householdId)
                .eq('is_active', true);

            const totalAssets = accData?.reduce(
                (sum, acc) => sum + acc.opening_balance, 0
            ) || 0;

            // 2. 당월 시작일 계산
            const now = new Date();
            const startOfMonth = new Date(
                now.getFullYear(), now.getMonth(), 1
            ).toISOString();

            // 3. 당월 수입 합산
            const { data: incomeData } = await supabase
                .from('transaction_entries')
                .select('lines:transaction_lines(amount)')
                .eq('household_id', householdId)
                .eq('entry_type', 'income')
                .gte('occurred_at', startOfMonth);

            let monthlyIncome = 0;
            incomeData?.forEach(entry => {
                monthlyIncome += entry.lines.reduce(
                    (s: number, l: any) => s + (l.amount > 0 ? l.amount : 0), 0
                );
            });

            // 4. 당월 지출 합산 + 카테고리별 분류
            const { data: expData } = await supabase
                .from('transaction_entries')
                .select('category_id, category:categories(name), lines:transaction_lines(amount)')
                .eq('household_id', householdId)
                .eq('entry_type', 'expense')
                .gte('occurred_at', startOfMonth);

            let monthlyExpense = 0;
            const catExpMap: Record<string, number> = {};

            expData?.forEach(entry => {
                const amount = entry.lines.reduce(
                    (s: number, l: any) => s + Math.abs(l.amount < 0 ? l.amount : 0), 0
                );
                monthlyExpense += amount;

                const catName = (entry.category as any)?.name || '미분류';
                catExpMap[catName] = (catExpMap[catName] || 0) + amount;
            });

            // 차트 데이터 포맷팅 (내림차순 정렬)
            const expenseByCategory = Object.keys(catExpMap)
                .map(key => ({ name: key, value: catExpMap[key] }))
                .sort((a, b) => b.value - a.value);

            // 5. 최근 거래 내역 5건
            const { data: recentTrx } = await supabase
                .from('transaction_entries')
                .select('id, occurred_at, entry_type, memo, category:categories(name), lines:transaction_lines(amount)')
                .eq('household_id', householdId)
                .order('occurred_at', { ascending: false })
                .limit(5);

            return {
                totalAssets,
                monthlyIncome,
                monthlyExpense,
                expenseByCategory,
                recentTransactions: recentTrx || [],
            };
        },
        enabled: !!householdId,
        staleTime: 1000 * 60 * 2, // 2분 동안 캐시 유지
    });
}
