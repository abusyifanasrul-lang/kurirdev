-- Migration: Attendance System Overhaul - Initialize Cron Jobs
-- Date: 2026-05-30
-- Description: Initialize pg_cron jobs for attendance system
-- Task: Wave 3 - Task 12
-- Requirement: 7 (Dynamic Shift Management), 9 (Late Minutes Update)

-- ============================================================================
-- Initialize Shift-Based Cron Jobs
-- Purpose: Run sync_shift_cron_jobs() to create cron jobs for all active shifts
-- ============================================================================

DO $$
BEGIN
  -- Sync all shift cron jobs
  PERFORM sync_shift_cron_jobs();
  
  RAISE NOTICE 'Initialized shift-based cron jobs (start and end) for all active shifts';
END $$;

-- ============================================================================
-- Schedule update-late-minutes Cron Job
-- Purpose: Run every minute to update late minutes in real-time
-- ============================================================================

SELECT cron.schedule(
  'update-late-minutes',
  '* * * * *',  -- Every minute
  'SELECT update_late_minutes()'
);

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
DECLARE
  v_cron_count INTEGER;
BEGIN
  -- Count active cron jobs
  SELECT COUNT(*) INTO v_cron_count
  FROM cron.job
  WHERE jobname LIKE 'shift-%' OR jobname = 'update-late-minutes';
  
  RAISE NOTICE 'Migration 20260530152308 completed successfully';
  RAISE NOTICE 'Initialized % cron jobs', v_cron_count;
  RAISE NOTICE 'Scheduled update-late-minutes to run every minute';
  RAISE NOTICE 'Task 12 (Cron Initialization) - COMPLETE';
END $$;

-- ============================================================================
-- Monitoring Query (for reference)
-- ============================================================================
COMMENT ON EXTENSION pg_cron IS 
  'Monitor cron jobs with: SELECT * FROM cron.job; SELECT * FROM cron_execution_logs ORDER BY executed_at DESC LIMIT 20;';
