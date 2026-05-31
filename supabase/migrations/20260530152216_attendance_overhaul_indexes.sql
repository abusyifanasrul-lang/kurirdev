-- Migration: Attendance System Overhaul - Part 3: Performance Indexes
-- Date: 2026-05-30
-- Description: Create indexes for attendance queries, cron jobs, and holidays

-- ============================================================================
-- Indexes: shift_attendance - General Queries
-- ============================================================================

-- Courier attendance history queries
CREATE INDEX IF NOT EXISTS idx_shift_attendance_courier_date 
  ON shift_attendance(courier_id, date);

-- Shift-based attendance queries
CREATE INDEX IF NOT EXISTS idx_shift_attendance_shift_date 
  ON shift_attendance(shift_id, date);

-- Status-based filtering
CREATE INDEX IF NOT EXISTS idx_shift_attendance_status 
  ON shift_attendance(status);

-- Audit trail queries
CREATE INDEX IF NOT EXISTS idx_shift_attendance_resolved_by 
  ON shift_attendance(resolved_by);

-- ============================================================================
-- Indexes: shift_attendance - Partial Indexes for Admin UI
-- ============================================================================

-- Pending Review Tab: late records without fine applied
CREATE INDEX IF NOT EXISTS idx_shift_attendance_pending_review 
  ON shift_attendance(status, fine_type, date DESC) 
  WHERE status = 'late' AND fine_type IS NULL;

-- Pending Alpha Tab: alpha records without admin verification
CREATE INDEX IF NOT EXISTS idx_shift_attendance_pending_alpha 
  ON shift_attendance(status, resolved_by, date DESC) 
  WHERE status = 'alpha' AND resolved_by IS NULL;

-- ============================================================================
-- Indexes: cron_jobs
-- ============================================================================

-- Lookup cron jobs by shift
CREATE INDEX IF NOT EXISTS idx_cron_jobs_shift_id 
  ON cron_jobs(shift_id);

-- Filter active cron jobs
CREATE INDEX IF NOT EXISTS idx_cron_jobs_active 
  ON cron_jobs(is_active) 
  WHERE is_active = true;

-- ============================================================================
-- Indexes: cron_execution_logs
-- ============================================================================

-- Recent execution history (for monitoring dashboard)
CREATE INDEX IF NOT EXISTS idx_cron_logs_executed_at 
  ON cron_execution_logs(executed_at DESC);

-- Failed job detection
CREATE INDEX IF NOT EXISTS idx_cron_logs_status 
  ON cron_execution_logs(status, executed_at DESC) 
  WHERE status = 'failed';

-- Job type analysis
CREATE INDEX IF NOT EXISTS idx_cron_logs_job_type 
  ON cron_execution_logs(job_type, executed_at DESC);

-- ============================================================================
-- Indexes: holidays
-- ============================================================================

-- Holiday check during attendance creation
CREATE INDEX IF NOT EXISTS idx_holidays_date 
  ON holidays(date) 
  WHERE is_active = true;

-- ============================================================================
-- Indexes: shift_overrides
-- ============================================================================

-- Date-based override lookup
CREATE INDEX IF NOT EXISTS idx_shift_overrides_date 
  ON shift_overrides(date);

-- Replacement courier lookup
CREATE INDEX IF NOT EXISTS idx_shift_overrides_replacement 
  ON shift_overrides(replacement_courier_id, date);

-- ============================================================================
-- Verification & Performance Analysis
-- ============================================================================
DO $$
DECLARE
  v_index_count INTEGER;
BEGIN
  -- Count indexes created
  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%attendance%' 
     OR indexname LIKE 'idx_cron%'
     OR indexname LIKE 'idx_holidays%'
     OR indexname LIKE 'idx_shift_overrides%';
  
  RAISE NOTICE 'Migration 20260530152216 completed successfully';
  RAISE NOTICE 'Created % indexes for attendance system', v_index_count;
  RAISE NOTICE 'Indexes include: general queries, partial indexes for admin UI, cron monitoring, and holiday checks';
END $$;

-- ============================================================================
-- Index Usage Recommendations
-- ============================================================================
COMMENT ON INDEX idx_shift_attendance_pending_review IS 
  'Partial index for Pending Review tab - only indexes unresolved late records';

COMMENT ON INDEX idx_shift_attendance_pending_alpha IS 
  'Partial index for Pending Alpha tab - only indexes unverified alpha records';

COMMENT ON INDEX idx_cron_logs_status IS 
  'Partial index for failed job monitoring - only indexes failed executions';

COMMENT ON INDEX idx_holidays_date IS 
  'Partial index for holiday checks - only indexes active holidays';
