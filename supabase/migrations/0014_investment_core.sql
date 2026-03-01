-- =============================================================
-- Sprint 8: 투자 코어 — RLS 정책 + record_trade RPC
-- =============================================================

-- 1. 투자 관련 RLS 정책 추가 (0003에서 RLS enable만 했고 정책 미작성)
DROP POLICY IF EXISTS "Members can manage securities" ON securities;
CREATE POLICY "Members can manage securities"
    ON securities FOR ALL TO authenticated
    USING (is_household_member(household_id))
    WITH CHECK (is_household_member(household_id));

DROP POLICY IF EXISTS "Members can manage holdings" ON holdings;
CREATE POLICY "Members can manage holdings"
    ON holdings FOR ALL TO authenticated
    USING (is_household_member(household_id))
    WITH CHECK (is_household_member(household_id));

DROP POLICY IF EXISTS "Members can manage holding_snapshots" ON holding_snapshots;
CREATE POLICY "Members can manage holding_snapshots"
    ON holding_snapshots FOR ALL TO authenticated
    USING (is_household_member(household_id))
    WITH CHECK (is_household_member(household_id));

-- 2. record_trade RPC — 종목 매수/매도 처리
-- - holdings 업데이트 (수량, 평균단가)
-- - transaction_entries 생성 (현금 흐름 기록)
CREATE OR REPLACE FUNCTION record_trade(
    p_household_id uuid,
    p_account_id bigint,
    p_ticker text,
    p_name text,
    p_market text,
    p_trade_type text, -- 'buy' or 'sell'
    p_quantity numeric,
    p_price numeric,
    p_fee numeric DEFAULT 0,
    p_occurred_at timestamptz DEFAULT now(),
    p_category_id bigint DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_security_id bigint;
    v_holding_id bigint;
    v_entry_id bigint;
    v_total_amount numeric;
    v_current_quantity numeric;
    v_current_avg_price numeric;
BEGIN
    -- 1. 종목 확인 또는 생성
    INSERT INTO securities (household_id, ticker, name, market)
    VALUES (p_household_id, p_ticker, p_name, p_market)
    ON CONFLICT (household_id, ticker) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_security_id;

    -- 2. 거래 금액 계산
    IF p_trade_type = 'buy' THEN
        v_total_amount := (p_quantity * p_price) + p_fee;
    ELSE
        v_total_amount := (p_quantity * p_price) - p_fee;
    END IF;

    -- 3. 보유 현황 확인 또는 생성
    SELECT id, quantity, avg_price INTO v_holding_id, v_current_quantity, v_current_avg_price
    FROM holdings
    WHERE household_id = p_household_id AND security_id = v_security_id AND account_id = p_account_id;

    IF v_holding_id IS NULL THEN
        IF p_trade_type = 'sell' THEN
            RAISE EXCEPTION '보유하지 않은 종목은 매도할 수 없습니다.';
        END IF;
        INSERT INTO holdings (household_id, security_id, account_id, quantity, avg_price, last_price, last_price_updated_at)
        VALUES (p_household_id, v_security_id, p_account_id, p_quantity, p_price, p_price, p_occurred_at)
        RETURNING id INTO v_holding_id;
    ELSE
        -- 보유 현황 업데이트
        IF p_trade_type = 'buy' THEN
            v_current_avg_price := ((v_current_quantity * v_current_avg_price) + (p_quantity * p_price) + p_fee) / (v_current_quantity + p_quantity);
            v_current_quantity := v_current_quantity + p_quantity;
        ELSE
            IF v_current_quantity < p_quantity THEN
                RAISE EXCEPTION '보유 수량이 부족합니다.';
            END IF;
            -- 매도는 평균단가 변동 없음 (보통 선입선출이나 가중평균이나 매도 시점 단가는 유지)
            v_current_quantity := v_current_quantity - p_quantity;
        END IF;

        UPDATE holdings SET
            quantity = v_current_quantity,
            avg_price = v_current_avg_price,
            last_price = p_price,
            last_price_updated_at = p_occurred_at,
            updated_at = now()
        WHERE id = v_holding_id;
    END IF;

    -- 4. 현금 흐름 기록 (transaction_entries)
    -- 매수는 지출(expense), 매도는 수입(income)
    INSERT INTO transaction_entries (
        household_id, occurred_at, entry_type, amount, memo, is_confirmed
    ) VALUES (
        p_household_id, p_occurred_at,
        CASE WHEN p_trade_type = 'buy' THEN 'expense' ELSE 'income' END,
        v_total_amount,
        p_name || ' ' || CASE WHEN p_trade_type = 'buy' THEN '매수' ELSE '매도' END || ' (' || p_quantity || '주)',
        true
    ) RETURNING id INTO v_entry_id;

    -- transaction_lines 생성
    -- 1) 계좌 잔액 변동
    INSERT INTO transaction_lines (entry_id, account_id, amount, is_increase)
    VALUES (
        v_entry_id, p_account_id, v_total_amount,
        CASE WHEN p_trade_type = 'buy' THEN false ELSE true END
    );

    -- 2) 상대 계정 (카테고리)
    IF p_category_id IS NOT NULL THEN
        INSERT INTO transaction_lines (entry_id, category_id, amount, is_increase)
        VALUES (
            v_entry_id, p_category_id, v_total_amount,
            CASE WHEN p_trade_type = 'buy' THEN true ELSE false END
        );
    END IF;

    -- 계좌 잔액 갱신
    UPDATE accounts SET
        balance = balance + CASE WHEN p_trade_type = 'buy' THEN -v_total_amount ELSE v_total_amount END,
        updated_at = now()
    WHERE id = p_account_id;

    RETURN v_holding_id;
END;
$$;
