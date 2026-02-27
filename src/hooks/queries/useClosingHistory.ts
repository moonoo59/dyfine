import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';

/** 월 마감 레코드 인터페이스 */
export interface MonthClosing {
    id: number;
    household_id: string;
    year_month: string;
    closed_at: string;
    closed_by: string;
    summary_json: {
        year_month: string;
        total_income: number;
        total_expense: number;
        total_transfer: number;
        net_change: number;
        entry_count: number;
        locked_count: number;
        pending_transfers: number;
        closed_at: string;
    };
}

/**
 * 월 마감 이력을 React Query로 관리하는 커스텀 훅
 * - 가구의 전체 마감 이력을 조회
 * - year_month 내림차순 정렬 (최신 먼저)
 * - 5분 캐시 유지
 */
export function useClosingHistory() {
    const { householdId } = useAuthStore();

    return useQuery<MonthClosing[]>({
        queryKey: ['closings', householdId],
        queryFn: async () => {
            if (!householdId) throw new Error('No household ID');

            const { data, error } = await supabase
                .from('month_closings')
                .select('*')
                .eq('household_id', householdId)
                .order('year_month', { ascending: false });

            if (error) throw error;
            return (data as MonthClosing[]) || [];
        },
        enabled: !!householdId,
        staleTime: 1000 * 60 * 5, // 5분 캐시
    });
}
