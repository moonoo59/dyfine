import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';

/** 대출 인터페이스 */
export interface Loan {
    id: number;
    household_id: string;
    name: string;
    principal_original: number;
    start_date: string;
    maturity_date: string;
    term_months: number;
    repayment_type: string;
    interest_pay_day: number;
    linked_payment_account_id: number | null;
    is_active: boolean;
}

/** 금리 이력 인터페이스 */
export interface LoanRateHistory {
    id: number;
    loan_id: number;
    effective_date: string;
    annual_rate: number;
}

/** 대출 원장 인터페이스 */
export interface LoanLedgerEntry {
    id: number;
    loan_id: number;
    period_start: string;
    period_end: string;
    posting_date: string;
    interest_amount: number;
    principal_amount: number;
    fee_amount: number;
    balance_after: number;
    locked: boolean;
}

/**
 * 대출 목록 조회 훅
 */
export function useLoans() {
    const { householdId } = useAuthStore();

    return useQuery<Loan[]>({
        queryKey: ['loans', householdId],
        queryFn: async () => {
            if (!householdId) throw new Error('No household ID');
            const { data, error } = await supabase
                .from('loans')
                .select('*')
                .eq('household_id', householdId)
                .order('start_date', { ascending: false });
            if (error) throw error;
            return data as Loan[];
        },
        enabled: !!householdId,
        staleTime: 1000 * 60 * 5,
    });
}

/**
 * 대출 금리 이력 조회 훅
 */
export function useLoanRates(loanId: number | null) {
    return useQuery<LoanRateHistory[]>({
        queryKey: ['loan_rates', loanId],
        queryFn: async () => {
            if (!loanId) throw new Error('No loan ID');
            const { data, error } = await supabase
                .from('loan_rate_history')
                .select('*')
                .eq('loan_id', loanId)
                .order('effective_date', { ascending: true });
            if (error) throw error;
            return data as LoanRateHistory[];
        },
        enabled: !!loanId,
        staleTime: 1000 * 60 * 5,
    });
}

/**
 * 대출 원장(상환 스케줄) 조회 훅
 */
export function useLoanLedger(loanId: number | null) {
    return useQuery<LoanLedgerEntry[]>({
        queryKey: ['loan_ledger', loanId],
        queryFn: async () => {
            if (!loanId) throw new Error('No loan ID');
            const { data, error } = await supabase
                .from('loan_ledger_entries')
                .select('*')
                .eq('loan_id', loanId)
                .order('posting_date', { ascending: true });
            if (error) throw error;
            return data as LoanLedgerEntry[];
        },
        enabled: !!loanId,
        staleTime: 1000 * 60 * 5,
    });
}
