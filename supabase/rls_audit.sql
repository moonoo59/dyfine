-- =============================================================
-- Sprint 6: RLS 전수 점검 스크립트
-- [Reviewer] 모든 테이블에 RLS가 활성화되어 있는지 확인
-- Supabase SQL Editor에서 실행하여 결과를 확인
-- =============================================================

-- 1. RLS가 비활성화된 테이블 목록 (결과가 없어야 정상)
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false
ORDER BY tablename;

-- 2. 각 테이블별 RLS 정책 목록
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. is_locked 전표 보호 정책 확인
-- transaction_entries 테이블에 UPDATE/DELETE 방지 정책이 있는지 확인
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'transaction_entries'
ORDER BY policyname;

-- 4. SECURITY DEFINER 함수 목록 (권한 범위 감사)
SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- 5. 외래 키 무결성 확인 (orphan 레코드 탐지)
-- transaction_lines에 존재하지 않는 entry_id가 있는지 확인
SELECT tl.id, tl.entry_id
FROM transaction_lines tl
LEFT JOIN transaction_entries te ON te.id = tl.entry_id
WHERE te.id IS NULL
LIMIT 10;

-- 6. 마감된 월의 전표가 실제로 잠겨 있는지 확인
SELECT mc.closing_month, COUNT(te.id) as total_entries,
       SUM(CASE WHEN te.is_locked THEN 1 ELSE 0 END) as locked_count,
       SUM(CASE WHEN NOT te.is_locked THEN 1 ELSE 0 END) as unlocked_count
FROM month_closings mc
JOIN transaction_entries te
  ON te.household_id = mc.household_id
  AND date_trunc('month', te.occurred_at) = mc.closing_month::timestamp
GROUP BY mc.closing_month
ORDER BY mc.closing_month;
