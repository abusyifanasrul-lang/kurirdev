-- Migration: Add notes parameter to apply_attendance_fine function
-- Date: 2026-05-09
-- Purpose: Bug Fix 5 - Add admin notes parameter for fine decisions
-- Spec: courier-shift-settlement-fix
-- Task: 5.3.1 Update database function
--
-- Bug Description:
--   The apply_attendance_fine function does not accept notes parameter
--   Admin cannot document reason for fine decision
--   Inconsistent with excuse_attendance which accepts notes
--
-- Fix:
--   Add p_notes TEXT DEFAULT NULL parameter to apply_attendance_fine
--   Update function to save notes to shift_attendance.notes column
--   Preserve all existing fine application logic

CREATE OR REPLACE FUNCTION public.apply_attendance_fine(
  p_attendance_id UUID,
  p_fine_type     TEXT,  -- 'per_order' atau 'flat_major'
  p_admin_id      UUID,
  p_notes         TEXT DEFAULT NULL  -- NEW: Admin notes for fine decision
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_attendance RECORD;
  v_settings   RECORD;
  v_fine_amount INT;
BEGIN
  SELECT * INTO v_attendance 
  FROM shift_attendance WHERE id = p_attendance_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Record tidak ditemukan');
  END IF;

  SELECT * INTO v_settings FROM settings WHERE id = 'global';

  IF p_fine_type = 'per_order' THEN
    v_fine_amount := COALESCE(v_settings.fine_late_minor_amount, 1000);
    
    UPDATE shift_attendance SET
      fine_type      = 'per_order',
      fine_per_order = v_fine_amount,
      status         = 'late_minor',
      resolved_by    = p_admin_id,
      resolved_at    = NOW(),
      notes          = p_notes  -- NEW: Save admin notes
    WHERE id = p_attendance_id;

    -- Aktifkan flag denda di profil kurir
    UPDATE profiles SET late_fine_active = true 
    WHERE id = v_attendance.courier_id;

  ELSIF p_fine_type = 'flat_major' THEN
    v_fine_amount := COALESCE(v_settings.fine_late_major_amount, 30000);

    UPDATE shift_attendance SET
      fine_type   = 'flat_major',
      flat_fine   = v_fine_amount,
      status      = 'late_major',
      resolved_by = p_admin_id,
      resolved_at = NOW(),
      notes       = p_notes  -- NEW: Save admin notes
    WHERE id = p_attendance_id;

    -- Denda flat tidak pakai late_fine_active
    -- (tidak dipotong per order, langsung ke settlement)
  END IF;

  RETURN jsonb_build_object('success', true, 'fine_amount', v_fine_amount);
END;
$$;

-- Drop old function first (to avoid "function name not unique" error)
DROP FUNCTION IF EXISTS public.apply_attendance_fine(UUID, TEXT, UUID);

-- ========================================
-- FUNCTION METADATA
-- ========================================
COMMENT ON FUNCTION public.apply_attendance_fine IS 
'Apply attendance fine to courier (per-order or flat major).
Admin can now input notes to document reason for fine decision.
Notes parameter is optional (DEFAULT NULL) for backward compatibility.
Created for Bug Fix 5: Missing Admin Notes for Fine Decisions';

-- ========================================
-- VERIFICATION NOTES
-- ========================================
-- After applying this migration:
-- 1. Function signature includes p_notes parameter
-- 2. Notes are saved to shift_attendance.notes column
-- 3. Backward compatible: calling without notes still works
-- 4. Consistent with excuse_attendance which also accepts notes
-- 5. All existing fine application logic preserved
