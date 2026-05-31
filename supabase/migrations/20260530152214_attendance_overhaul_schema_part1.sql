-- Migration: Attendance System Overhaul - Part 1: New Tables
-- Date: 2026-05-30
-- Description: Create new tables for cron jobs, execution logs, holidays, and shift overrides
-- Task: Wave 1 - Database Foundation (Task 1)
-- Requirements: 7, 14, 16, 17

-- ============================================================================
-- Table: cron_jobs
-- Purpose: Track pg_cron jobs for each shift (start and end)
-- Requirement: 7 (Dynamic Shift Management with Cron Sync)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cron_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('start', 'end')),
  scheduled_time TIME NOT NULL,
  cron_job_name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(shift_id, job_type)
);

COMMENT ON TABLE public.cron_jobs IS 'Tracks pg_cron jobs for shift start and end times';
COMMENT ON COLUMN public.cron_jobs.job_type IS 'Type of cron job: start (shift start) or end (shift end)';
COMMENT ON COLUMN public.cron_jobs.scheduled_time IS 'Time when cron job should run (in operational timezone)';
COMMENT ON COLUMN public.cron_jobs.cron_job_name IS 'Unique name used in pg_cron.schedule()';

-- Indexes for cron_jobs
CREATE INDEX IF NOT EXISTS idx_cron_jobs_shift_id ON public.cron_jobs(shift_id);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_active ON public.cron_jobs(is_active) WHERE is_active = true;

-- ============================================================================
-- Table: cron_execution_logs
-- Purpose: Log all cron job executions for monitoring and debugging
-- Requirement: 14 (Cron Job Monitoring and Logging)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cron_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  executed_at TIMESTAMPTZ DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  records_affected INTEGER DEFAULT 0,
  error_message TEXT,
  execution_time_ms INTEGER
);

COMMENT ON TABLE public.cron_execution_logs IS 'Logs all cron job executions for monitoring';
COMMENT ON COLUMN public.cron_execution_logs.execution_time_ms IS 'Execution time in milliseconds';

-- Indexes for cron_execution_logs
CREATE INDEX IF NOT EXISTS idx_cron_logs_executed_at ON public.cron_execution_logs(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_logs_status ON public.cron_execution_logs(status) WHERE status = 'failed';

-- ============================================================================
-- Table: holidays
-- Purpose: Track holidays to skip attendance creation
-- Requirement: 16 (Holiday Management)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_national BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

COMMENT ON TABLE public.holidays IS 'Tracks holidays when attendance should not be created';
COMMENT ON COLUMN public.holidays.is_national IS 'True if national holiday, false if company-specific';
COMMENT ON COLUMN public.holidays.is_active IS 'Can be deactivated if mistakenly created';

-- Indexes for holidays
CREATE INDEX IF NOT EXISTS idx_holidays_date ON public.holidays(date) WHERE is_active = true;

-- ============================================================================
-- Table: shift_overrides
-- Purpose: Handle temporary shift swaps and replacements
-- Requirement: 17 (Shift Override for Temporary Replacements)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.shift_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  original_courier_id UUID NOT NULL REFERENCES profiles(id),
  replacement_courier_id UUID NOT NULL REFERENCES profiles(id),
  original_shift_id UUID NOT NULL REFERENCES shifts(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id),
  
  UNIQUE(date, replacement_courier_id)
);

COMMENT ON TABLE public.shift_overrides IS 'Temporary shift assignments for swaps and replacements';
COMMENT ON COLUMN public.shift_overrides.original_courier_id IS 'Courier who was originally assigned';
COMMENT ON COLUMN public.shift_overrides.replacement_courier_id IS 'Courier who will work the shift';

-- Indexes for shift_overrides
CREATE INDEX IF NOT EXISTS idx_shift_overrides_date ON public.shift_overrides(date);
CREATE INDEX IF NOT EXISTS idx_shift_overrides_replacement ON public.shift_overrides(replacement_courier_id);

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 20260530152214 completed successfully';
  RAISE NOTICE 'Created tables: cron_jobs, cron_execution_logs, holidays, shift_overrides';
  RAISE NOTICE 'Created indexes for all tables';
  RAISE NOTICE 'Task 1 (Wave 1: Database Foundation) - COMPLETE';
END $$;
