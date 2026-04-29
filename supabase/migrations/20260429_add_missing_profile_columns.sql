-- Migration: Add missing profile columns for queue management
-- Date: 2026-04-29
-- Note: Columns already exist in remote DB, this file is for version control
-- and to add the missing index on queue_joined_at

-- Add columns (using IF NOT EXISTS for idempotency)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS queue_joined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_priority_recovery BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancel_count INT DEFAULT 0;

-- Create index for FIFO queue sorting
-- This index helps with efficient querying of online/active couriers by queue order
CREATE INDEX IF NOT EXISTS idx_profiles_queue_joined_at
  ON public.profiles(queue_joined_at ASC)
  WHERE is_online = true AND is_active = true;

-- Note: queue_position column also exists in DB but not included in the
-- original FIX #5 specification. If needed, add additional indexes here.
