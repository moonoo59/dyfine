import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';

export function useCategories() {
    const { householdId } = useAuthStore();

    return useQuery({
        queryKey: ['categories', householdId],
        queryFn: async () => {
            if (!householdId) throw new Error('No household ID');

            const { data, error } = await supabase
                .from('categories')
                .select('id, name, parent_id')
                .eq('household_id', householdId);

            if (error) throw error;
            return data;
        },
        enabled: !!householdId,
        staleTime: 1000 * 60 * 30, // 카테고리는 잘 안 바뀌므로 30분 캐시
    });
}
