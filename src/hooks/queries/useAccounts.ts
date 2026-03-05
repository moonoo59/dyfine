import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';

/**
 * 계좌 목록 조회 훅
 *
 * [Backend] 개선: v_account_balance_actual 뷰 조인 실패 시에도
 * 계좌 목록이 정상 표시되도록 안전한 방식으로 변경.
 * - 1단계: accounts 테이블에서 기본 정보 조회
 * - 2단계: v_account_balance_actual 뷰에서 잔액 조회 (실패해도 무시)
 * - 3단계: 매핑하여 반환
 */
export function useAccounts() {
    const { householdId } = useAuthStore();

    return useQuery({
        queryKey: ['accounts', householdId],
        queryFn: async () => {
            if (!householdId) throw new Error('No household ID');

            // 1단계: accounts 테이블에서 기본 정보 직접 조회 (이것만으로도 목록 표시 가능)
            const { data: accounts, error: accountsError } = await supabase
                .from('accounts')
                .select('id, household_id, group_id, name, bank_name, account_number, holder_name, account_type, currency, opening_balance, is_active')
                .eq('household_id', householdId)
                .order('name', { ascending: true });

            if (accountsError) throw accountsError;
            if (!accounts) return [];

            // 2단계: 뷰에서 실제 잔액 조회 (실패해도 계좌 목록은 정상 표시)
            let balanceMap: Record<number, number> = {};
            try {
                const { data: balances } = await supabase
                    .from('v_account_balance_actual')
                    .select('account_id, current_balance')
                    .eq('household_id', householdId);

                if (balances) {
                    balanceMap = Object.fromEntries(
                        balances.map((b: any) => [b.account_id, b.current_balance])
                    );
                }
            } catch {
                // 뷰 조회 실패 시 opening_balance로 대체 (계좌 목록은 정상 표시)
                console.warn('v_account_balance_actual 뷰 조회 실패, opening_balance로 대체');
            }

            // 3단계: 잔액 매핑
            return accounts.map((acc: any) => ({
                ...acc,
                opening_balance: balanceMap[acc.id] ?? acc.opening_balance ?? 0,
            }));
        },
        enabled: !!householdId,
        staleTime: 1000 * 60 * 1,
    });
}
