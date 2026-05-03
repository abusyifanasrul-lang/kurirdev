-- Setup pg_cron for automatic scheduled notification processing
-- This cron job runs every 30 minutes to check and send due notifications

-- Ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;

-- Schedule the cron job to run every 30 minutes
-- This will call the safety net function to process any due notifications
SELECT cron.schedule(
  'process-scheduled-notifications-every-30min',  -- Job name
  '*/30 * * * *',                                  -- Every 30 minutes
  $$SELECT public.process_due_scheduled_notifications()$$
);

-- Verify the cron job was created
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job 
WHERE jobname = 'process-scheduled-notifications-every-30min';

COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL - used for scheduled notification processing';

-- Log success
DO $$
BEGIN
  RAISE NOTICE '✅ Cron job "process-scheduled-notifications-every-30min" created successfully';
  RAISE NOTICE '📅 Schedule: Every 30 minutes';
  RAISE NOTICE '🔧 Function: public.process_due_scheduled_notifications()';
  RAISE NOTICE '📊 Expected load: ~48 executions per day, ~1,440 per month';
END $$;
