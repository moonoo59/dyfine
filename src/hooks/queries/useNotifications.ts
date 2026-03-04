import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';

/**
 * DB 스키마(0011)에 맞춘 알림 RAW 인터페이스
 * - type: 알림 종류 ('auto_transfer_missed', 'closing_reminder', 'budget_exceeded' 등)
 * - payload_json: 추가 데이터 (title, body 등을 포함)
 * - read_at: 읽음 시각 (NULL이면 미읽음)
 */
interface NotificationRaw {
    id: number;
    household_id: string;
    user_id: string;
    type: string;
    payload_json: { title?: string; body?: string;[key: string]: any } | null;
    created_at: string;
    read_at: string | null;
}

/** 프론트엔드 사용을 위한 변환된 알림 인터페이스 */
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
 * DB RAW 데이터를 프론트엔드 Notification으로 변환
 * - title/body: payload_json에서 추출, 없으면 type 기반 기본값 사용
 * - is_read: read_at이 null이 아니면 true
 */
function toNotification(raw: NotificationRaw): Notification {
    return {
        id: raw.id,
        household_id: raw.household_id,
        title: raw.payload_json?.title || raw.type || '알림',
        body: raw.payload_json?.body || '',
        type: raw.type,
        is_read: raw.read_at !== null,
        created_at: raw.created_at,
    };
}

/**
 * 알림 목록을 React Query로 관리하는 커스텀 훅
 * - notifications 테이블 조회 (최신순)
 * - DB 스키마(read_at)를 프론트 인터페이스(is_read)로 변환
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
            // DB RAW → 프론트엔드 Notification 변환
            return ((data as NotificationRaw[]) || []).map(toNotification);
        },
        enabled: !!householdId,
        staleTime: 1000 * 60 * 1, // 1분 캐시
    });

    // 미읽음 건수
    const unreadCount = (query.data || []).filter(n => !n.is_read).length;

    return { ...query, unreadCount };
}

