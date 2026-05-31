-- Migration: Attendance System Overhaul - on_shift_change_sync_cron Trigger
-- Date: 2026-05-30
-- Description: Create trigger to auto-sync cron jobs when shifts change
-- Task: Wave 2 - Task 10
-- Requirement: 7 (Dynamic Shift Management with Cron Sync)

-- ============================================================================
-- Trigger Function: on_shift_change_sync_cron
-- Purpose: Automatically sync cron jobs when shifts are created, updated, or deactivated
-- ============================================================================

CREATE OR REPLACE FUNCTION public.on_shift_change_sync_cron()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Call sync_shift_cron_jobs to update pg_cron jobs
  PERFORM sync_shift_cron_jobs();
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.on_shift_change_sync_cron IS 
  'Trigger function to sync cron jobs when shifts change';

-- ============================================================================
-- Trigger: shifts_sync_cron_trigger
-- Purpose: Fire on INSERT, UPDATE, DELETE of shifts table
-- ============================================================================

DROP TRIGGER IF EXISTS shifts_sync_cron_trigger ON shifts;

CREATE TRIGGER shifts_sync_cron_trigger
  AFTER INSERT OR UPDATE OR DELETE ON shifts
  FOR EACH STATEMENT
  EXECUTE FUNCTION on_shift_change_sync_cron();

COMMENT ON TRIGGER shifts_sync_cron_trigger ON shifts IS 
  'Auto-syncs cron jobs when shifts are created, updated, or deactivated';

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 20260530152306 completed successfully';
  RAISE NOTICE 'Created trigger function: on_shift_change_sync_cron()';
  RAISE NOTICE 'Created trigger: shifts_sync_cron_trigger on shifts table';
  RAISE NOTICE 'Task 10 (Auto Cron Sync Trigger) - COMPLETE';
END $$;
