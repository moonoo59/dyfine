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
