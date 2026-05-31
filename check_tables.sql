-- Check if the new tables exist in the database
SELECT 
  table_name,
  CASE 
    WHEN table_name IN ('cron_jobs', 'cron_execution_logs', 'holidays', 'shift_overrides') 
    THEN 'NEW TABLE (Task 1)'
    ELSE 'OTHER'
  END as table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('cron_jobs', 'cron_execution_logs', 'holidays', 'shift_overrides')
ORDER BY table_name;
