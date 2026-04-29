-- Migration: Create consolidated RPC for order assignment + queue rotation
-- Date: 2026-04-29
-- Purpose: Atomic assignment to prevent race conditions between two network calls

CREATE OR REPLACE FUNCTION public.assign_order_and_rotate(
  p_order_id UUID,
  p_courier_id UUID,
  p_courier_name TEXT,
  p_admin_id UUID,
  p_admin_name TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Step 1: Assign order (atomic with guard)
  UPDATE public.orders
  SET courier_id = p_courier_id,
      status = 'assigned',
      assigned_at = NOW(),
      updated_at = NOW(),
      assigned_by = p_admin_id,
      assigner_name = p_admin_name,
      courier_name = p_courier_name,
      notes = COALESCE(p_notes, notes)
  WHERE id = p_order_id
    AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order tidak tersedia untuk di-assign (mungkin sudah diassign)';
  END IF;
  
  -- Step 2: Reset priority recovery
  UPDATE public.profiles
  SET is_priority_recovery = false
  WHERE id = p_courier_id;
  
  -- Step 3: Rotate queue (pindah ke akhir)
  UPDATE public.profiles
  SET queue_joined_at = NOW()
  WHERE id = p_courier_id;
  
  -- Step 4: Log tracking
  INSERT INTO public.tracking_logs
    (order_id, status, changed_by, changed_by_name, notes, changed_at)
  VALUES
    (p_order_id, 'assigned', p_admin_id, p_admin_name, 
     COALESCE(p_notes, 'Assigned to ' || p_courier_name), NOW());
END;
$$;

COMMENT ON FUNCTION public.assign_order_and_rotate(UUID, UUID, TEXT, UUID, TEXT, TEXT) IS 
  'Atomically assigns order to courier, resets priority recovery, rotates queue, and logs tracking. Replaces separate assignCourier + rotateQueue calls.';
