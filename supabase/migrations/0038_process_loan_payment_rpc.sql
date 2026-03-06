-- 0038_process_loan_payment_rpc.sql
-- 대출 당월 상환 처리 RPC 추가

CREATE OR REPLACE FUNCTION process_loan_payment(
    p_household_id uuid,
    p_loan_id bigint,
    p_period_start date,
    p_period_end date,
    p_posting_date date,
    p_interest_amount numeric,
    p_principal_amount numeric,
    p_account_id bigint,     -- 출금할 계좌 ID (nullable)
    p_category_id bigint,    -- 지출 카테고리 ID (대출 이자/원금 상환 등)
    p_user_id uuid
) RETURNS bigint AS $$
DECLARE
    v_last_balance numeric;
    v_new_balance numeric;
    v_entry_id bigint;
    v_total_amount numeric;
BEGIN
    -- 1. 현재 대출 잔액 확인 (가장 최근 원장 기록 기준)
    SELECT balance_after INTO v_last_balance
    FROM loan_ledger_entries
    WHERE loan_id = p_loan_id
    ORDER BY period_end DESC, id DESC
    LIMIT 1;

    IF v_last_balance IS NULL THEN
        RAISE EXCEPTION '대출 잔액을 찾을 수 없습니다.';
    END IF;

    -- 2. 새 잔액 계산
    v_new_balance := v_last_balance - p_principal_amount;

    IF v_new_balance < 0 THEN
        v_new_balance := 0;
    END IF;

    -- 3. loan_ledger_entries 기록 추가
    INSERT INTO loan_ledger_entries (
        loan_id, period_start, period_end, posting_date,
        interest_amount, principal_amount, balance_after, locked
    ) VALUES (
        p_loan_id, p_period_start, p_period_end, p_posting_date,
        p_interest_amount, p_principal_amount, v_new_balance, true
    ) RETURNING id INTO v_entry_id;

    -- 4. transaction_entries 및 transaction_lines 추가
    v_total_amount := p_interest_amount + p_principal_amount;

    -- 출금 계좌가 지정되어 있고, 상환 금액이 0보다 큰 경우에만 복식부기 전표 생성
    IF v_total_amount > 0 AND p_account_id IS NOT NULL THEN
        PERFORM create_transaction(
            p_household_id,
            p_posting_date::timestamptz,
            'expense'::text,
            p_category_id,
            '대출 당월 상환 (원금: ' || p_principal_amount || ', 이자: ' || p_interest_amount || ')'::text,
            'loan_payment'::text,
            p_user_id,
            jsonb_build_array(
                jsonb_build_object('account_id', p_account_id, 'amount', -v_total_amount)
            )
        );
    END IF;

    RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
