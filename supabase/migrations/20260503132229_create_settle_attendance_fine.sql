-- RPC: Settle (mark as paid) flat fine di shift_attendance
-- Dipanggil saat admin konfirmasi settlement/penagihan
CREATE OR REPLACE FUNCTION public.settle_attendance_fine(
  p_attendance_id UUID,
  p_admin_id      UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_attendance RECORD;
BEGIN
  -- Get attendance record
  SELECT * INTO v_attendance
  FROM shift_attendance
  WHERE id = p_attendance_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Attendance record not found');
  END IF;

  -- Only settle if there's a flat fine
  IF v_attendance.fine_type NOT IN ('flat_major', 'flat_alpha') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only flat fines can be settled');
  END IF;

  -- Mark as paid
  UPDATE shift_attendance SET
    flat_fine_status = 'paid',
    payment_status = 'paid',
    payment_confirmed_at = NOW(),
    payment_confirmed_by = p_admin_id
  WHERE id = p_attendance_id;

  RETURN jsonb_build_object(
    'success', true,
    'attendance_id', p_attendance_id,
    'fine_amount', v_attendance.flat_fine
  );
END;
$$;

COMMENT ON FUNCTION public.settle_attendance_fine(UUID, UUID) IS 
  'Mark flat fine as paid during settlement process. Called by finance when confirming courier payment.';;
