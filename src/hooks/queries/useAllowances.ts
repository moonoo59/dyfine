import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'react-hot-toast';

/** 개인 고정지출 항목 인터페이스 */
export interface FixedExpense {
    id: number;
    household_id: string;
    member_name: string;
    label: string;
    amount: number;
    category: string;
    is_active: boolean;
    sort_order: number;
    owner_user_id: string | null;
    created_at: string;
}

/**
 * 거래 내역에서 용돈 예산 자동 조회 훅
 *
 * [PM] 거래 내역의 카테고리명에 구성원 이름이 포함된 '용돈' 거래를 합산
 * 예: "덕원 용돈" 카테고리 → 덕원의 해당 월 용돈 예산으로 자동 반영
 *
 * @param memberName 구성원 이름 (profiles.display_name)
 * @param yearMonth  조회 월 ('2026-03')
 */
export function useAllowanceBudgetFromTransactions(memberName: string, yearMonth: string) {
    const { householdId } = useAuthStore();

    return useQuery<{ total: number; transactions: any[] }>({
        queryKey: ['allowanceBudget', householdId, memberName, yearMonth],
        queryFn: async () => {
            if (!householdId || !memberName) throw new Error('Missing params');

            // 해당 월의 시작일/종료일 계산
            const startDate = `${yearMonth}-01`;
            const [y, m] = yearMonth.split('-').map(Number);
            const endDate = new Date(y, m, 0).toISOString().slice(0, 10); // 말일

            // 카테고리명에 "용돈"이 포함되고, 구성원 이름도 포함된 거래를 조회
            // 예: "덕원 용돈", "여선 용돈"
            const { data, error } = await supabase
                .from('transaction_entries')
                .select(`
                    id, occurred_at, amount, description, entry_type,
                    category:categories(id, name)
                `)
                .eq('household_id', householdId)
                .gte('occurred_at', startDate)
                .lte('occurred_at', endDate + 'T23:59:59')
                .not('category_id', 'is', null);

            if (error) throw error;

            // 카테고리명에 구성원 이름 + "용돈"이 포함된 거래만 필터링
            const allowanceTxns = (data || []).filter((tx: any) => {
                const catName = tx.category?.name || '';
                return catName.includes('용돈') && catName.includes(memberName);
            });

            // 금액 합산 (입금/이체 등 양수 금액 합)
            const total = allowanceTxns.reduce((sum: number, tx: any) => {
                // amount가 양수이면 용돈 수령, 음수이면 용돈 지급
                return sum + Math.abs(tx.amount || 0);
            }, 0);

            return { total, transactions: allowanceTxns };
        },
        enabled: !!householdId && !!memberName && !!yearMonth,
    });
}

/**
 * 내 고정지출 목록 조회 훅
 * RLS가 자동으로 본인 데이터만 필터링
 */
export function useMyFixedExpenses() {
    const { householdId } = useAuthStore();

    return useQuery<FixedExpense[]>({
        queryKey: ['fixedExpenses', householdId],
        queryFn: async () => {
            if (!householdId) throw new Error('No household ID');

            const { data, error } = await supabase
                .from('allowance_fixed_expenses')
                .select('*')
                .eq('household_id', householdId)
                .order('sort_order', { ascending: true });

            if (error) throw error;
            return data as FixedExpense[];
        },
        enabled: !!householdId,
    });
}

/**
 * 고정지출 추가/수정 훅
 */
export function useUpsertFixedExpense() {
    const { user, householdId } = useAuthStore();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: {
            id?: number;
            member_name: string;
            label: string;
            amount: number;
            category?: string;
            is_active?: boolean;
            sort_order?: number;
        }) => {
            if (!householdId || !user) throw new Error('No household or user');

            const payload = {
                household_id: householdId,
                member_name: params.member_name,
                label: params.label,
                amount: params.amount,
                category: params.category || '기타',
                is_active: params.is_active ?? true,
                sort_order: params.sort_order ?? 0,
                owner_user_id: user.id,
                created_by: user.id,
            };

            if (params.id) {
                const { error } = await supabase
                    .from('allowance_fixed_expenses')
                    .update(payload)
                    .eq('id', params.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('allowance_fixed_expenses')
                    .insert([payload]);
                if (error) throw error;
            }
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['fixedExpenses', householdId] });
            toast.success(variables.id ? '고정지출이 수정되었습니다.' : '고정지출이 추가되었습니다.');
        },
        onError: (error: any) => {
            toast.error('저장 실패: ' + (error.message || '알 수 없는 오류'));
        },
    });
}

/**
 * 고정지출 삭제 훅
 */
export function useDeleteFixedExpense() {
    const { householdId } = useAuthStore();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: { id: number }) => {
            if (!householdId) throw new Error('No household ID');

            const { error } = await supabase
                .from('allowance_fixed_expenses')
                .delete()
                .eq('id', params.id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fixedExpenses', householdId] });
            toast.success('고정지출이 삭제되었습니다.');
        },
        onError: (error: any) => {
            toast.error('삭제 실패: ' + (error.message || '알 수 없는 오류'));
        },
    });
}

/**
 * 개인 용돈 통계 조회 훅
 * 최근 N개월간의 해당 멤버 용돈 예산(지급액) 트렌드와 현재 고정지출을 비교
 */
export function useAllowanceStats(memberName: string, monthsCount: number = 6) {
    const { householdId } = useAuthStore();

    return useQuery<{
        stats: { yearMonth: string, budget: number, fixedExpense: number, remaining: number }[],
        monthlyAverages: { budget: number, remaining: number },
        fixedTotal: number
    }>({
        queryKey: ['allowanceStats', householdId, memberName, monthsCount],
        queryFn: async () => {
            if (!householdId || !memberName) throw new Error('Missing params');

            // 1. 활성 고정 지출 총합 조회 (현재 기준)
            const { data: fixedData, error: fixedErr } = await supabase
                .from('allowance_fixed_expenses')
                .select('amount')
                .eq('household_id', householdId)
                .eq('is_active', true);
            if (fixedErr) throw fixedErr;
            const fixedTotal = (fixedData || []).reduce((sum, item) => sum + Number(item.amount), 0);

            // 2. N개월 범위 설정
            const now = new Date();
            const months: string[] = [];
            for (let i = monthsCount - 1; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
            }

            const startDate = new Date(now.getFullYear(), now.getMonth() - monthsCount + 1, 1).toISOString().split('T')[0];
            const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

            // 3. 거래 내역 조회
            const { data, error } = await supabase
                .from('transaction_entries')
                .select(`occurred_at, amount, category:categories(id, name)`)
                .eq('household_id', householdId)
                .gte('occurred_at', startDate)
                .lte('occurred_at', endDate)
                .not('category_id', 'is', null);

            if (error) throw error;

            // 구성원 이름과 '용돈'이 포함된 카테고리 거래만 추출
            const allowanceTxns = (data || []).filter((tx: any) => {
                const catName = tx.category?.name || '';
                return catName.includes('용돈') && catName.includes(memberName);
            });

            // 4. 월별로 집계
            const budgetByMonth: Record<string, number> = {};
            months.forEach(m => budgetByMonth[m] = 0);

            allowanceTxns.forEach((tx: any) => {
                const tDate = new Date(tx.occurred_at);
                const ym = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, '0')}`;
                if (budgetByMonth[ym] !== undefined) {
                    budgetByMonth[ym] += Math.abs(tx.amount || 0);
                }
            });

            // 5. 최종 데이터 매핑
            const stats = months.map(ym => {
                const budget = budgetByMonth[ym];
                return {
                    yearMonth: ym.substring(2), // 26-03 포맷으로 단축
                    budget,
                    fixedExpense: fixedTotal, // 편의상 모든 과거 월에 현재 고정지출 일괄 적용
                    remaining: budget - fixedTotal,
                };
            });

            const avgBudget = stats.reduce((sum, s) => sum + s.budget, 0) / monthsCount;
            const avgRemaining = stats.reduce((sum, s) => sum + s.remaining, 0) / monthsCount;

            return {
                stats,
                monthlyAverages: { budget: avgBudget, remaining: avgRemaining },
                fixedTotal
            };
        },
        enabled: !!householdId && !!memberName,
    });
}
