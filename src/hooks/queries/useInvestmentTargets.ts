import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'react-hot-toast';

export interface InvestmentTarget {
    id: number;
    household_id: string;
    theme: string;
    target_weight: number;
    created_at: string;
    updated_at: string;
}

export function useInvestmentTargets() {
    const { householdId } = useAuthStore();

    return useQuery<InvestmentTarget[]>({
        queryKey: ['investment_targets', householdId],
        queryFn: async () => {
            if (!householdId) throw new Error('No household ID');
            const { data, error } = await supabase
                .from('investment_targets')
                .select('*')
                .eq('household_id', householdId)
                .order('target_weight', { ascending: false });

            if (error) throw error;
            return data as InvestmentTarget[];
        },
        enabled: !!householdId,
    });
}

export function useUpdateInvestmentTargets() {
    const queryClient = useQueryClient();
    const { householdId } = useAuthStore();

    return useMutation({
        mutationFn: async (targets: { theme: string; target_weight: number }[]) => {
            if (!householdId) throw new Error('No household ID');

            // Delete existing targets
            const { error: deleteError } = await supabase
                .from('investment_targets')
                .delete()
                .eq('household_id', householdId);

            if (deleteError) throw deleteError;

            // Insert new targets
            if (targets.length > 0) {
                const { error: insertError } = await supabase
                    .from('investment_targets')
                    .insert(
                        targets.map(t => ({
                            household_id: householdId,
                            theme: t.theme,
                            target_weight: t.target_weight
                        }))
                    );
                if (insertError) throw insertError;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['investment_targets', householdId] });
            toast.success('목표 비중이 저장되었습니다.');
        },
        onError: (error: any) => {
            console.error('Failed to update targets:', error);
            toast.error(error.message || '목표 비중 저장에 실패했습니다.');
        }
    });
}
