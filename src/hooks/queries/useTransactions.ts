import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import type { TransactionEntry } from '@/pages/transactions/TransactionsPage';

/**
 * 거래 필터 인터페이스 (FilterBar와 호환)
 */
export interface TransactionFilters {
    startDate?: string;
    endDate?: string;
    accountId?: number;
    categoryId?: number;
    keyword?: string;
    entryType?: string;
    source?: string;
}

/**
 * 거래 내역을 React Query로 관리하는 커스텀 훅 (Sprint 3)
 *
 * [Backend 관점] 개선사항:
 * - 필터 파라미터 지원 (기간/계좌/카테고리/키워드/유형/소스)
 * - 페이지네이션 지원 (limit/offset)
 * - 필터별 캐시 키 분리
 *
 * @param filters 필터 조건
 * @param limit   조회 건수 (기본 50)
 */
export function useTransactions(filters: TransactionFilters = {}, limit = 50) {
    const { householdId } = useAuthStore();

    return useQuery<TransactionEntry[]>({
        queryKey: ['transactions', householdId, filters, limit],
        queryFn: async () => {
            if (!householdId) throw new Error('No household ID');

            // 기본 쿼리 빌더
            let query = supabase
                .from('transaction_entries')
                .select(`
                    *,
                    category:categories(id, name),
                    lines:transaction_lines(
                        id, amount, line_memo,
                        account:accounts(name)
                    )
                `)
                .eq('household_id', householdId)
                .order('occurred_at', { ascending: false })
                .limit(limit);

            // 기간 필터
            if (filters.startDate) {
                query = query.gte('occurred_at', filters.startDate);
            }
            if (filters.endDate) {
                query = query.lte('occurred_at', filters.endDate + 'T23:59:59');
            }

            // 카테고리 필터
            if (filters.categoryId) {
                query = query.eq('category_id', filters.categoryId);
            }

            // 거래 유형 필터
            if (filters.entryType) {
                query = query.eq('entry_type', filters.entryType);
            }

            // 소스 필터
            if (filters.source) {
                query = query.eq('source', filters.source);
            }

            // 키워드 필터 (메모 검색)
            if (filters.keyword) {
                query = query.ilike('memo', `%${filters.keyword}%`);
            }

            const { data, error } = await query;
            if (error) throw error;

            let result = data as unknown as TransactionEntry[];

            // 계좌 필터 (transaction_lines 기반 — 쿼리 후 클라이언트 필터)
            if (filters.accountId) {
                result = result.filter(entry =>
                    entry.lines.some(line => line.account_id === filters.accountId)
                );
            }

            return result;
        },
        enabled: !!householdId,
        staleTime: 1000 * 60 * 1, // 1분 캐시
    });
}
