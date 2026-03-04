import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';

export function useAccounts() {
    const { householdId } = useAuthStore();

    return useQuery({
        queryKey: ['accounts', householdId],
        queryFn: async () => {
            if (!householdId) throw new Error('No household ID');

            // account 정보와 함께 실제 현재 잔액(current_balance)을 가져오기 위해 View 사용
            // View에 없는 계좌 고유 정보들(은행명 등)을 위해 accounts 테이블과 JOIN
            const { data, error } = await supabase
                .from('accounts')
                .select(`
                    id, household_id, group_id, name, bank_name, account_number, holder_name, account_type, currency, is_active,
                    v_account_balance_actual (current_balance)
                `)
                .eq('household_id', householdId)
                .order('name', { ascending: true });

            if (error) throw error;

            // 데이터 형태 매핑 (accounts의 필드들 + view의 current_balance)
            return (data || []).map((acc: any) => ({
                ...acc,
                // opening_balance 필드에 실제 잔액(current_balance)을 매핑하여 프론트에서 재사용하도록 함
                opening_balance: Array.isArray(acc.v_account_balance_actual)
                    ? acc.v_account_balance_actual[0]?.current_balance || acc.opening_balance || 0
                    : acc.v_account_balance_actual?.current_balance || acc.opening_balance || 0
            }));
        },
        enabled: !!householdId, // householdId가 있을 때만 실행
        staleTime: 1000 * 60 * 1, // 잔액 변동이 잦으므로 1분으로 단축
    });
}
