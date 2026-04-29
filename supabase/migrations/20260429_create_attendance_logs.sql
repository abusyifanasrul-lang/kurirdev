-- Migration: Create attendance_logs table
-- Date: 2026-04-29
-- Note: Table already existed in remote DB, RLS and policies applied on 2026-04-29

CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  courier_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendance_logs_courier_id 
  ON public.attendance_logs(courier_id);

CREATE INDEX IF NOT EXISTS idx_attendance_logs_created_at 
  ON public.attendance_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_logs_courier_created 
  ON public.attendance_logs(courier_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (for idempotency)
DROP POLICY IF EXISTS "Owners/Admins can view all attendance logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Couriers can view own attendance logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "System can insert attendance logs" ON public.attendance_logs;

-- Policy: Owners and admin_kurir can read all attendance logs
CREATE POLICY "Owners/Admins can view all attendance logs" 
  ON public.attendance_logs
  FOR SELECT 
  USING (
    public.get_auth_user_role() IN ('owner', 'admin_kurir')
  );

-- Policy: Couriers can only read their own attendance logs
CREATE POLICY "Couriers can view own attendance logs" 
  ON public.attendance_logs
  FOR SELECT 
  USING (
    auth.uid() = courier_id 
    AND public.get_auth_user_role() = 'courier'
  );

-- Policy: Allow insert for authenticated users (used by triggers/functions)
CREATE POLICY "System can insert attendance logs" 
  ON public.attendance_logs
  FOR INSERT 
  WITH CHECK (true);

-- Grant permissions to service_role (for backend operations)
GRANT ALL ON public.attendance_logs TO service_role;
GRANT SELECT ON public.attendance_logs TO authenticated;

-- Note: Since table already exists in remote DB, this migration documents
-- the intended schema. If you need to apply RLS and policies to the
-- existing table, run the ALTER TABLE and CREATE POLICY statements
-- manually in the Supabase SQL editor.
