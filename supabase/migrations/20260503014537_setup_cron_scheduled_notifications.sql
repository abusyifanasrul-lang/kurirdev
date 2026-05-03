-- Setup pg_cron for automatic scheduled notification processing
-- This cron job runs every 30 minutes to check and send due notifications

-- Ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;

-- Schedule the cron job to run every 30 minutes
-- This will call the safety net function to process any due notifications
SELECT cron.schedule(
  'process-scheduled-notifications-every-30min',
  '*/30 * * * *',
  $$SELECT public.process_due_scheduled_notifications()$$
);

COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL - used for scheduled notification processing';;
