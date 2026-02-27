-- 0005_rls_policies.sql
-- 가구(Household) 기반 데이터 격리를 위한 RLS(Row Level Security) 정책 정의

-- 1. 유틸리티 함수 생성 (권한 체크용)
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

-- 2. Households (가구) 정책
CREATE POLICY "Users can create households" ON households FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Members can view households" ON households FOR SELECT TO authenticated USING (is_household_member(id));
CREATE POLICY "Owners can update households" ON households FOR UPDATE TO authenticated USING (is_household_owner(id));

-- 3. Household Members (구성원) 정책
CREATE POLICY "Users can view members of their households" ON household_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_household_member(household_id));
CREATE POLICY "Users can insert themselves" ON household_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners can manage members" ON household_members FOR UPDATE TO authenticated USING (is_household_owner(household_id));
CREATE POLICY "Owners can delete members" ON household_members FOR DELETE TO authenticated USING (is_household_owner(household_id));

-- 4. Profiles 정책
CREATE POLICY "Users can manage their profile" ON profiles FOR ALL TO authenticated USING (user_id = auth.uid());

-- 5. 마스터 데이터 (Accounts, Categories, Tags 등) 정책
CREATE POLICY "Members can manage account_groups" ON account_groups FOR ALL TO authenticated USING (is_household_member(household_id));
CREATE POLICY "Members can manage accounts" ON accounts FOR ALL TO authenticated USING (is_household_member(household_id));
CREATE POLICY "Members can manage categories" ON categories FOR ALL TO authenticated USING (is_household_member(household_id));
CREATE POLICY "Members can manage tags" ON tags FOR ALL TO authenticated USING (is_household_member(household_id));

-- 6. 거래 내역 (Transactions) 정책
CREATE POLICY "Members can manage transaction_entries" ON transaction_entries FOR ALL TO authenticated USING (is_household_member(household_id));

CREATE POLICY "Members can manage transaction_lines" ON transaction_lines FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM transaction_entries WHERE id = transaction_lines.entry_id AND is_household_member(household_id))
);

CREATE POLICY "Members can manage entry_tags" ON entry_tags FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM transaction_entries WHERE id = entry_tags.entry_id AND is_household_member(household_id))
);

-- 7. 자동이체 / 예산 / 마감 정책 (간소화 버젼: 모두 Member 접근 허용)
CREATE POLICY "Members can manage auto_transfer_rules" ON auto_transfer_rules FOR ALL TO authenticated USING (is_household_member(household_id));
CREATE POLICY "Members can manage auto_transfer_instances" ON auto_transfer_instances FOR ALL TO authenticated USING (is_household_member(household_id));
CREATE POLICY "Members can manage budget_templates" ON budget_templates FOR ALL TO authenticated USING (is_household_member(household_id));
CREATE POLICY "Members can manage month_closings" ON month_closings FOR ALL TO authenticated USING (is_household_member(household_id));
