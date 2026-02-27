-- 0007_add_account_fields.sql
-- 계좌 테이블에 은행명, 계좌번호, 예금주 컬럼 추가
-- ⚠️ Supabase SQL Editor에서 실행해 주세요.

-- 은행/증권사 이름
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS bank_name text;

-- 계좌번호
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_number text;

-- 예금주
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS holder_name text;

-- 기존 account_type 제약조건 확장 (6가지 유형)
-- 기존 CHECK 제약조건 삭제 후 재생성
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_account_type_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_account_type_check 
  CHECK (account_type IN ('checking', 'savings', 'installment_savings', 'credit_card', 'debit_card', 'investment', 'bank', 'brokerage', 'virtual', 'external'));
