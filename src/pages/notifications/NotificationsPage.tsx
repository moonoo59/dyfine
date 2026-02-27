import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useNotifications } from '@/hooks/queries/useNotifications';
import { useQueryClient } from '@tanstack/react-query';

/**
 * 알림(Notifications) 페이지 컴포넌트 (Sprint 5)
 *
 * [PM 관점] Wireframe 3.11 요구사항:
 * - 알림 목록 (최신순)
 * - 읽음/미읽음 상태 표시
 * - 전체 읽음 처리 버튼
 * - 개별 읽음 클릭 시 처리
 */
export default function NotificationsPage() {
    const { householdId } = useAuthStore();
    const queryClient = useQueryClient();
    const { data: notifications, isLoading, unreadCount } = useNotifications();

    /** 개별 알림 읽음 처리 */
    const markAsRead = async (id: number) => {
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        queryClient.invalidateQueries({ queryKey: ['notifications', householdId] });
    };

    /** 전체 읽음 처리 */
    const markAllAsRead = async () => {
        if (!householdId) return;
        await supabase.from('notifications').update({ is_read: true }).eq('household_id', householdId).eq('is_read', false);
        queryClient.invalidateQueries({ queryKey: ['notifications', householdId] });
    };

    if (isLoading) return <div className="p-8 text-center text-zinc-500">알림을 불러오는 중...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">알림</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {unreadCount > 0 ? `${unreadCount}건의 미읽음 알림이 있습니다.` : '모든 알림을 확인했습니다.'}
                    </p>
                </div>
                {unreadCount > 0 && (
                    <button onClick={markAllAsRead}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-800">
                        전체 읽음
                    </button>
                )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
                {!notifications || notifications.length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">알림이 없습니다.</div>
                ) : (
                    <ul className="divide-y divide-gray-200 dark:divide-zinc-800">
                        {notifications.map(noti => (
                            <li
                                key={noti.id}
                                onClick={() => !noti.is_read && markAsRead(noti.id)}
                                className={`p-4 cursor-pointer transition-colors ${noti.is_read
                                        ? 'bg-white dark:bg-zinc-950'
                                        : 'bg-indigo-50/50 dark:bg-indigo-900/10'
                                    } hover:bg-gray-50 dark:hover:bg-zinc-900/50`}
                            >
                                <div className="flex items-start space-x-3">
                                    {/* 미읽음 표시 점 */}
                                    <div className="mt-1.5 flex-shrink-0">
                                        {!noti.is_read && <span className="block h-2 w-2 rounded-full bg-indigo-600" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <p className={`text-sm font-medium ${noti.is_read ? 'text-gray-700 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                                                {noti.title}
                                            </p>
                                            <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 ml-2">
                                                {new Date(noti.created_at).toLocaleDateString('ko-KR')}
                                            </span>
                                        </div>
                                        <p className={`text-sm mt-1 ${noti.is_read ? 'text-gray-500 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
                                            {noti.body}
                                        </p>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
