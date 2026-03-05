-- 거치 기간을 관리하기 위한 컬럼 추가
ALTER TABLE loans ADD COLUMN IF NOT EXISTS grace_period_months int DEFAULT 0;
