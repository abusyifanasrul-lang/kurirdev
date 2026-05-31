-- Initialize Cron Jobs

DO $$
BEGIN
  PERFORM sync_shift_cron_jobs();
  RAISE NOTICE 'Initialized shift-based cron jobs for all active shifts';
END $$;

SELECT cron.schedule(
  'update-late-minutes',
  '* * * * *',
  'SELECT update_late_minutes()'
);;
