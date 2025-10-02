-- =====================================================
-- WIDERØE ANALYTICS PLATFORM
-- Migration 009: Cron Jobs for Automated Ingestion
-- Requires pg_cron extension
-- =====================================================

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =============================================================================
-- DAILY JOBS (08:00 UTC / 09:00 CET)
-- =============================================================================

-- Job 1: Calculate daylight hours (daily at 08:00)
SELECT cron.schedule(
  'calculate-daylight-daily',
  '0 8 * * *',  -- 08:00 UTC daily
  $$
  SELECT net.http_post(
    url := 'https://epokqlkkiknvhromsufb.supabase.co/functions/v1/calculate-daylight',
    headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '", "Content-Type": "application/json"}',
    body := '{"backfill_days": 0}'::jsonb
  );
  $$
);

-- Job 2: Ingest MET weather data (daily at 08:15)
SELECT cron.schedule(
  'ingest-weather-daily',
  '15 8 * * *',  -- 08:15 UTC daily
  $$
  SELECT net.http_post(
    url := 'https://epokqlkkiknvhromsufb.supabase.co/functions/v1/ingest-met-weather',
    headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '", "Content-Type": "application/json"}',
    body := '{"backfill_days": 0}'::jsonb
  );
  $$
);

-- Job 3: Calculate værskifte features (daily at 08:30, after weather ingestion)
-- This is handled automatically by trigger in ingest-met-weather function

-- =============================================================================
-- WEEKLY JOBS (Mondays 09:00 UTC / 10:00 CET)
-- =============================================================================

-- Job 4: Ingest FHI health signals (weekly on Monday at 09:00)
SELECT cron.schedule(
  'ingest-health-weekly',
  '0 9 * * 1',  -- 09:00 UTC every Monday
  $$
  SELECT net.http_post(
    url := 'https://epokqlkkiknvhromsufb.supabase.co/functions/v1/ingest-fhi-health',
    headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '", "Content-Type": "application/json"}',
    body := '{"weeks_back": 1}'::jsonb
  );
  $$
);

-- Job 5: Ingest Google Trends (weekly on Monday at 09:15)
SELECT cron.schedule(
  'ingest-trends-weekly',
  '15 9 * * 1',  -- 09:15 UTC every Monday
  $$
  SELECT net.http_post(
    url := 'https://epokqlkkiknvhromsufb.supabase.co/functions/v1/ingest-google-trends',
    headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '", "Content-Type": "application/json"}',
    body := '{"weeks_back": 1}'::jsonb
  );
  $$
);

-- Job 6: Generate alerts (weekly on Monday at 09:30)
SELECT cron.schedule(
  'generate-alerts-weekly',
  '30 9 * * 1',  -- 09:30 UTC every Monday
  $$
  SELECT net.http_post(
    url := 'https://epokqlkkiknvhromsufb.supabase.co/functions/v1/generate-alerts',
    headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '", "Content-Type": "application/json"}',
    body := '{}'::jsonb
  );
  $$
);

-- Job 7: Refresh feature store materialized view (weekly on Monday at 10:00)
SELECT cron.schedule(
  'refresh-feature-store-weekly',
  '0 10 * * 1',  -- 10:00 UTC every Monday
  $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY feature_employee_week;
  $$
);

-- Job 8: ETL orchestrator (weekly on Monday at 10:30)
SELECT cron.schedule(
  'etl-orchestrator-weekly',
  '30 10 * * 1',  -- 10:30 UTC every Monday
  $$
  SELECT net.http_post(
    url := 'https://epokqlkkiknvhromsufb.supabase.co/functions/v1/etl-orchestrator',
    headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '", "Content-Type": "application/json"}',
    body := '{}'::jsonb
  );
  $$
);

-- =============================================================================
-- MONITORING: View scheduled jobs
-- =============================================================================

-- To view all scheduled cron jobs:
-- SELECT * FROM cron.job;

-- To view cron job run history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 100;

-- To unschedule a job:
-- SELECT cron.unschedule('job-name');

-- =============================================================================
-- NOTES
-- =============================================================================

-- 1. pg_cron requires the supabase_admin role to schedule jobs
-- 2. Service role key must be stored in database settings:
--    ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';
-- 3. Alternative: Use Supabase Dashboard → Database → Cron Jobs UI
-- 4. For production: Consider using Supabase Edge Functions with scheduled invocations
--    instead of pg_cron for better observability
