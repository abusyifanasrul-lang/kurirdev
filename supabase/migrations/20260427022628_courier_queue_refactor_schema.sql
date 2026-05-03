-- Phase 1: Schema Updates
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS queue_joined_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancel_count INT DEFAULT 0;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS queue_position_at_assign INT,
ADD COLUMN IF NOT EXISTS fine_deducted INT DEFAULT 0;

-- Create Tier Change Log for audit trail
CREATE TABLE IF NOT EXISTS public.tier_change_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    courier_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT,
    old_is_priority BOOLEAN,
    new_is_priority BOOLEAN,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Courier Warnings table
CREATE TABLE IF NOT EXISTS public.courier_warnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    courier_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    warning_type TEXT,
    message TEXT,
    resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id)
);

-- Phase 2: Data Backfill
-- Set queue_joined_at for currently online couriers based on their current sequence
-- This preserves the existing order during migration
WITH courier_queue AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY queue_position ASC) as seq
    FROM public.profiles
    WHERE role = 'courier' AND queue_position IS NOT NULL
)
UPDATE public.profiles p
SET queue_joined_at = (NOW() - (seq * interval '1 second'))
FROM courier_queue cq
WHERE p.id = cq.id;
;
