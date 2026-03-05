-- migration: 0030_household_settings.sql
-- [PM] GoalWidget 목표 금액 등 household별 키-값 설정을 저장하는 범용 설정 테이블

CREATE TABLE IF NOT EXISTS household_settings (
    id          BIGSERIAL PRIMARY KEY,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    key         TEXT NOT NULL,
    value       TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- household_id + key 복합 유니크 (upsert 기준)
    CONSTRAINT uq_household_settings UNIQUE (household_id, key)
);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_household_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_household_settings_updated_at ON household_settings;
CREATE TRIGGER trg_household_settings_updated_at
    BEFORE UPDATE ON household_settings
    FOR EACH ROW EXECUTE FUNCTION update_household_settings_updated_at();

-- RLS 정책
ALTER TABLE household_settings ENABLE ROW LEVEL SECURITY;

-- 같은 household 구성원만 조회/수정 가능
CREATE POLICY "household_settings_select" ON household_settings
    FOR SELECT USING (
        household_id IN (
            SELECT household_id FROM household_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "household_settings_insert" ON household_settings
    FOR INSERT WITH CHECK (
        household_id IN (
            SELECT household_id FROM household_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "household_settings_update" ON household_settings
    FOR UPDATE USING (
        household_id IN (
            SELECT household_id FROM household_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "household_settings_delete" ON household_settings
    FOR DELETE USING (
        household_id IN (
            SELECT household_id FROM household_members WHERE user_id = auth.uid()
        )
    );
