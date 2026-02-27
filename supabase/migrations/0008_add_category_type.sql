-- 0008_add_category_type.sql
-- 카테고리에 지출/수입 구분 컬럼 추가 (E-09)
-- ⚠️ Supabase SQL Editor에서 실행해 주세요.

-- category_type: 'expense' | 'income' | 'both'
ALTER TABLE categories ADD COLUMN IF NOT EXISTS category_type text DEFAULT 'expense';

-- CHECK 제약조건 추가
ALTER TABLE categories ADD CONSTRAINT categories_category_type_check 
  CHECK (category_type IN ('expense', 'income', 'both'));
