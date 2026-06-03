-- Migration: Fix apply_attendance_fine to preserve ALPHA status
-- Date: 2026-06-03 08:00:00
-- Purpose: Prevent status change from 'alpha' to 'late_major' when applying fine
--
-- PROBLEM:
--   When admin applies fine to ALPHA status courier (never checked in),
--   the status changes to 'late_major' instead of staying 'alpha'
--   This causes badge to show "MAJOR LATE" instead of "ALPHA"
--
-- ROOT CAUSE:
--   apply_attendance_fine() unconditionally sets status to 'late_minor' or 'late_major'
--   regardless of original status (late vs alpha)
--
-- FIX:
--   Only update status to 'late_minor'/'late_major' when original status is 'late'
--   Preserve 'alpha' status when applying fine to ALPHA attendance
--
-- EXPECTED BEHAVIOR:
--   - Late courier + fine → status becomes 'late_minor' or 'late_major'
--   - Alpha courier + fine → status remains 'alpha' (badge stays gray "ALPHA")
--   - Fine amount and type still applied correctly in both cases

CREATE OR REPLACE FUNCTION public.apply_attendance_fine(
  p_attendance_id UUID,
  p_fine_type     TEXT,  -- 'per_order' atau 'flat_major'
  p_admin_id      UUID,
  p_notes         TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_attendance RECORD;
  v_settings   RECORD;
  v_fine_amount INT;
  v_new_status TEXT;
BEGIN
  SELECT * INTO v_attendance 
  FROM shift_attendance WHERE id = p_attendance_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Record tidak ditemukan');
  END IF;

  SELECT * INTO v_settings FROM settings WHERE id = 'global';

  -- Determine new status: preserve 'alpha', update 'late' → 'late_minor'/'late_major'
  IF v_attendance.status = 'alpha' THEN
    v_new_status := 'alpha';  -- Keep ALPHA status unchanged
  ELSIF p_fine_type = 'per_order' THEN
    v_new_status := 'late_minor';  -- Change LATE → LATE_MINOR
  ELSIF p_fine_type = 'flat_major' THEN
    v_new_status := 'late_major';  -- Change LATE → LATE_MAJOR
  ELSE
    v_new_status := v_attendance.status;  -- Fallback: keep original
  END IF;

  IF p_fine_type = 'per_order' THEN
    v_fine_amount := COALESCE(v_settings.fine_late_minor_amount, 1000);
    
    UPDATE shift_attendance SET
      fine_type      = 'per_order',
      fine_per_order = v_fine_amount,
      status         = v_new_status,  -- Use calculated status
      resolved_by    = p_admin_id,
      resolved_at    = NOW(),
      notes          = p_notes
    WHERE id = p_attendance_id;

    -- Aktifkan flag denda di profil kurir
    UPDATE profiles SET late_fine_active = true 
    WHERE id = v_attendance.courier_id;

  ELSIF p_fine_type = 'flat_major' THEN
    v_fine_amount := COALESCE(v_settings.fine_late_major_amount, 30000);

    UPDATE shift_attendance SET
      fine_type   = 'flat_major',
      flat_fine   = v_fine_amount,
      status      = v_new_status,  -- Use calculated status
      resolved_by = p_admin_id,
      resolved_at = NOW(),
      notes       = p_notes
    WHERE id = p_attendance_id;

    -- Denda flat tidak pakai late_fine_active
    -- (tidak dipotong per order, langsung ke settlement)
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'fine_amount', v_fine_amount,
    'status', v_new_status
  );
END;
$$;

-- ========================================
-- FUNCTION METADATA
-- ========================================
COMMENT ON FUNCTION public.apply_attendance_fine IS 
'Apply attendance fine to courier (per-order or flat major).
Preserves ALPHA status when applying fine - status stays "alpha" instead of changing to "late_major".
For LATE status, changes to "late_minor" (per_order) or "late_major" (flat_major).
Admin can include notes to document reason for fine decision.';

-- ========================================
-- VERIFICATION
-- ========================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 20260603080000 completed successfully';
  RAISE NOTICE '📋 Fixed apply_attendance_fine() to preserve ALPHA status';
  RAISE NOTICE '🎯 ALPHA + fine → status stays "alpha" (gray badge)';
  RAISE NOTICE '🎯 LATE + fine → status becomes "late_minor" or "late_major"';
END $$;
