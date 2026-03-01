-- =============================================================
-- Sprint 7: 대출 코어 — RLS 정책 + create_loan RPC
-- =============================================================

-- 1. 대출 관련 RLS 정책 추가 (0003에서 RLS enable만 했고 정책 미작성)
DROP POLICY IF EXISTS "Members can manage loans" ON loans;
CREATE POLICY "Members can manage loans"
    ON loans FOR ALL TO authenticated
    USING (is_household_member(household_id))
    WITH CHECK (is_household_member(household_id));

DROP POLICY IF EXISTS "Members can manage loan_rate_history" ON loan_rate_history;
CREATE POLICY "Members can manage loan_rate_history"
    ON loan_rate_history FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM loans WHERE loans.id = loan_rate_history.loan_id AND is_household_member(loans.household_id)))
    WITH CHECK (EXISTS (SELECT 1 FROM loans WHERE loans.id = loan_rate_history.loan_id AND is_household_member(loans.household_id)));

DROP POLICY IF EXISTS "Members can manage loan_ledger_entries" ON loan_ledger_entries;
CREATE POLICY "Members can manage loan_ledger_entries"
    ON loan_ledger_entries FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM loans WHERE loans.id = loan_ledger_entries.loan_id AND is_household_member(loans.household_id)))
    WITH CHECK (EXISTS (SELECT 1 FROM loans WHERE loans.id = loan_ledger_entries.loan_id AND is_household_member(loans.household_id)));

DROP POLICY IF EXISTS "Members can manage loan_events" ON loan_events;
CREATE POLICY "Members can manage loan_events"
    ON loan_events FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM loans WHERE loans.id = loan_events.loan_id AND is_household_member(loans.household_id)))
    WITH CHECK (EXISTS (SELECT 1 FROM loans WHERE loans.id = loan_events.loan_id AND is_household_member(loans.household_id)));

-- 2. create_loan RPC — 대출 생성 + 초기 금리 이력 + 원장 생성 (원자적)
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
    p_linked_account_id bigint DEFAULT NULL
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
        term_months, repayment_type, interest_pay_day, linked_payment_account_id
    ) VALUES (
        p_household_id, p_name, p_principal, p_start_date, p_maturity_date,
        p_term_months, p_repayment_type, p_interest_pay_day, p_linked_account_id
    ) RETURNING id INTO v_loan_id;

    -- 2. 초기 금리 이력 INSERT
    INSERT INTO loan_rate_history (loan_id, effective_date, annual_rate)
    VALUES (v_loan_id, p_start_date, p_initial_rate);

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
