import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';

export function useAccounts() {
    const { householdId } = useAuthStore();

    return useQuery({
        queryKey: ['accounts', householdId],
        queryFn: async () => {
            if (!householdId) throw new Error('No household ID');

            const { data, error } = await supabase
                .from('accounts')
                .select('*')
                .eq('household_id', householdId)
                .order('name', { ascending: true });

            if (error) throw error;
            return data;
        },
        enabled: !!householdId, // householdId가 있을 때만 실행
        staleTime: 1000 * 60 * 5, // 5분 동안 캐시 유지
    });
}
