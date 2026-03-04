-- 0019_loan_repayment_types.sql
-- 대출 상환 유형 확장: 체증식(graduated) 추가
-- ⚠️ Supabase SQL Editor에서 실행해 주세요.

-- 기존 CHECK 제약 조건 교체
ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_repayment_type_check;
ALTER TABLE loans ADD CONSTRAINT loans_repayment_type_check
  CHECK (repayment_type IN (
    'annuity',           -- 원리금균등: 매월 동일 원리금 납부
    'equal_principal',   -- 원금균등: 매월 동일 원금 + 체감 이자
    'interest_only',     -- 만기일시상환(거치식): 매월 이자만, 만기에 원금 일시 상환
    'graduated',         -- 체증식: 매년 납입액이 일정 비율씩 증가
    'custom_schedule'    -- 사용자 정의 스케줄
  ));

-- 체증식 연 증가율 컬럼 추가
ALTER TABLE loans ADD COLUMN IF NOT EXISTS graduated_increase_rate numeric(6,4) DEFAULT 0.10;
COMMENT ON COLUMN loans.graduated_increase_rate IS '체증식 상환의 연 납입액 증가율 (예: 0.10 = 매년 10%)';
