import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';

/** 자동이체 규칙 인터페이스 */
export interface AutoTransferRule {
    id: number;
    household_id: string;
    name: string;
    from_account_id: number;
    to_account_id: number;
    amount_expected: number;
    day_of_month: number;
    is_active: boolean;
    from_account?: { name: string };
    to_account?: { name: string };
}

/**
 * 자동이체 규칙 목록을 React Query로 관리하는 커스텀 훅
 * - 출금/입금 계좌명을 JOIN하여 조회
 * - 이체일(day_of_month) 기준 오름차순 정렬
 * - 5분 캐시 유지
 */
export function useTransferRules() {
    const { householdId } = useAuthStore();

    return useQuery<AutoTransferRule[]>({
        queryKey: ['transferRules', householdId],
        queryFn: async () => {
            if (!householdId) throw new Error('No household ID');

            const { data, error } = await supabase
                .from('auto_transfer_rules')
                .select('*, from_account:accounts!from_account_id(name), to_account:accounts!to_account_id(name)')
                .eq('household_id', householdId)
                .order('day_of_month');

            if (error) throw error;
            return (data as unknown as AutoTransferRule[]) || [];
        },
        enabled: !!householdId,
        staleTime: 1000 * 60 * 5, // 5분 캐시
    });
}
