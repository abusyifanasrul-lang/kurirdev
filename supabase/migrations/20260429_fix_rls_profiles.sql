-- Migration: Add trigger to enforce column-level security on profiles
-- Date: 2026-04-29
-- Purpose: Prevent couriers from updating sensitive columns
-- Note: DOES NOT drop any existing RLS policies, adds trigger as extra layer

-- =============================================
-- Step 1: Create trigger function for column-level security
-- =============================================
CREATE OR REPLACE FUNCTION public.check_profile_update_permission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Use get_auth_user_role() for consistency with other policies
  SELECT get_auth_user_role() INTO v_role;
  
  -- If user is inactive, get_auth_user_role returns NULL
  -- Let RLS handle the rejection in this case
  IF v_role IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- If user is a courier, check for sensitive column changes
  IF v_role = 'courier' THEN
    -- Check if any sensitive columns are being modified
    IF (NEW.is_priority_recovery IS DISTINCT FROM OLD.is_priority_recovery) OR
       (NEW.queue_position IS DISTINCT FROM OLD.queue_position) OR
       (NEW.is_active IS DISTINCT FROM OLD.is_active) OR
       (NEW.is_online IS DISTINCT FROM OLD.is_online) OR
       (NEW.queue_joined_at IS DISTINCT FROM OLD.queue_joined_at) THEN
      RAISE EXCEPTION 'Courier tidak diizinkan mengubah field ini';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================
-- Step 2: Create trigger (only if it doesn't exist)
-- =============================================
DROP TRIGGER IF EXISTS enforce_profile_column_security ON public.profiles;

CREATE TRIGGER enforce_profile_column_security
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_profile_update_permission();

-- =============================================
-- Comments for documentation
-- =============================================
COMMENT ON FUNCTION public.check_profile_update_permission() IS 
  'Enforces column-level security on profiles table. Prevents couriers from updating sensitive fields like is_priority_recovery, queue_position, is_active, is_online, queue_joined_at. Uses get_auth_user_role() for consistency with other policies.';

COMMENT ON TRIGGER enforce_profile_column_security ON public.profiles IS 
  'Additional security layer on top of RLS. Blocks couriers from modifying sensitive columns.';
