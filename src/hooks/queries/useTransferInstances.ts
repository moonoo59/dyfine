import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';

/** 자동이체 인스턴스 인터페이스 (pending 상태 대기 항목) */
export interface AutoTransferInstance {
    id: number;
    rule_id: number;
    due_date: string;
    expected_amount: number;
    status: 'pending' | 'confirmed' | 'missed' | 'skipped';
    confirmed_at: string | null;
    generated_entry_id: number | null;
    rule?: {
        name: string;
        amount_expected: number;
        day_of_month: number;
        from_account_id: number;
        to_account_id: number;
    };
}

/**
 * 대기 중(pending) 자동이체 인스턴스를 React Query로 관리하는 커스텀 훅
 * - 규칙 정보(이름, 금액, 출금/입금 계좌 ID)를 JOIN하여 조회
 * - due_date 기준 오름차순 정렬
 * - 1분 캐시 유지 (실시간성 중요)
 */
export function useTransferInstances() {
    const { householdId } = useAuthStore();

    return useQuery<AutoTransferInstance[]>({
        queryKey: ['transferInstances', householdId],
        queryFn: async () => {
            if (!householdId) throw new Error('No household ID');

            const { data, error } = await supabase
                .from('auto_transfer_instances')
                .select('*, rule:auto_transfer_rules(name, amount_expected, day_of_month, from_account_id, to_account_id)')
                .eq('household_id', householdId)
                .eq('status', 'pending')
                .order('due_date', { ascending: true });

            if (error) throw error;
            return (data as unknown as AutoTransferInstance[]) || [];
        },
        enabled: !!householdId,
        staleTime: 1000 * 60 * 1, // 1분 캐시 (실시간성 중요)
    });
}
