-- migration: 0033_update_create_loan_rpc.sql
-- [PM] create_loan RPC에 created_by 파라미터 추가

CREATE OR REPLACE FUNCTION create_loan(
    p_household_id uuid,
    p_name text,
    p_principal numeric,
    p_start_date date,
    p_maturity_date date,
    p_term_months int,
    p_repayment_type text,
    p_interest_pay_day int,
    p_initial_rate numeric,
    p_linked_account_id bigint DEFAULT NULL,
    p_bank_name text DEFAULT NULL,
    p_repayment_priority int DEFAULT NULL,
    p_created_by uuid DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_loan_id bigint;
BEGIN
    -- 1. loans 레코드 INSERT
    INSERT INTO loans (
        household_id, name, principal_original, start_date, maturity_date,
        term_months, repayment_type, interest_pay_day, linked_payment_account_id,
        bank_name, repayment_priority, created_by
    ) VALUES (
        p_household_id, p_name, p_principal, p_start_date, p_maturity_date,
        p_term_months, p_repayment_type, p_interest_pay_day, p_linked_account_id,
        p_bank_name, p_repayment_priority, p_created_by
    ) RETURNING id INTO v_loan_id;

    -- 2. 초기 금리 이력 INSERT
    INSERT INTO loan_rate_history (loan_id, effective_date, annual_rate, created_by)
    VALUES (v_loan_id, p_start_date, p_initial_rate, p_created_by);

    -- 3. 초기 원장 (첫 행: 대출 실행)
    INSERT INTO loan_ledger_entries (
        loan_id, period_start, period_end, posting_date,
        interest_amount, principal_amount, balance_after, locked
    ) VALUES (
        v_loan_id, p_start_date, p_start_date, p_start_date,
        0, 0, p_principal, false
    );

    RETURN v_loan_id;
END;
$$;
