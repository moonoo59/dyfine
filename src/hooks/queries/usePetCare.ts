import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'react-hot-toast';

export interface PetCareLog {
    id: number;
    household_id: string;
    check_in: string;
    check_out: string | null;
    memo: string | null;
    fee: number;
    created_at: string;
}

/**
 * 훈트가르텐 이용 기록 조회 훅
 */
export function usePetCareLogs() {
    const { householdId } = useAuthStore();

    return useQuery<PetCareLog[]>({
        queryKey: ['petcareLogs', householdId],
        queryFn: async () => {
            if (!householdId) throw new Error('No household ID');

            const { data, error } = await supabase
                .from('petcare_logs')
                .select('*')
                .eq('household_id', householdId)
                .order('check_in', { ascending: false });

            if (error) throw error;
            return data as PetCareLog[];
        },
        enabled: !!householdId,
    });
}

/**
 * 훈트가르텐 이용 기록 추가/수정 훅
 */
export function useUpsertPetCareLog() {
    const { householdId } = useAuthStore();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (log: Omit<PetCareLog, 'id' | 'household_id' | 'created_at'> & { id?: number }) => {
            if (!householdId) throw new Error('No household ID');

            const payload: any = {
                household_id: householdId,
                check_in: log.check_in,
                check_out: log.check_out,
                memo: log.memo,
                fee: log.fee,
            };

            if (log.id) {
                const { error } = await supabase
                    .from('petcare_logs')
                    .update(payload)
                    .eq('id', log.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('petcare_logs')
                    .insert([payload]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['petcareLogs', householdId] });
            toast.success('이용 기록이 저장되었습니다.');
        },
        onError: (error: any) => {
            console.error('Failed to save petcare log:', error);
            toast.error(error.message || '이용 기록 저장에 실패했습니다.');
        }
    });
}

/**
 * 훈트가르텐 이용 기록 삭제 훅
 */
export function useDeletePetCareLog() {
    const { householdId } = useAuthStore();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: number) => {
            if (!householdId) throw new Error('No household ID');

            const { error } = await supabase
                .from('petcare_logs')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['petcareLogs', householdId] });
            toast.success('이용 기록이 삭제되었습니다.');
        },
        onError: (error: any) => {
            console.error('Failed to delete petcare log:', error);
            toast.error(error.message || '이용 기록 삭제에 실패했습니다.');
        }
    });
}
