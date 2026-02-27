-- =============================================================
-- 자동이체 확인(Confirm) RPC 함수
-- 하나의 트랜잭션 내에서 전표 생성 + 라인 생성 + 인스턴스 확인 처리
-- 원자성 보장: 중간 실패 시 전체 롤백
-- =============================================================

CREATE OR REPLACE FUNCTION confirm_auto_transfer(
    p_instance_id BIGINT,   -- 확인할 자동이체 인스턴스 ID
    p_user_id UUID          -- 확인을 수행하는 사용자 ID
)
RETURNS BIGINT              -- 생성된 transaction_entries.id 반환
LANGUAGE plpgsql
SECURITY DEFINER            -- RLS 우회 (서비스 레벨 함수)
AS $$
DECLARE
    v_instance RECORD;      -- 인스턴스 정보 저장
    v_rule RECORD;          -- 규칙 정보 저장
    v_entry_id BIGINT;      -- 생성된 전표 ID
    v_household_id UUID;    -- 사용자의 가구 ID
BEGIN
    -- 1. 사용자의 household_id 조회
    SELECT household_id INTO v_household_id
    FROM household_members
    WHERE user_id = p_user_id
    LIMIT 1;

    IF v_household_id IS NULL THEN
        RAISE EXCEPTION '사용자의 가구 정보를 찾을 수 없습니다.';
    END IF;

    -- 2. 인스턴스 정보 조회 (pending 상태만)
    SELECT * INTO v_instance
    FROM auto_transfer_instances
    WHERE id = p_instance_id
      AND household_id = v_household_id
      AND status = 'pending';

    IF v_instance IS NULL THEN
        RAISE EXCEPTION '유효한 대기 중 인스턴스를 찾을 수 없습니다. (id=%)', p_instance_id;
    END IF;

    -- 3. 규칙 정보 조회
    SELECT * INTO v_rule
    FROM auto_transfer_rules
    WHERE id = v_instance.rule_id;

    IF v_rule IS NULL THEN
        RAISE EXCEPTION '자동이체 규칙을 찾을 수 없습니다. (rule_id=%)', v_instance.rule_id;
    END IF;

    -- 4. 거래 전표(Entry) 생성
    INSERT INTO transaction_entries (
        household_id,
        occurred_at,
        entry_type,
        memo,
        source,
        created_by
    ) VALUES (
        v_household_id,
        COALESCE(v_instance.due_date, CURRENT_DATE),
        'transfer',
        '[자동이체] ' || v_rule.name,
        'auto_transfer',
        p_user_id
    )
    RETURNING id INTO v_entry_id;

    -- 5. 거래 라인(Lines) 생성 (출금 + 입금, 합계 = 0)
    INSERT INTO transaction_lines (entry_id, account_id, amount) VALUES
        (v_entry_id, v_rule.from_account_id, -v_instance.expected_amount),
        (v_entry_id, v_rule.to_account_id,   v_instance.expected_amount);

    -- 6. 인스턴스 상태 업데이트: confirmed + 전표 연결
    UPDATE auto_transfer_instances
    SET status = 'confirmed',
        confirmed_at = NOW(),
        confirmed_by = p_user_id,
        generated_entry_id = v_entry_id
    WHERE id = p_instance_id;

    -- 생성된 전표 ID 반환
    RETURN v_entry_id;
END;
$$;
