-- Migration: Add happened_at column to tier_change_log table
-- Purpose: Fix missing column that causes QR scan verification to fail
-- Bug: The tier_change_log table was created without the happened_at column,
--      but database triggers (handle_courier_queue_sync) attempt to INSERT with it

-- Add the missing happened_at column
-- Column is nullable to allow existing records and INSERT operations that don't specify it
-- No default value needed since triggers explicitly provide NOW() when inserting
ALTER TABLE public.tier_change_log ADD COLUMN happened_at TIMESTAMPTZ;
