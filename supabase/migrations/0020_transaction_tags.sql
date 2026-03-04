-- 0020_transaction_tags.sql
-- 전표 생성 시 태그(Tags)를 함께 저장하도록 RPC 업데이트

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
BEGIN
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
        -- 이미 있는 태그인지 조회 없으면 새로 생성
        SELECT id INTO v_tag_id 
        FROM tags 
        WHERE household_id = p_household_id AND name = v_tag_name;

        IF v_tag_id IS NULL THEN
          INSERT INTO tags (household_id, name) 
          VALUES (p_household_id, v_tag_name) 
          RETURNING id INTO v_tag_id;
        END IF;

        -- entry_tags 맵핑
        INSERT INTO entry_tags (entry_id, tag_id)
        VALUES (v_entry_id, v_tag_id)
        ON CONFLICT DO NOTHING; -- 중복 방지 (다만 PK 제약 때문에 무시됨)
      END IF;
    END LOOP;
  END IF;

  -- 4. 성공 시 생성된 entry_id 반환 (하나라도 실패 시 전체 롤백됨)
  RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
