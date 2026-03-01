-- =============================================================
-- Sprint 8: 투자 코어 마무리 — 스냅샷 RPC 및 가격 일괄 업데이트 RPC
-- =============================================================

-- 1. update_holding_snapshot RPC
-- 특정 가구의 특정 일자(보통 오늘) 보유 스냅샷을 생성/갱신합니다. (월 마감 등에서 호출)
CREATE OR REPLACE FUNCTION update_holding_snapshot(
    p_household_id uuid,
    p_snapshot_date date DEFAULT CURRENT_DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO holding_snapshots (
        household_id,
        snapshot_date,
        security_id,
        account_id,
        quantity,
        avg_price,
        last_price,
        estimated_value
    )
    SELECT
        household_id,
        p_snapshot_date,
        security_id,
        account_id,
        quantity,
        avg_price,
        last_price,
        (quantity * last_price) AS estimated_value
    FROM holdings
    WHERE household_id = p_household_id
      AND quantity > 0
    ON CONFLICT (household_id, snapshot_date, security_id, account_id)
    DO UPDATE SET
        quantity = EXCLUDED.quantity,
        avg_price = EXCLUDED.avg_price,
        last_price = EXCLUDED.last_price,
        estimated_value = EXCLUDED.estimated_value;
END;
$$;

-- 2. update_security_prices RPC
-- 여러 종목의 현재가를 한 번에 갱신하는 기능 (JSON 배열 형태 배치를 처리)
-- 매개변수 p_prices 예시: '[{"security_id": 1, "price": 80000}, {"security_id": 2, "price": 120000}]'
CREATE OR REPLACE FUNCTION update_security_prices(
    p_household_id uuid,
    p_prices jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    price_record record;
BEGIN
    FOR price_record IN SELECT * FROM jsonb_to_recordset(p_prices) AS x(security_id bigint, price numeric)
    LOOP
        -- 보유 정보 중 해당 종목들의 last_price 를 일괄 업데이트
        UPDATE holdings
        SET last_price = price_record.price,
            last_price_updated_at = now(),
            updated_at = now()
        WHERE household_id = p_household_id
          AND security_id = price_record.security_id;
    END LOOP;
END;
$$;

