-- Migration: Create get_courier_fines_complete function
-- Date: 2026-05-09
-- Purpose: Bug Fix 1 - Return complete fine data including both flat fines and per-order fines
-- Spec: courier-shift-settlement-fix
-- Task: 1.3.1 Create new RPC function get_courier_fines_complete
--
-- Bug Description:
--   The existing get_courier_fines function only returns flat fines from shift_attendance table.
--   It does NOT include per-order fines stored in orders.fine_deducted column.
--   This causes incomplete financial reports for Finance and Admin.
--
-- Fix:
--   Create new function get_courier_fines_complete that:
--   1. Queries flat fines from shift_attendance (preserves existing logic)
--   2. Queries per-order fines from orders table (WHERE fine_deducted > 0)
--   3. Returns both in separate JSON arrays with totals
--   4. Preserves auth rules (courier can only view own data, admins can view all)
--
-- Preservation:
--   - Auth rules identical to get_courier_fines
--   - Date range filtering identical
--   - Cancelled fine exclusion identical
--   - Existing get_courier_fines function remains unchanged

CREATE OR REPLACE FUNCTION public.get_courier_fines_complete(
  p_courier_id UUID,
  p_date_from  DATE,
  p_date_to    DATE
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_caller_role TEXT;
  v_flat_fines JSONB;
  v_per_order_fines JSONB;
  v_total_flat_fines INT;
  v_total_per_order_fines INT;
  v_grand_total INT;
BEGIN
  -- ========================================
  -- AUTH CHECK (Preserved from get_courier_fines)
  -- ========================================
  -- Only allow if called from service_role OR authorized user
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
  
  -- ========================================
  -- QUERY FLAT FINES (Preserved from get_courier_fines)
  -- ========================================
  -- Query shift_attendance for flat fines (fine_type IN ('flat_major', 'flat_alpha'))
  -- Exclude cancelled fines (flat_fine_status != 'cancelled')
  -- Apply date range filter
  SELECT 
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'attendance_id', sa.id,
        'date', sa.date,
        'fine_type', sa.fine_type,
        'amount', sa.flat_fine,
        'status', sa.flat_fine_status,
        'late_minutes', sa.late_minutes,
        'shift_status', sa.status,
        'notes', sa.notes,
        'resolved_by', sa.resolved_by,
        'resolved_at', sa.resolved_at
      )
      ORDER BY sa.date DESC
    ), '[]'::jsonb),
    COALESCE(SUM(sa.flat_fine), 0)
  INTO v_flat_fines, v_total_flat_fines
  FROM shift_attendance sa
  WHERE sa.courier_id = p_courier_id
    AND sa.date BETWEEN p_date_from AND p_date_to
    AND sa.fine_type IS NOT NULL
    AND sa.flat_fine_status != 'cancelled';
  
  -- ========================================
  -- QUERY PER-ORDER FINES (New functionality)
  -- ========================================
  -- Query orders table for per-order fines (WHERE fine_deducted > 0)
  -- Join with courier_id and apply date range filter on actual_delivery_time
  -- Only include delivered orders (status = 'delivered')
  SELECT 
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'order_id', o.id,
        'order_number', o.order_number,
        'date', DATE(o.actual_delivery_time),
        'amount', o.fine_deducted,
        'payment_status', o.payment_status,
        'actual_delivery_time', o.actual_delivery_time,
        'customer_name', o.customer_name,
        'customer_address', o.customer_address
      )
      ORDER BY o.actual_delivery_time DESC
    ), '[]'::jsonb),
    COALESCE(SUM(o.fine_deducted), 0)
  INTO v_per_order_fines, v_total_per_order_fines
  FROM orders o
  WHERE o.courier_id = p_courier_id
    AND o.status = 'delivered'
    AND o.fine_deducted > 0
    AND DATE(o.actual_delivery_time) BETWEEN p_date_from AND p_date_to;
  
  -- ========================================
  -- CALCULATE GRAND TOTAL
  -- ========================================
  v_grand_total := v_total_flat_fines + v_total_per_order_fines;
  
  -- ========================================
  -- RETURN COMPLETE FINE DATA
  -- ========================================
  -- Return structure with both flat_fines and per_order_fines arrays
  -- Include separate totals and grand total
  RETURN jsonb_build_object(
    'flat_fines', v_flat_fines,
    'per_order_fines', v_per_order_fines,
    'total_flat_fines', v_total_flat_fines,
    'total_per_order_fines', v_total_per_order_fines,
    'grand_total', v_grand_total,
    'date_from', p_date_from,
    'date_to', p_date_to,
    'courier_id', p_courier_id
  );
END;
$$;

-- ========================================
-- FUNCTION METADATA
-- ========================================
COMMENT ON FUNCTION public.get_courier_fines_complete IS 
'Get complete courier fine data including both flat fines (from shift_attendance) and per-order fines (from orders.fine_deducted). 
Auth rules: couriers can only view their own data, admins (owner, admin_kurir, finance) can view all.
Returns JSON with flat_fines array, per_order_fines array, and totals.
Created for Bug Fix 1: Incomplete Fine Query';

-- ========================================
-- VERIFICATION NOTES
-- ========================================
-- After applying this migration:
-- 1. Run bug condition exploration test (task 1.1) - should now PASS
-- 2. Run preservation property tests (task 1.2) - should still PASS
-- 3. Verify auth rules work correctly:
--    - Courier can only query own data
--    - Admin/Finance can query any courier
-- 4. Verify date range filtering works
-- 5. Verify cancelled fines are excluded
-- 6. Verify both flat and per-order fines are returned with correct totals;
