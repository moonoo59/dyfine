import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'react-hot-toast';

/** 월 용돈 예산 인터페이스 */
export interface PersonalAllowance {
    id: number;
    household_id: string;
    member_name: string;
    year_month: string;
    budget_amount: number;
    memo: string | null;
    owner_user_id: string | null;
    created_at: string;
}

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
 * 내 용돈 예산 조회 훅
 * RLS가 owner_user_id = auth.uid() 로 필터링하므로 본인 데이터만 반환됨
 */
export function useMyAllowances() {
    const { householdId } = useAuthStore();

    return useQuery<PersonalAllowance[]>({
        queryKey: ['allowances', householdId],
        queryFn: async () => {
            if (!householdId) throw new Error('No household ID');

            // RLS가 자동으로 본인 데이터만 필터링
            const { data, error } = await supabase
                .from('personal_allowances')
                .select('*')
                .eq('household_id', householdId)
                .order('year_month', { ascending: false })
                .limit(12);

            if (error) throw error;
            return data as PersonalAllowance[];
        },
        enabled: !!householdId,
    });
}

/**
 * 월 용돈 예산 생성/수정 (upsert) 훅
 * owner_user_id를 자동으로 현재 사용자로 설정
 */
export function useUpsertAllowance() {
    const { user, householdId } = useAuthStore();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: {
            member_name: string;
            year_month: string;
            budget_amount: number;
            memo?: string;
        }) => {
            if (!householdId || !user) throw new Error('No household or user');

            const { error } = await supabase
                .from('personal_allowances')
                .upsert({
                    household_id: householdId,
                    member_name: params.member_name,
                    year_month: params.year_month,
                    budget_amount: params.budget_amount,
                    memo: params.memo || null,
                    owner_user_id: user.id,
                    created_by: user.id,
                }, { onConflict: 'household_id,member_name,year_month' });

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['allowances', householdId] });
            toast.success('용돈 예산이 저장되었습니다.');
        },
        onError: (error: any) => {
            toast.error('저장 실패: ' + (error.message || '알 수 없는 오류'));
        },
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
 * owner_user_id를 자동으로 현재 사용자로 설정
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
