import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';

/** 즐겨찾기 템플릿 인터페이스 */
export interface FavoriteTemplate {
    id: number;
    household_id: string;
    name: string;
    entry_type: 'income' | 'expense' | 'transfer';
    from_account_id: number | null;
    to_account_id: number | null;
    category_id: number | null;
    amount: number | null;
    memo: string | null;
    sort_order: number;
}

/**
 * 즐겨찾기 거래 템플릿을 React Query로 관리하는 커스텀 훅
 * - DB 테이블 기반 (멀티 디바이스 동기화)
 * - 5분 캐시 유지
 */
export function useFavorites() {
    const { householdId } = useAuthStore();

    return useQuery<FavoriteTemplate[]>({
        queryKey: ['favorites', householdId],
        queryFn: async () => {
            if (!householdId) throw new Error('No household ID');

            const { data, error } = await supabase
                .from('favorite_templates')
                .select('*')
                .eq('household_id', householdId)
                .order('sort_order', { ascending: true });

            if (error) throw error;
            return (data as FavoriteTemplate[]) || [];
        },
        enabled: !!householdId,
        staleTime: 1000 * 60 * 5, // 5분 캐시
    });
}

/**
 * 즐겨찾기 추가/삭제 뮤테이션 헬퍼 함수들
 */
export function useFavoriteActions() {
    const { householdId } = useAuthStore();
    const queryClient = useQueryClient();

    /** 즐겨찾기 추가 */
    const addFavorite = async (template: Omit<FavoriteTemplate, 'id' | 'household_id' | 'sort_order'>) => {
        if (!householdId) return;
        const { error } = await supabase
            .from('favorite_templates')
            .insert([{ ...template, household_id: householdId }]);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['favorites', householdId] });
    };

    /** 즐겨찾기 삭제 */
    const removeFavorite = async (id: number) => {
        const { error } = await supabase
            .from('favorite_templates')
            .delete()
            .eq('id', id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['favorites', householdId] });
    };

    return { addFavorite, removeFavorite };
}
