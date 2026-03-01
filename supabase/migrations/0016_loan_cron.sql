-- =============================================================
-- Sprint 9: Phase 2 고도화/QA — Cron: 납입일 기준 대출 자동 원장 생성
-- =============================================================

-- 매일 실행되어 해당 납입일에 해당하는 활성 대출의 이번 달 원장(이자 계산 등)을 생성하는 RPC
CREATE OR REPLACE FUNCTION generate_monthly_loan_entries(p_target_date date DEFAULT CURRENT_DATE)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_loan record;
    v_last_ledger record;
    v_interest_amount numeric;
    v_days int;
    v_rate numeric;
    v_count integer := 0;
BEGIN
    FOR v_loan IN 
        SELECT id, household_id, principal_original, interest_pay_day, linked_payment_account_id
        FROM loans
        WHERE is_active = true 
          AND interest_pay_day = EXTRACT(DAY FROM p_target_date)
    LOOP
        -- 직전 원장 조회
        SELECT * INTO v_last_ledger
        FROM loan_ledger_entries
        WHERE loan_id = v_loan.id
        ORDER BY posting_date DESC, id DESC
        LIMIT 1;
        
        -- 현재 적용 금리 조회
        SELECT annual_rate INTO v_rate
        FROM loan_rate_history
        WHERE loan_id = v_loan.id AND effective_date <= p_target_date
        ORDER BY effective_date DESC
        LIMIT 1;
        
        IF v_last_ledger IS NOT NULL AND v_rate IS NOT NULL THEN
            IF p_target_date > v_last_ledger.posting_date THEN
                v_days := p_target_date - v_last_ledger.posting_date;
                -- 단순 이자 계산 (원금 * 이자율 * 일수 / 365)
                v_interest_amount := ROUND((v_last_ledger.balance_after * (v_rate / 100) * v_days) / 365, 0);
                
                INSERT INTO loan_ledger_entries (
                    loan_id, period_start, period_end, posting_date,
                    interest_amount, principal_amount, balance_after, locked
                ) VALUES (
                    v_loan.id, v_last_ledger.posting_date + 1, p_target_date, p_target_date,
                    v_interest_amount, 0, v_last_ledger.balance_after, false
                );
                v_count := v_count + 1;
            END IF;
        END IF;
    END LOOP;
    
    RETURN v_count;
END;
$$;
