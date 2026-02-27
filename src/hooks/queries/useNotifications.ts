import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';

/** 알림 인터페이스 */
export interface Notification {
    id: number;
    household_id: string;
    title: string;
    body: string;
    type: string;
    is_read: boolean;
    created_at: string;
}

/**
 * 알림 목록을 React Query로 관리하는 커스텀 훅
 * - notifications 테이블 조회 (최신순)
 * - 미읽음 건수 별도 계산
 */
export function useNotifications() {
    const { householdId } = useAuthStore();

    const query = useQuery<Notification[]>({
        queryKey: ['notifications', householdId],
        queryFn: async () => {
            if (!householdId) throw new Error('No household ID');
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('household_id', householdId)
                .order('created_at', { ascending: false })
                .limit(50);
            if (error) throw error;
            return (data as Notification[]) || [];
        },
        enabled: !!householdId,
        staleTime: 1000 * 60 * 1, // 1분 캐시
    });

    // 미읽음 건수
    const unreadCount = (query.data || []).filter(n => !n.is_read).length;

    return { ...query, unreadCount };
}
