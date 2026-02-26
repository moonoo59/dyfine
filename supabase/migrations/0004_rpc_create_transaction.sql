-- 0004_rpc_create_transaction.sql
-- 복식부기(Double-Entry) 트랜잭션의 원자성(Atomicity)을 보장하기 위한 RPC 함수

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

  -- 3. 성공 시 생성된 entry_id 반환 (하나라도 실패 시 전체 롤백됨)
  RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 주석:
-- 호출 방법 (JavaScript/TypeScript):
-- const { data, error } = await supabase.rpc('create_transaction', {
--   p_household_id: '...',
--   p_occurred_at: '2023-10-01',
--   p_entry_type: 'expense',
--   p_category_id: 12,
--   p_memo: '점심식사',
--   p_source: 'manual',
--   p_created_by: '...',
--   p_lines: [{ account_id: 1, amount: -10000 }]
-- });
