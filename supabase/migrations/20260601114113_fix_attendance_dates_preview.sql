-- PREVIEW SCRIPT: Check attendance dates before migration
-- Run this query to see which records will be affected by the migration
-- DO NOT RUN THIS IN PRODUCTION - This is for preview only

SELECT 
  id,
  courier_id,
  shift_id,
  date as current_date,
  (first_online_at AT TIME ZONE 'Asia/Makassar')::DATE as correct_date,
  first_online_at,
  first_online_at AT TIME ZONE 'Asia/Makassar' as first_online_local,
  CASE 
    WHEN date < (first_online_at AT TIME ZONE 'Asia/Makassar')::DATE THEN 'Date is 1 day early'
    WHEN date > (first_online_at AT TIME ZONE 'Asia/Makassar')::DATE THEN 'Date is 1 day late'
    ELSE 'Date is correct'
  END as issue_type
FROM shift_attendance
WHERE date != (first_online_at AT TIME ZONE 'Asia/Makassar')::DATE
  AND first_online_at IS NOT NULL
ORDER BY first_online_at DESC
LIMIT 50;

-- Summary statistics
SELECT 
  COUNT(*) as total_incorrect_records,
  COUNT(DISTINCT courier_id) as affected_couriers,
  MIN(date) as earliest_incorrect_date,
  MAX(date) as latest_incorrect_date
FROM shift_attendance
WHERE date != (first_online_at AT TIME ZONE 'Asia/Makassar')::DATE
  AND first_online_at IS NOT NULL;
