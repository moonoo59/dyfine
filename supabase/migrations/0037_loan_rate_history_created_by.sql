-- migration: 0037_loan_rate_history_created_by.sql
-- 0036의 create_loan에서 사용하는 created_by 외래키가 loan_rate_history에 없어 에러나는 현상 픽스

ALTER TABLE loan_rate_history ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(user_id) ON DELETE SET NULL;
