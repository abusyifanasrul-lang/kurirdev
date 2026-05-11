-- Fix get_courier_fines_complete function to include 'admin' role in whitelist
-- This fixes the "Unauthorized: insufficient role to view fine data" error

CREATE OR REPLACE FUNCTION get_courier_fines_complete(
  p_courier_id UUID,
  p_date_from DATE,
  p_date_to DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role TEXT;
  v_flat_fines JSONB;
  v_per_order_fines JSONB;
  v_total_flat_fines INT;
  v_total_per_order_fines INT;
  v_grand_total INT;
BEGIN
  -- AUTH CHECK
  IF auth.uid() IS NOT NULL THEN
    SELECT role INTO v_caller_role 
    FROM profiles WHERE id = auth.uid();
    
    IF v_caller_role = 'courier' AND auth.uid() != p_courier_id THEN
      RAISE EXCEPTION 'Unauthorized: courier can only view own fine data';
    END IF;
    
    -- FIX: Add 'admin' to the whitelist (was missing before)
    IF v_caller_role NOT IN ('owner', 'admin', 'admin_kurir', 'finance', 'courier') THEN
      RAISE EXCEPTION 'Unauthorized: insufficient role to view fine data';
    END IF;
  END IF;
  
  -- QUERY FLAT FINES (flat_major and flat_alpha ONLY)
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
    AND sa.fine_type IN ('flat_major', 'flat_alpha')
    AND sa.flat_fine_status != 'cancelled';
  
  -- QUERY PER-ORDER FINES
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
  
  v_grand_total := v_total_flat_fines + v_total_per_order_fines;
  
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
