import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';

/** 예산 템플릿 라인 + 카테고리 정보 인터페이스 */
export interface BudgetTemplateLine {
    id: number;
    template_id: number;
    category_id: number;
    monthly_amount: number;
    category?: { id: number; name: string; parent_id: number | null };
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
 * - 5분 캐시 유지
 *
 * @param year  조회 연도 (예: 2026)
 * @param month 조회 월 (1~12)
 */
export function useBudgets(year: number, month: number) {
    const { householdId } = useAuthStore();

    return useQuery<BudgetData>({
        queryKey: ['budgets', householdId, year, month],
        queryFn: async (): Promise<BudgetData> => {
            if (!householdId) throw new Error('No household ID');

            // 1. 예산 템플릿 라인 조회 (카테고리 정보 JOIN)
            const { data: tplData, error: tplError } = await supabase
                .from('budget_template_lines')
                .select('*, category:categories(id, name, parent_id), template:budget_templates!inner(household_id)')
                .eq('template.household_id', householdId);

            if (tplError) throw tplError;

            // 2. 선택 월의 지출 실적 집계
            const startOfMonth = new Date(year, month - 1, 1).toISOString();
            const endOfMonth = new Date(year, month, 0, 23, 59, 59).toISOString();

            const { data: entryData, error: entryError } = await supabase
                .from('transaction_entries')
                .select('category_id, lines:transaction_lines(amount)')
                .eq('household_id', householdId)
                .eq('entry_type', 'expense')
                .gte('occurred_at', startOfMonth)
                .lte('occurred_at', endOfMonth);

            if (entryError) throw entryError;

            // 카테고리별 지출 합산
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
                templates: (tplData as unknown as BudgetTemplateLine[]) || [],
                performances,
            };
        },
        enabled: !!householdId,
        staleTime: 1000 * 60 * 5, // 5분 캐시
    });
}
