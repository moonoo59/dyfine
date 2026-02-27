-- 0006_fix_rls_patch.sql
-- ⚠️ Supabase SQL Editor에서 이 파일 전체를 복사-붙여넣기하여 실행하세요.
-- 기존 정책을 깔끔하게 제거 후 재적용하는 패치입니다.

-- =====================================================
-- 기존 정책 삭제 (오류 방지를 위해 IF EXISTS 사용)
-- =====================================================

-- Households
DROP POLICY IF EXISTS "Users can create households" ON households;
DROP POLICY IF EXISTS "Members can view households" ON households;
DROP POLICY IF EXISTS "Owners can update households" ON households;

-- Household Members
DROP POLICY IF EXISTS "Users can view members of their households" ON household_members;
DROP POLICY IF EXISTS "Users can insert themselves" ON household_members;
DROP POLICY IF EXISTS "Owners can manage members" ON household_members;
DROP POLICY IF EXISTS "Owners can delete members" ON household_members;

-- Profiles
DROP POLICY IF EXISTS "Users can manage their profile" ON profiles;

-- Master Data
DROP POLICY IF EXISTS "Members can manage account_groups" ON account_groups;
DROP POLICY IF EXISTS "Members can manage accounts" ON accounts;
DROP POLICY IF EXISTS "Members can manage categories" ON categories;
DROP POLICY IF EXISTS "Members can manage tags" ON tags;

-- Transactions
DROP POLICY IF EXISTS "Members can manage transaction_entries" ON transaction_entries;
DROP POLICY IF EXISTS "Members can manage transaction_lines" ON transaction_lines;
DROP POLICY IF EXISTS "Members can manage entry_tags" ON entry_tags;

-- Auto Transfer / Budget / Closing
DROP POLICY IF EXISTS "Members can manage auto_transfer_rules" ON auto_transfer_rules;
DROP POLICY IF EXISTS "Members can manage auto_transfer_instances" ON auto_transfer_instances;
DROP POLICY IF EXISTS "Members can manage budget_templates" ON budget_templates;
DROP POLICY IF EXISTS "Members can manage month_closings" ON month_closings;

-- =====================================================
-- 유틸리티 함수 재생성 (helper functions)
-- =====================================================
CREATE OR REPLACE FUNCTION is_household_member(p_household_id uuid) RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = p_household_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_household_owner(p_household_id uuid) RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = p_household_id AND user_id = auth.uid() AND role = 'owner'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RLS 재활성화 (혹시 안 되어있을 경우 대비)
-- =====================================================
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_transfer_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_transfer_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE month_closings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 정책 재적용
-- =====================================================

-- 1. Households
-- 인증된 사용자는 가구를 생성할 수 있습니다
CREATE POLICY "Users can create households"
  ON households FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 가구 구성원만 해당 가구를 조회할 수 있습니다
CREATE POLICY "Members can view households"
  ON households FOR SELECT
  TO authenticated
  USING (is_household_member(id));

-- 가구 오너만 가구 정보를 수정할 수 있습니다
CREATE POLICY "Owners can update households"
  ON households FOR UPDATE
  TO authenticated
  USING (is_household_owner(id));

-- 2. Household Members
CREATE POLICY "Users can view members of their households"
  ON household_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_household_member(household_id));

-- 자기 자신은 구성원으로 등록할 수 있습니다 (온보딩 가입)
CREATE POLICY "Users can insert themselves"
  ON household_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can manage members"
  ON household_members FOR UPDATE
  TO authenticated
  USING (is_household_owner(household_id));

CREATE POLICY "Owners can delete members"
  ON household_members FOR DELETE
  TO authenticated
  USING (is_household_owner(household_id));

-- 3. Profiles
CREATE POLICY "Users can manage their profile"
  ON profiles FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. Master Data
CREATE POLICY "Members can manage account_groups" ON account_groups FOR ALL TO authenticated USING (is_household_member(household_id)) WITH CHECK (is_household_member(household_id));
CREATE POLICY "Members can manage accounts" ON accounts FOR ALL TO authenticated USING (is_household_member(household_id)) WITH CHECK (is_household_member(household_id));
CREATE POLICY "Members can manage categories" ON categories FOR ALL TO authenticated USING (is_household_member(household_id)) WITH CHECK (is_household_member(household_id));
CREATE POLICY "Members can manage tags" ON tags FOR ALL TO authenticated USING (is_household_member(household_id)) WITH CHECK (is_household_member(household_id));

-- 5. Transactions
CREATE POLICY "Members can manage transaction_entries"
  ON transaction_entries FOR ALL TO authenticated
  USING (is_household_member(household_id))
  WITH CHECK (is_household_member(household_id));

CREATE POLICY "Members can manage transaction_lines"
  ON transaction_lines FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM transaction_entries
      WHERE id = transaction_lines.entry_id AND is_household_member(household_id)
    )
  );

CREATE POLICY "Members can manage entry_tags"
  ON entry_tags FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM transaction_entries
      WHERE id = entry_tags.entry_id AND is_household_member(household_id)
    )
  );

-- 6. Auto Transfer / Budget / Closing
CREATE POLICY "Members can manage auto_transfer_rules" ON auto_transfer_rules FOR ALL TO authenticated USING (is_household_member(household_id)) WITH CHECK (is_household_member(household_id));
CREATE POLICY "Members can manage auto_transfer_instances" ON auto_transfer_instances FOR ALL TO authenticated USING (is_household_member(household_id)) WITH CHECK (is_household_member(household_id));
CREATE POLICY "Members can manage budget_templates" ON budget_templates FOR ALL TO authenticated USING (is_household_member(household_id)) WITH CHECK (is_household_member(household_id));
CREATE POLICY "Members can manage month_closings" ON month_closings FOR ALL TO authenticated USING (is_household_member(household_id)) WITH CHECK (is_household_member(household_id));
