-- =============================================================
-- Sprint 10: 대출 스케줄 등급별 배치 잡 설정 (pg_cron)
-- =============================================================

-- pg_cron 익스텐션 활성화 (Supabase 환경에서는 기본적으로 사용 가능하지만 
-- 활성화가 필요할 수 있으므로 CREATE EXTENSION IF NOT EXISTS 추가)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1. 매일 자정(00:00)에 대출 이자 및 스케줄에 따른 전표 생성을 수행하는 크론 잡 추가
-- 크론 잡 이름표: 'daily-monthly-loan-entries'
SELECT cron.schedule(
  'daily-monthly-loan-entries',  -- 잡 이름
  '0 0 * * *',                   -- 스케줄 주기: 매일 밤 12시 0분
  $$
    -- 모든 가구(households)의 납입 예정일 도래 대출들에 대해 전표를 자동 생성하는 RPC 호출
    SELECT "generate_monthly_loan_entries"();
  $$
);

-- =============================================================
-- ※ 참고: 크론 잡 수정/삭제 시 사용하는 명령어 목록
-- =============================================================
-- 특정 크론 잡 삭제:
-- SELECT cron.unschedule('daily-monthly-loan-entries');
--
-- 상태 확인:
-- SELECT * FROM cron.job;
-- SELECT * FROM cron.job_run_details ORDER BY run_id DESC LIMIT 10;
