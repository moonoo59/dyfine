-- 0022_security_theme.sql
-- 증권(주식/ETF)의 테마 및 배당 성향 구분 추가

-- 사용할 theme 종류: 'index', 'dividend', 'bond', 'gold', 'china', 'theme', 'individual', 'cash' 등 사용자 정의 문자열
ALTER TABLE securities ADD COLUMN IF NOT EXISTS theme text DEFAULT 'index';
ALTER TABLE securities ADD COLUMN IF NOT EXISTS is_dividend_stock bool DEFAULT false;
