-- Migration: Fix assign_order_and_rotate RPC signature
-- Date: 2026-05-08
-- Purpose: Add missing parameters for audit trail (courier_name, admin_name, notes)
-- Issue: Frontend sends 6 parameters but RPC only accepts 3

-- Drop old version
DROP FUNCTION IF EXISTS public.assign_order_and_rotate(uuid, uuid, uuid);

-- Create new version with correct signature matching documentation
CREATE OR REPLACE FUNCTION public.assign_order_and_rotate(
  p_order_id    UUID,
  p_courier_id  UUID,
  p_courier_name TEXT,
  p_admin_id    UUID,
  p_admin_name  TEXT,
  p_notes       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $
DECLARE
  v_result JSONB;
BEGIN
  -- Step 1: Assign order (guard: hanya jika masih pending)
  UPDATE public.orders
  SET courier_id   = p_courier_id,
      courier_name = p_courier_name,
      status       = 'assigned',
      assigned_at  = NOW(),
      assigned_by  = p_admin_id
  WHERE id = p_order_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order tidak tersedia untuk di-assign';
  END IF;

  -- Step 2: Reset priority recovery
  UPDATE public.profiles
  SET is_priority_recovery = false
  WHERE id = p_courier_id;

  -- Step 3: Rotate queue (pindah ke belakang antrian)
  PERFORM rotate_courier_queue(p_courier_id);

  -- Step 4: Log tracking
  INSERT INTO public.tracking_logs (
    order_id, status, changed_by, changed_by_name, notes, changed_at
  ) VALUES (
    p_order_id, 'assigned', p_admin_id, p_admin_name, p_notes, NOW()
  );

  SELECT jsonb_build_object('success', true, 'order_id', p_order_id) INTO v_result;
  RETURN v_result;
END;
$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.assign_order_and_rotate(UUID, UUID, TEXT, UUID, TEXT, TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.assign_order_and_rotate IS 'Assigns order to courier and rotates queue atomically with full audit trail';
