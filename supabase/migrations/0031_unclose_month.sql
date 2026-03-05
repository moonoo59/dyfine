-- migration: 0031_unclose_month.sql
-- [PM] 월 마감 해제 기능 추가 (전표 잠금 해제 및 마감 기록 삭제)

CREATE OR REPLACE FUNCTION unclose_month(
    p_year_month CHAR(7),      -- 해제 대상 월 (예: '2026-02')
    p_user_id UUID              -- 실행 사용자 ID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_household_id UUID;
    v_exists BOOLEAN;
    v_start_date TIMESTAMPTZ;
    v_end_date TIMESTAMPTZ;
BEGIN
    -- 1. 사용자의 household_id 조회
    SELECT household_id INTO v_household_id
    FROM household_members
    WHERE user_id = p_user_id
    LIMIT 1;

    IF v_household_id IS NULL THEN
        RAISE EXCEPTION '사용자의 가구 정보를 찾을 수 없습니다.';
    END IF;

    -- 2. 마감 기록 존재 확인
    SELECT EXISTS(
        SELECT 1 FROM month_closings
        WHERE household_id = v_household_id AND year_month = p_year_month
    ) INTO v_exists;

    IF NOT v_exists THEN
        RAISE EXCEPTION '해당 월(%)은 마감되어 있지 않습니다.', p_year_month;
    END IF;

    -- 3. 월 범위 계산
    v_start_date := (p_year_month || '-01')::DATE;
    v_end_date := (v_start_date + INTERVAL '1 month' - INTERVAL '1 second');

    -- 4. 전표 잠금 해제 (is_locked = false)
    UPDATE transaction_entries
    SET is_locked = false
    WHERE household_id = v_household_id
      AND occurred_at >= v_start_date
      AND occurred_at <= v_end_date;

    -- 5. 마감 기록 삭제
    DELETE FROM month_closings
    WHERE household_id = v_household_id AND year_month = p_year_month;

    -- 6. (선택사항) 자산 스냅샷은 이력 차원에서 남겨둘 수도 있으나, 
    -- 재마감 시 upsert 되므로 굳이 여기서 삭제하지 않아도 됨.
    -- 필요한 경우 삭제 로직 추가 가능:
    -- DELETE FROM monthly_asset_snapshots WHERE household_id = v_household_id AND year_month = p_year_month;

    RETURN TRUE;
END;
$$;
