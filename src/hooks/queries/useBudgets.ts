import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';

/** 예산 템플릿 라인 + 카테고리 정보 인터페이스 */
export interface BudgetTemplateLine {
    id: number;
    template_id: number;
    category_id: number;
    monthly_amount: number;
    category?: { id: number; name: string; parent_id: number | null };
    override_amount?: number; // 기간 설정으로 덮어써진 경우
    override_id?: number;
    start_year_month?: string;
    end_year_month?: string;
}

/** 예산 데이터 (템플릿 라인 + 당월 실적) */
export interface BudgetData {
    /** 예산 템플릿 라인 목록 */
    templates: BudgetTemplateLine[];
    /** 카테고리별 실적 (category_id → 지출 합계) */
    performances: Record<number, number>;
}

/**
 * 예산 데이터를 React Query로 관리하는 커스텀 훅
 * - 예산 템플릿 라인 + 선택 월의 카테고리별 지출 실적을 한 번에 조회
 * - year/month 파라미터에 따라 쿼리 키가 달라져 월별 캐시 분리
 */
export function useBudgets(year: number, month: number) {
    const { householdId } = useAuthStore();

    return useQuery<BudgetData>({
        queryKey: ['budgets', householdId, year, month],
        queryFn: async (): Promise<BudgetData> => {
            if (!householdId) throw new Error('No household ID');

            // 1. 기본 템플릿 라인 조회
            const { data: tplData, error: tplError } = await supabase
                .from('budget_template_lines')
                .select('*, category:categories(id, name, parent_id), template:budget_templates!inner(household_id)')
                .eq('template.household_id', householdId);

            if (tplError) throw tplError;

            // 1.5. 기간 오버라이드 데이터 조회 (선택한 연/월이 속하는 경우)
            const yearMonthStr = `${year}-${String(month).padStart(2, '0')}`;
            const { data: overrideData, error: overrideError } = await supabase
                .from('budget_term_overrides')
                .select('id, category_id, amount, start_year_month, end_year_month')
                .eq('household_id', householdId)
                .lte('start_year_month', yearMonthStr)
                .gte('end_year_month', yearMonthStr);

            if (overrideError) throw overrideError;

            // 카테고리별 오버라이드 매핑
            const overridesMap = new Map<number, any>();
            if (overrideData) {
                overrideData.forEach(o => overridesMap.set(o.category_id, o));
            }

            const templatesWithOverrides = (tplData as unknown as BudgetTemplateLine[]).map(tpl => {
                if (overridesMap.has(tpl.category_id)) {
                    const ovr = overridesMap.get(tpl.category_id);
                    return {
                        ...tpl,
                        monthly_amount: ovr.amount, // 현재 월의 유효 표시 한도
                        override_amount: ovr.amount,
                        override_id: ovr.id,
                        start_year_month: ovr.start_year_month,
                        end_year_month: ovr.end_year_month
                    };
                }
                return tpl;
            });

            // 2. 당월 지출 실적 집계
            const sm = String(month).padStart(2, '0');
            const lastDay = new Date(year, month, 0).getDate();
            const startOfMonth = `${year}-${sm}-01T00:00:00.000Z`;
            const endOfMonth = `${year}-${sm}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`;

            const { data: entryData, error: entryError } = await supabase
                .from('transaction_entries')
                .select('category_id, lines:transaction_lines(amount)')
                .eq('household_id', householdId)
                .eq('entry_type', 'expense')
                .gte('occurred_at', startOfMonth)
                .lte('occurred_at', endOfMonth);

            if (entryError) throw entryError;

            const performances: Record<number, number> = {};
            if (entryData) {
                entryData.forEach(entry => {
                    if (entry.category_id) {
                        const expenseAmount = entry.lines.reduce(
                            (sum: number, line: any) => sum + Math.abs(line.amount), 0
                        );
                        performances[entry.category_id] =
                            (performances[entry.category_id] || 0) + expenseAmount;
                    }
                });
            }

            return {
                templates: templatesWithOverrides || [],
                performances,
            };
        },
        enabled: !!householdId,
        staleTime: 1000 * 60 * 5,
    });
}

/** 예산(템플릿) 완전 삭제 Mutation */
export function useDeleteBudgetTemplate() {
    const queryClient = useQueryClient();
    const { householdId } = useAuthStore();

    return useMutation({
        mutationFn: async (templateLineId: number) => {
            const { error } = await supabase
                .from('budget_template_lines')
                .delete()
                .eq('id', templateLineId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['budgets', householdId] });
        }
    });
}

/** 특정 기간의 예산 오버라이드 삭제 Mutation */
export function useDeleteBudgetOverride() {
    const queryClient = useQueryClient();
    const { householdId } = useAuthStore();

    return useMutation({
        mutationFn: async (overrideId: number) => {
            const { error } = await supabase
                .from('budget_term_overrides')
                .delete()
                .eq('id', overrideId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['budgets', householdId] });
        }
    });
}
