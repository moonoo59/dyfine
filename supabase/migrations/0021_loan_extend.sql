-- 0021_loan_extend.sql
-- 대출 관리를 위한 부가 정보(은행명, 상환순위) 추가

ALTER TABLE loans ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS repayment_priority int;
