-- VERIFICATION SCRIPT: Verify attendance date migration was successful
-- Run this query after migration to ensure all dates are correct

DO $$
DECLARE
  v_operational_tz TEXT := 'Asia/Makassar';
  v_incorrect_count INTEGER;
  v_total_count INTEGER;
  v_sample_record RECORD;
BEGIN
  RAISE NOTICE '=== Verifying Attendance Date Migration ===';
  RAISE NOTICE 'Operational Timezone: %', v_operational_tz;
  RAISE NOTICE '';
  
  -- Count total records
  SELECT COUNT(*) INTO v_total_count
  FROM shift_attendance
  WHERE first_online_at IS NOT NULL;
  
  RAISE NOTICE 'Total attendance records with first_online_at: %', v_total_count;
  
  -- Count records that still have incorrect dates
  SELECT COUNT(*) INTO v_incorrect_count
  FROM shift_attendance
  WHERE date != (first_online_at AT TIME ZONE v_operational_tz)::DATE
    AND first_online_at IS NOT NULL;
  
  RAISE NOTICE 'Records with incorrect dates: %', v_incorrect_count;
  
  IF v_incorrect_count > 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE 'WARNING: Found % records with incorrect dates!', v_incorrect_count;
    RAISE NOTICE 'Sample of incorrect records:';
    
    FOR v_sample_record IN (
      SELECT 
        id,
        courier_id,
        date as current_date,
        (first_online_at AT TIME ZONE v_operational_tz)::DATE as correct_date,
        first_online_at AT TIME ZONE v_operational_tz as first_online_local
      FROM shift_attendance
      WHERE date != (first_online_at AT TIME ZONE v_operational_tz)::DATE
        AND first_online_at IS NOT NULL
      ORDER BY first_online_at DESC
      LIMIT 10
    ) LOOP
      RAISE NOTICE '  ID: % | Courier: % | Current: % | Should be: % | First Online: %',
        v_sample_record.id,
        v_sample_record.courier_id,
        v_sample_record.current_date,
        v_sample_record.correct_date,
        v_sample_record.first_online_local;
    END LOOP;
    
    RAISE EXCEPTION 'Migration verification failed: % records still have incorrect dates', v_incorrect_count;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== Verification PASSED ===';
  RAISE NOTICE 'All % attendance records have correct dates', v_total_count;
  RAISE NOTICE 'Migration was successful!';
END $$;

-- Additional verification: Check date consistency
SELECT 
  'Date Consistency Check' as check_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN date = (first_online_at AT TIME ZONE 'Asia/Makassar')::DATE THEN 1 END) as correct_dates,
  COUNT(CASE WHEN date != (first_online_at AT TIME ZONE 'Asia/Makassar')::DATE THEN 1 END) as incorrect_dates,
  ROUND(
    100.0 * COUNT(CASE WHEN date = (first_online_at AT TIME ZONE 'Asia/Makassar')::DATE THEN 1 END) / 
    NULLIF(COUNT(*), 0), 
    2
  ) as correctness_percentage
FROM shift_attendance
WHERE first_online_at IS NOT NULL;
