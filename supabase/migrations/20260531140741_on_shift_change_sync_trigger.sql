-- Migration: Attendance System Overhaul - on_shift_change_sync_cron Trigger
-- Date: 2026-05-30
-- Description: Create trigger to auto-sync cron jobs when shifts change

CREATE OR REPLACE FUNCTION public.on_shift_change_sync_cron()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM sync_shift_cron_jobs();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.on_shift_change_sync_cron IS 'Trigger function to sync cron jobs when shifts change';

DROP TRIGGER IF EXISTS shifts_sync_cron_trigger ON shifts;

CREATE TRIGGER shifts_sync_cron_trigger
  AFTER INSERT OR UPDATE OR DELETE ON shifts
  FOR EACH STATEMENT
  EXECUTE FUNCTION on_shift_change_sync_cron();

COMMENT ON TRIGGER shifts_sync_cron_trigger ON shifts IS 'Auto-syncs cron jobs when shifts are created, updated, or deactivated';;
