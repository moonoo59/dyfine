import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';

export interface Security {
    id: number;
    household_id: string;
    ticker: string;
    name: string;
    currency: string;
    market: string;
}

export interface Holding {
    id: number;
    security_id: number;
    security: Security;
    account_id: number;
    quantity: number;
    avg_price: number;
    last_price: number;
    last_price_updated_at: string;
    updated_at: string;
}

/**
 * 보유 자산 목록 조회 훅
 */
export function useHoldings() {
    const { householdId } = useAuthStore();

    return useQuery<Holding[]>({
        queryKey: ['holdings', householdId],
        queryFn: async () => {
            if (!householdId) throw new Error('No household ID');
            const { data, error } = await supabase
                .from('holdings')
                .select('*, security:securities(*)')
                .eq('household_id', householdId)
                .neq('quantity', 0); // 수량이 0인 것은 제외
            if (error) throw error;
            return data as Holding[];
        },
        enabled: !!householdId,
    });
}

/**
 * 전 가구 종목 리스트 조회
 */
export function useSecurities() {
    const { householdId } = useAuthStore();

    return useQuery<Security[]>({
        queryKey: ['securities', householdId],
        queryFn: async () => {
            if (!householdId) throw new Error('No household ID');
            const { data, error } = await supabase
                .from('securities')
                .select('*')
                .eq('household_id', householdId);
            if (error) throw error;
            return data as Security[];
        },
        enabled: !!householdId,
    });
}

/**
 * 매매 기록 뮤테이션
 */
export function useRecordTrade() {
    const queryClient = useQueryClient();
    const { householdId } = useAuthStore();

    return useMutation({
        mutationFn: async (params: {
            accountId: number;
            ticker: string;
            name: string;
            market: string;
            tradeType: 'buy' | 'sell';
            quantity: number;
            price: number;
            fee?: number;
            occurredAt?: string;
            categoryId?: number;
        }) => {
            if (!householdId) throw new Error('No household ID');
            const { data, error } = await supabase.rpc('record_trade', {
                p_household_id: householdId,
                p_account_id: params.accountId,
                p_ticker: params.ticker,
                p_name: params.name,
                p_market: params.market,
                p_trade_type: params.tradeType,
                p_quantity: params.quantity,
                p_price: params.price,
                p_fee: params.fee || 0,
                p_occurred_at: params.occurredAt || new Date().toISOString(),
                p_category_id: params.categoryId || null,
            });
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['holdings', householdId] });
            queryClient.invalidateQueries({ queryKey: ['transactions', householdId] });
            queryClient.invalidateQueries({ queryKey: ['accounts', householdId] });
        },
    });
}
