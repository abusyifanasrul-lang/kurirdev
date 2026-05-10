-- Migration: Fix get_courier_fines_complete to exclude per_order fine records from flat_fines array
-- Date: 2026-05-10
-- Purpose: Bug Fix - Flat fines query should only include flat_major and flat_alpha, not per_order
--
-- Issue:
--   The original query used `sa.fine_type IS NOT NULL` which includes per_order fine records
--   This caused per_order fine records (with flat_fine = 0) to appear in flat_fines array
--   While total_flat_fines was correct (sum of 0), the array contained incorrect records
--
-- Fix:
--   Change filter from `sa.fine_type IS NOT NULL` to `sa.fine_type IN ('flat_major', 'flat_alpha')`
--   This ensures only actual flat fines are included in the flat_fines array
--
-- Impact:
--   - flat_fines array now only contains flat_major and flat_alpha records
--   - per_order fine records are excluded from flat_fines array
--   - total_flat_fines remains correct (no change in calculation)
--   - per_order_fines array remains unchanged (still queries orders table)

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
  IF auth.uid() IS NOT NULL THEN
    SELECT role INTO v_caller_role 
    FROM profiles WHERE id = auth.uid();
    
    IF v_caller_role = 'courier' AND auth.uid() != p_courier_id THEN
      RAISE EXCEPTION 'Unauthorized: courier can only view own fine data';
    END IF;
    
    IF v_caller_role NOT IN ('owner', 'admin_kurir', 'finance', 'courier') THEN
      RAISE EXCEPTION 'Unauthorized: insufficient role to view fine data';
    END IF;
  END IF;
  
  -- ========================================
  -- QUERY FLAT FINES (flat_major and flat_alpha ONLY)
  -- ========================================
  -- FIXED: Changed from `sa.fine_type IS NOT NULL` to `sa.fine_type IN ('flat_major', 'flat_alpha')`
  -- This excludes per_order fine records from flat_fines array
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
    AND sa.fine_type IN ('flat_major', 'flat_alpha')  -- FIXED: Only flat fines
    AND sa.flat_fine_status != 'cancelled';
  
  -- ========================================
  -- QUERY PER-ORDER FINES (Unchanged)
  -- ========================================
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

COMMENT ON FUNCTION public.get_courier_fines_complete IS 
'Get complete courier fine data including both flat fines (flat_major, flat_alpha) and per-order fines (from orders.fine_deducted). 
Auth rules: couriers can only view their own data, admins (owner, admin_kurir, finance) can view all.
Returns JSON with flat_fines array (flat_major + flat_alpha only), per_order_fines array, and totals.
Fixed: Excludes per_order fine records from flat_fines array.';
