-- ==========================================
-- [대출 제약조건 & 컬럼 누락 긴급 패치]
-- Supabase SQL Editor 에 복사 후 실행해 주세요.
-- ==========================================

-- 1. 대출 상환 방식 체크 제약조건 교체 (graduated 등 추가)
ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_repayment_type_check;
ALTER TABLE loans ADD CONSTRAINT loans_repayment_type_check
  CHECK (repayment_type IN (
    'annuity',           -- 원리금균등
    'equal_principal',   -- 원금균등
    'interest_only',     -- 만기일시상환(거치식)
    'graduated',         -- 체증식
    'custom_schedule'    -- 사용자 정의
  ));

-- 2. 금리 이력 데이터에 생성자(created_by) 외래키 추가
-- (RPC create_loan 내부에서 created_by를 매핑할 때 에러가 나지 않도록 조치)
ALTER TABLE loan_rate_history ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(user_id) ON DELETE SET NULL;
