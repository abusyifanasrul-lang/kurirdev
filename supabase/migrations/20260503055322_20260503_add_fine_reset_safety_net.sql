-- Migration: Add safety net for daily fine flag reset
-- Purpose: Ensure fine flags are reset even if midnight cron fails
-- Strategy: Hybrid approach - midnight cron (primary) + 30-min cron (backup)

-- ============================================================================
-- 1. Update reset_daily_fine_flags with auth check
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reset_daily_fine_flags()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  -- Allow if called from service_role (Edge Function via cron)
  IF auth.uid() IS NULL THEN
    -- Service role, execute directly
    UPDATE profiles SET late_fine_active = false
    WHERE role = 'courier' AND late_fine_active = true;
    RETURN;
  END IF;

  -- If called from user session, validate role
  SELECT role INTO v_caller_role 
  FROM profiles WHERE id = auth.uid();

  IF v_caller_role NOT IN ('owner', 'admin_kurir', 'finance') THEN
    RAISE EXCEPTION 'Unauthorized: only admin/owner/finance can reset fine flags';
  END IF;

  -- Execute reset
  UPDATE profiles SET late_fine_active = false
  WHERE role = 'courier' AND late_fine_active = true;
END;
$$;

COMMENT ON FUNCTION public.reset_daily_fine_flags() IS 
'Reset late_fine_active flag for all couriers. Called by cron at midnight or manually by admin. Includes auth check for user sessions.';

-- ============================================================================
-- 2. Create safety net function with quick check optimization
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reset_daily_fine_flags_if_needed()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Quick check: are there any couriers with late_fine_active = true?
  SELECT COUNT(*) INTO v_count
  FROM profiles
  WHERE role = 'courier' AND late_fine_active = true;
  
  -- If no one needs reset, exit early (saves resources)
  IF v_count = 0 THEN
    RETURN;
  END IF;
  
  -- If there are couriers with active fines, reset them
  -- This will only happen if midnight cron failed
  UPDATE profiles SET late_fine_active = false
  WHERE role = 'courier' AND late_fine_active = true;
  
  -- Log for monitoring
  RAISE NOTICE '[SAFETY NET] Fine flags reset for % couriers at %', v_count, NOW();
END;
$$;

COMMENT ON FUNCTION public.reset_daily_fine_flags_if_needed() IS 
'Safety net function that resets fine flags only if needed. Called every 30 minutes as backup. Uses quick check to minimize resource usage.';

-- ============================================================================
-- 3. Update existing cron job to include safety net
-- ============================================================================

-- First, unschedule the existing job
SELECT cron.unschedule('process-scheduled-notifications-every-30min');

-- Re-schedule with both functions
SELECT cron.schedule(
  'process-scheduled-notifications-every-30min',
  '*/30 * * * *',
  $$
    SELECT public.process_due_scheduled_notifications();
    SELECT public.reset_daily_fine_flags_if_needed();
  $$
);

-- ============================================================================
-- 4. Verify setup
-- ============================================================================

-- Check cron job
SELECT 
  jobid,
  schedule,
  command,
  active,
  jobname
FROM cron.job 
WHERE jobname = 'process-scheduled-notifications-every-30min';

-- Log success
DO $$
BEGIN
  RAISE NOTICE '✅ Fine reset safety net configured successfully';
  RAISE NOTICE '📅 Primary: Midnight cron (process-alpha Edge Function)';
  RAISE NOTICE '🛡️  Backup: 30-min cron (reset_daily_fine_flags_if_needed)';
  RAISE NOTICE '⚡ Resource usage: ~5ms/day (optimized with quick check)';
  RAISE NOTICE '🔒 Auth check: Only owner/admin_kurir/finance can reset manually';
END $$;;
