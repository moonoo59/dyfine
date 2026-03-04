-- 0027_security_and_validations.sql
-- 서버 로직 유효성 검증, RLS 보강 및 Audit 로깅 적용

-- ==============================================================
-- 1. [SEC] import_profiles 테이블 RLS 적용 (B-3)
-- ==============================================================
ALTER TABLE import_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can manage import_profiles" ON import_profiles;
CREATE POLICY "Members can manage import_profiles"
    ON import_profiles FOR ALL TO authenticated
    USING (is_household_member(household_id))
    WITH CHECK (is_household_member(household_id));

-- ==============================================================
-- 2. [BUG] create_transaction RPC 합계 0 검증 추가 (A-2-2)
--    transfer 전표인 경우 라인 데이터의 amount 합계가 0인지 서버측 검증
-- ==============================================================
CREATE OR REPLACE FUNCTION create_transaction (
  p_household_id uuid,
  p_occurred_at timestamptz,
  p_entry_type text,
  p_category_id bigint,
  p_memo text,
  p_source text,
  p_created_by uuid,
  p_lines jsonb
) RETURNS bigint AS $$
DECLARE
  v_entry_id bigint;
  v_line jsonb;
  v_sum numeric := 0;
BEGIN
  -- 라인 합계 검증
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_sum := v_sum + (v_line->>'amount')::numeric;
  END LOOP;

  IF p_entry_type = 'transfer' AND v_sum != 0 THEN
      RAISE EXCEPTION '이체(transfer) 전표는 대차 합계가 0이어야 합니다. (합계: %)', v_sum;
  END IF;

  -- 1. 트랜잭션 Entry 생성
  INSERT INTO transaction_entries (
    household_id, occurred_at, entry_type, category_id, memo, source, created_by
  ) VALUES (
    p_household_id, p_occurred_at, p_entry_type, p_category_id, p_memo, p_source, p_created_by
  ) RETURNING id INTO v_entry_id;

  -- 2. 전달받은 JSON 배열(Lines)을 순회하며 라인 생성
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    INSERT INTO transaction_lines (
      entry_id, account_id, amount
    ) VALUES (
      v_entry_id,
      (v_line->>'account_id')::bigint,
      (v_line->>'amount')::numeric
    );
  END LOOP;

  -- 3. 성공 시 생성된 entry_id 반환
  RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION create_transaction_with_tags (
  p_household_id uuid,
  p_occurred_at timestamptz,
  p_entry_type text,
  p_category_id bigint,
  p_memo text,
  p_source text,
  p_created_by uuid,
  p_lines jsonb,
  p_tags text[] DEFAULT '{}' -- 새로 추가된 태그 리스트 배열
) RETURNS bigint AS $$
DECLARE
  v_entry_id bigint;
  v_line jsonb;
  v_tag_name text;
  v_tag_id bigint;
  v_sum numeric := 0;
BEGIN
  -- 라인 합계 검증
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_sum := v_sum + (v_line->>'amount')::numeric;
  END LOOP;

  IF p_entry_type = 'transfer' AND v_sum != 0 THEN
      RAISE EXCEPTION '이체(transfer) 전표는 대차 합계가 0이어야 합니다. (합계: %)', v_sum;
  END IF;

  -- 1. 트랜잭션 Entry 생성
  INSERT INTO transaction_entries (
    household_id, occurred_at, entry_type, category_id, memo, source, created_by
  ) VALUES (
    p_household_id, p_occurred_at, p_entry_type, p_category_id, p_memo, p_source, p_created_by
  ) RETURNING id INTO v_entry_id;

  -- 2. 전달받은 JSON 배열(Lines)을 순회하며 라인 생성
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    INSERT INTO transaction_lines (
      entry_id, account_id, amount
    ) VALUES (
      v_entry_id,
      (v_line->>'account_id')::bigint,
      (v_line->>'amount')::numeric
    );
  END LOOP;

  -- 3. 새로 넘어온 태그 리스트(p_tags) 처리
  IF array_length(p_tags, 1) > 0 THEN
    FOREACH v_tag_name IN ARRAY p_tags
    LOOP
      v_tag_name := trim(v_tag_name);
      IF v_tag_name != '' THEN
        SELECT id INTO v_tag_id FROM tags WHERE household_id = p_household_id AND name = v_tag_name;
        IF v_tag_id IS NULL THEN
          INSERT INTO tags (household_id, name) VALUES (p_household_id, v_tag_name) RETURNING id INTO v_tag_id;
        END IF;
        INSERT INTO entry_tags (entry_id, tag_id) VALUES (v_entry_id, v_tag_id) ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================
-- 3. [SEC] audit_logs 로깅 & [FEAT] update create_loan RPC (B-5)
-- ==============================================================

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
    p_repayment_priority int DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_loan_id bigint;
BEGIN
    INSERT INTO loans (
        household_id, name, principal_original, start_date, maturity_date,
        term_months, repayment_type, interest_pay_day, linked_payment_account_id,
        bank_name, repayment_priority
    ) VALUES (
        p_household_id, p_name, p_principal, p_start_date, p_maturity_date,
        p_term_months, p_repayment_type, p_interest_pay_day, p_linked_account_id,
        p_bank_name, p_repayment_priority
    ) RETURNING id INTO v_loan_id;

    INSERT INTO loan_rate_history (loan_id, effective_date, annual_rate)
    VALUES (v_loan_id, p_start_date, p_initial_rate);

    INSERT INTO loan_ledger_entries (
        loan_id, period_start, period_end, posting_date,
        interest_amount, principal_amount, balance_after, locked
    ) VALUES (
        v_loan_id, p_start_date, p_start_date, p_start_date,
        0, 0, p_principal, false
    );

    -- [SEC] Audit 로그 추가
    INSERT INTO audit_logs (household_id, user_id, action, payload_json)
    VALUES (p_household_id, auth.uid(), 'create_loan', jsonb_build_object(
        'loan_id', v_loan_id,
        'name', p_name,
        'principal', p_principal,
        'bank_name', p_bank_name
    ));

    RETURN v_loan_id;
END;
$$;


CREATE OR REPLACE FUNCTION close_month(
    p_year_month CHAR(7),      -- 마감 대상 월 (예: '2026-02')
    p_user_id UUID              -- 마감 실행 사용자 ID
)
RETURNS JSONB                   -- 마감 요약 결과 반환
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_household_id UUID;
    v_already_closed BOOLEAN;
    v_start_date TIMESTAMPTZ;
    v_end_date TIMESTAMPTZ;
    v_total_income NUMERIC(18,2) := 0;
    v_total_expense NUMERIC(18,2) := 0;
    v_total_transfer NUMERIC(18,2) := 0;
    v_entry_count INT := 0;
    v_locked_count INT := 0;
    v_pending_transfers INT := 0;
    v_summary JSONB;
BEGIN
    SELECT household_id INTO v_household_id FROM household_members WHERE user_id = p_user_id LIMIT 1;
    IF v_household_id IS NULL THEN RAISE EXCEPTION '사용자의 가구 정보를 찾을 수 없습니다.'; END IF;

    SELECT EXISTS(
        SELECT 1 FROM month_closings
        WHERE household_id = v_household_id AND year_month = p_year_month
    ) INTO v_already_closed;
    IF v_already_closed THEN RAISE EXCEPTION '해당 월(%)은 이미 마감되었습니다.', p_year_month; END IF;

    v_start_date := (p_year_month || '-01')::DATE;
    v_end_date := (v_start_date + INTERVAL '1 month' - INTERVAL '1 second');

    SELECT COUNT(*) INTO v_pending_transfers FROM auto_transfer_instances
    WHERE household_id = v_household_id AND status = 'pending' AND due_date >= v_start_date::DATE AND due_date <= v_end_date::DATE;

    SELECT COUNT(*) INTO v_entry_count FROM transaction_entries
    WHERE household_id = v_household_id AND occurred_at >= v_start_date AND occurred_at <= v_end_date;

    SELECT COALESCE(SUM(tl.amount), 0) INTO v_total_income
    FROM transaction_entries te JOIN transaction_lines tl ON tl.entry_id = te.id
    WHERE te.household_id = v_household_id AND te.entry_type = 'income' AND te.occurred_at >= v_start_date AND te.occurred_at <= v_end_date AND tl.amount > 0;

    SELECT COALESCE(SUM(ABS(tl.amount)), 0) INTO v_total_expense
    FROM transaction_entries te JOIN transaction_lines tl ON tl.entry_id = te.id
    WHERE te.household_id = v_household_id AND te.entry_type = 'expense' AND te.occurred_at >= v_start_date AND te.occurred_at <= v_end_date AND tl.amount < 0;

    SELECT COALESCE(SUM(tl.amount), 0) INTO v_total_transfer
    FROM transaction_entries te JOIN transaction_lines tl ON tl.entry_id = te.id
    WHERE te.household_id = v_household_id AND te.entry_type = 'transfer' AND te.occurred_at >= v_start_date AND te.occurred_at <= v_end_date AND tl.amount > 0;

    UPDATE transaction_entries SET is_locked = true
    WHERE household_id = v_household_id AND occurred_at >= v_start_date AND occurred_at <= v_end_date AND is_locked = false;
    GET DIAGNOSTICS v_locked_count = ROW_COUNT;

    v_summary := jsonb_build_object(
        'year_month', p_year_month,
        'total_income', v_total_income,
        'total_expense', v_total_expense,
        'total_transfer', v_total_transfer,
        'net_change', v_total_income - v_total_expense,
        'entry_count', v_entry_count,
        'locked_count', v_locked_count,
        'pending_transfers', v_pending_transfers,
        'closed_at', NOW()
    );

    INSERT INTO month_closings (household_id, year_month, closed_at, closed_by, summary_json)
    VALUES (v_household_id, p_year_month, NOW(), p_user_id, v_summary);

    -- [SEC] Audit 로그 추가
    INSERT INTO audit_logs (household_id, user_id, action, payload_json)
    VALUES (v_household_id, p_user_id, 'close_month', v_summary);

    RETURN v_summary;
END;
$$;
