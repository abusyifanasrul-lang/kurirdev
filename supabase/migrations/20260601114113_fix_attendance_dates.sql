-- Fix attendance dates that were recorded with wrong timezone calculation
-- This migration recalculates the date column from first_online_at timestamp
-- using the operational timezone (Asia/Makassar) instead of UTC
--
-- Bug: Previous code used double AT TIME ZONE conversion which caused date shifts
-- Fix: Recalculate date directly from first_online_at using operational timezone
--
-- Related: timezone-date-calculation-fix spec (Task 6.1)

DO $$
DECLARE
  v_operational_tz TEXT := 'Asia/Makassar';
  v_affected_count INTEGER;
  v_sample_record RECORD;
BEGIN
  RAISE NOTICE '=== Starting Attendance Date Migration ===';
  RAISE NOTICE 'Operational Timezone: %', v_operational_tz;
  
  -- Log sample of records that will be updated
  RAISE NOTICE '';
  RAISE NOTICE 'Sample of records with incorrect dates (showing first 5):';
  FOR v_sample_record IN (
    SELECT 
      id,
      courier_id,
      date as current_date,
      (first_online_at AT TIME ZONE v_operational_tz)::DATE as correct_date,
      first_online_at,
      first_online_at AT TIME ZONE v_operational_tz as first_online_local
    FROM shift_attendance
    WHERE date != (first_online_at AT TIME ZONE v_operational_tz)::DATE
      AND first_online_at IS NOT NULL
    ORDER BY first_online_at DESC
    LIMIT 5
  ) LOOP
    RAISE NOTICE '  ID: % | Courier: % | Current: % | Correct: % | First Online: %',
      v_sample_record.id,
      v_sample_record.courier_id,
      v_sample_record.current_date,
      v_sample_record.correct_date,
      v_sample_record.first_online_local;
  END LOOP;
  
  -- Count records that will be updated
  SELECT COUNT(*) INTO v_affected_count
  FROM shift_attendance
  WHERE date != (first_online_at AT TIME ZONE v_operational_tz)::DATE
    AND first_online_at IS NOT NULL;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Found % records with incorrect dates', v_affected_count;
  
  IF v_affected_count = 0 THEN
    RAISE NOTICE 'No records need updating. Migration complete.';
    RETURN;
  END IF;
  
  -- Update records with correct date
  RAISE NOTICE 'Updating records...';
  UPDATE shift_attendance
  SET date = (first_online_at AT TIME ZONE v_operational_tz)::DATE
  WHERE date != (first_online_at AT TIME ZONE v_operational_tz)::DATE
    AND first_online_at IS NOT NULL;
  
  RAISE NOTICE 'Updated % records with correct dates', v_affected_count;
  
  -- Verify the fix
  SELECT COUNT(*) INTO v_affected_count
  FROM shift_attendance
  WHERE date != (first_online_at AT TIME ZONE v_operational_tz)::DATE
    AND first_online_at IS NOT NULL;
  
  IF v_affected_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % records still have incorrect dates', v_affected_count;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== Migration completed successfully ===';
  RAISE NOTICE 'All attendance dates now match operational timezone';
END $$;
