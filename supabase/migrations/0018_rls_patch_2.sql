-- 0018_rls_patch_2.sql
-- 누락된 테이블에 대한 RLS 정책 추가 (보안 강화)
-- ⚠️ Supabase SQL Editor에서 실행해 주세요.

-- 1. 분류 규칙 (classification_rules)
ALTER TABLE classification_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can manage classification_rules" ON classification_rules;
CREATE POLICY "Members can manage classification_rules"
  ON classification_rules FOR ALL TO authenticated
  USING (is_household_member(household_id))
  WITH CHECK (is_household_member(household_id));

-- 2. 예산 템플릿 상세 라인 (budget_template_lines)
ALTER TABLE budget_template_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can manage budget_template_lines" ON budget_template_lines;
CREATE POLICY "Members can manage budget_template_lines"
  ON budget_template_lines FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM budget_templates
      WHERE id = budget_template_lines.template_id 
      AND is_household_member(household_id)
    )
  );

-- 3. 예산 월간 덮어쓰기 (budget_month_overrides)
ALTER TABLE budget_month_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can manage budget_month_overrides" ON budget_month_overrides;
CREATE POLICY "Members can manage budget_month_overrides"
  ON budget_month_overrides FOR ALL TO authenticated
  USING (is_household_member(household_id))
  WITH CHECK (is_household_member(household_id));

