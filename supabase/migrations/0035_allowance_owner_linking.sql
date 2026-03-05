-- =============================================================
-- 0035: 용돈 계정 연동 — 본인만 접근 가능하도록 owner_user_id 추가
-- [PM] 각자의 용돈은 각자만 볼 수 있도록 계정 연동
-- =============================================================

-- 1. owner_user_id 컬럼 추가 (본인 계정 연동)
ALTER TABLE personal_allowances
    ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE allowance_fixed_expenses
    ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. 기존 RLS 정책 삭제 (가구 전체 접근 → 본인만 접근으로 변경)
DROP POLICY IF EXISTS "Members can manage personal_allowances" ON personal_allowances;
DROP POLICY IF EXISTS "Members can manage allowance_fixed_expenses" ON allowance_fixed_expenses;

-- 3. 새 RLS 정책: owner_user_id가 현재 로그인 사용자와 일치해야만 접근 가능
CREATE POLICY "Owner can manage own allowances"
    ON personal_allowances FOR ALL TO authenticated
    USING (owner_user_id = auth.uid())
    WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Owner can manage own fixed expenses"
    ON allowance_fixed_expenses FOR ALL TO authenticated
    USING (owner_user_id = auth.uid())
    WITH CHECK (owner_user_id = auth.uid());
