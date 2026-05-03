-- Migration: Create settle_attendance_fine RPC function
-- Purpose: Marks flat fine as paid during settlement
-- Used in: src/stores/useAttendanceStore.ts

CREATE OR REPLACE FUNCTION settle_attendance_fine(
  p_attendance_id uuid,
  p_admin_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the attendance record to mark fine as paid
  UPDATE shift_attendance
  SET 
    payment_status = 'paid',
    updated_at = NOW()
  WHERE id = p_attendance_id;

  -- Log the settlement action (optional - can be added if needed)
  -- INSERT INTO attendance_settlement_logs (attendance_id, admin_id, settled_at)
  -- VALUES (p_attendance_id, p_admin_id, NOW());
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION settle_attendance_fine(uuid, uuid) TO authenticated;

-- Add comment
COMMENT ON FUNCTION settle_attendance_fine IS 'Marks a flat fine as paid during settlement process';
