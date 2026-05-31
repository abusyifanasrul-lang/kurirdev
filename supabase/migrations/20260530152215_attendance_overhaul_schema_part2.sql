-- Migration: Attendance System Overhaul - Part 2: Modify Existing Tables
-- Date: 2026-05-30
-- Description: Add audit trail and shift end columns to shift_attendance, add settings columns

-- ============================================================================
-- Table: shift_attendance - Add Audit Trail Columns
-- ============================================================================
ALTER TABLE public.shift_attendance
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.shift_attendance.resolved_by IS 'Admin who reviewed and resolved this attendance record';
COMMENT ON COLUMN public.shift_attendance.resolved_at IS 'Timestamp when admin resolved this record';
COMMENT ON COLUMN public.shift_attendance.notes IS 'Admin notes explaining fine or excuse decision';

-- ============================================================================
-- Table: shift_attendance - Add Shift End Columns
-- ============================================================================
ALTER TABLE public.shift_attendance
  ADD COLUMN IF NOT EXISTS last_online_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shift_duration INTEGER,
  ADD COLUMN IF NOT EXISTS duration_status TEXT CHECK (duration_status IN ('normal', 'early_finish', 'overtime'));

COMMENT ON COLUMN public.shift_attendance.last_online_at IS 'Timestamp when courier ended shift';
COMMENT ON COLUMN public.shift_attendance.shift_duration IS 'Actual shift duration in minutes';
COMMENT ON COLUMN public.shift_attendance.duration_status IS 'Duration status: normal (80-120%), early_finish (<80%), overtime (>120%)';

-- ============================================================================
-- Table: settings - Add Attendance Configuration Columns
-- ============================================================================
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS check_in_window_minutes INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS fine_late_minor_amount INTEGER DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS fine_late_major_minutes INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS fine_late_major_amount INTEGER DEFAULT 30000,
  ADD COLUMN IF NOT EXISTS fine_alpha_amount INTEGER DEFAULT 50000;

COMMENT ON COLUMN public.settings.check_in_window_minutes IS 'Minutes before shift start when check-in is allowed (default 60)';
COMMENT ON COLUMN public.settings.fine_late_minor_amount IS 'Per-order fine for late < 60 minutes (default Rp 1,000)';
COMMENT ON COLUMN public.settings.fine_late_major_minutes IS 'Threshold for major late fine (default 60 minutes)';
COMMENT ON COLUMN public.settings.fine_late_major_amount IS 'Flat fine for late >= 60 minutes (default Rp 30,000)';
COMMENT ON COLUMN public.settings.fine_alpha_amount IS 'Flat fine for alpha (never checked in) (default Rp 50,000)';

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 20260530152215 completed successfully';
  RAISE NOTICE 'Added columns to shift_attendance: resolved_by, resolved_at, notes, last_online_at, shift_duration, duration_status';
  RAISE NOTICE 'Added columns to settings: check_in_window_minutes, fine_late_minor_amount, fine_late_major_minutes, fine_late_major_amount, fine_alpha_amount';
END $$;
