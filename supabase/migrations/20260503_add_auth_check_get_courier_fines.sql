-- Migration: Add auth check to get_courier_fines function
-- Date: 2026-05-03
-- Purpose: Security - prevent unauthorized access to courier fine data
-- Item: 3.2 dari Pre-Deployment Checklist

CREATE OR REPLACE FUNCTION public.get_courier_fines(
  p_courier_id UUID,
  p_date_from  DATE,
  p_date_to    DATE
)
RETURNS TABLE (
  attendance_id UUID,
  date          DATE,
  status        TEXT,
  fine_type     TEXT,
  flat_fine     INT,
  fine_per_order INT,
  flat_fine_status TEXT,
  cancelled_by  UUID,
  cancel_reason TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
AS $
DECLARE
  v_caller_role TEXT;
BEGIN
  -- Auth check: Only allow if called from service_role OR authorized user
  IF auth.uid() IS NOT NULL THEN
    -- Get caller's role
    SELECT role INTO v_caller_role 
    FROM profiles WHERE id = auth.uid();
    
    -- Courier can only view their own fine data
    IF v_caller_role = 'courier' AND auth.uid() != p_courier_id THEN
      RAISE EXCEPTION 'Unauthorized: courier can only view own fine data';
    END IF;
    
    -- Only owner, admin_kurir, finance, and courier can access this function
    IF v_caller_role NOT IN ('owner', 'admin_kurir', 'finance', 'courier') THEN
      RAISE EXCEPTION 'Unauthorized: insufficient role to view fine data';
    END IF;
  END IF;
  
  -- Return fine data
  RETURN QUERY
  SELECT
    sa.id,
    sa.date,
    sa.status,
    sa.fine_type,
    sa.flat_fine,
    sa.fine_per_order,
    sa.flat_fine_status,
    sa.cancelled_by,
    sa.cancel_reason
  FROM shift_attendance sa
  WHERE sa.courier_id = p_courier_id
    AND sa.date BETWEEN p_date_from AND p_date_to
    AND sa.fine_type IS NOT NULL
    AND sa.flat_fine_status != 'cancelled'
  ORDER BY sa.date DESC;
END;
$;

COMMENT ON FUNCTION public.get_courier_fines IS 'Get courier fine data with auth check - couriers can only view their own data, admins can view all';
