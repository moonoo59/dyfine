-- migration: 0032_add_created_by_columns.sql
-- [PM] 모든 주요 입력 데이터에 입력자(created_by) 기록 기능 추가

-- 1. 테이블 컬럼 추가
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(user_id) ON DELETE SET NULL;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(user_id) ON DELETE SET NULL;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(user_id) ON DELETE SET NULL;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(user_id) ON DELETE SET NULL;
ALTER TABLE securities ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(user_id) ON DELETE SET NULL;
ALTER TABLE holdings ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(user_id) ON DELETE SET NULL;
ALTER TABLE petcare_logs ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(user_id) ON DELETE SET NULL;
ALTER TABLE auto_transfer_rules ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(user_id) ON DELETE SET NULL;
ALTER TABLE budget_templates ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(user_id) ON DELETE SET NULL;
ALTER TABLE classification_rules ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(user_id) ON DELETE SET NULL;
ALTER TABLE investment_targets ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(user_id) ON DELETE SET NULL;

-- 1.1. 기존 transaction_entries.created_by도 profiles(user_id)를 참조하도록 FK 추가 (선택사항이나 조인 용이성 위해 권장)
-- ALTER TABLE transaction_entries DROP CONSTRAINT IF EXISTS transaction_entries_created_by_fkey;
ALTER TABLE transaction_entries ADD CONSTRAINT transaction_entries_created_by_profile_fkey FOREIGN KEY (created_by) REFERENCES profiles(user_id);

-- 2. 기존 데이터 업데이트 (선택 사항: 현재 연결된 household의 owner로 설정하거나 skip)
-- 예: UPDATE accounts SET created_by = (SELECT user_id FROM household_members WHERE household_id = accounts.household_id AND role = 'owner' LIMIT 1) WHERE created_by IS NULL;

-- 3. transaction_entries는 이미 created_by가 있음 (0002_transaction_schema.sql)
