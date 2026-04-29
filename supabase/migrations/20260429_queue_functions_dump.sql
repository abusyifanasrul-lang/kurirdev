-- Migration: Dump queue-related functions from remote DB
-- Date: 2026-04-29
-- Source: Dumped from remote DB (project: bunycotovavltxmutier)
-- Note: These functions existed in DB but were missing from codebase migrations

-- =============================================
-- Function 1: handle_courier_queue_sync
-- Trigger function for managing courier queue sync
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_courier_queue_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_status TEXT;
  v_new_status TEXT;
  v_reset_needed BOOLEAN := false;
BEGIN
  IF NEW.role != 'courier' THEN
    NEW.queue_joined_at := NULL;
    NEW.is_online := false;
    RETURN NEW;
  END IF;

  v_old_status := COALESCE(OLD.courier_status, 'off');
  v_new_status := COALESCE(NEW.courier_status, 'off');

  -- 1. Mirror is_online from courier_status
  IF (NEW.is_active = true) AND (v_new_status IN ('on', 'stay')) THEN
    NEW.is_online := true;
  ELSE
    NEW.is_online := false;
  END IF;

  -- 2. Queue timestamp — only specific transitions reset
  IF NEW.is_online = false THEN
    NEW.queue_joined_at := NULL;

  ELSIF (TG_OP = 'INSERT' AND NEW.is_online = true) THEN
    v_reset_needed := true;

  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.is_online = false AND NEW.is_online = true) THEN
      v_reset_needed := true; -- off → on/stay
    ELSIF (v_old_status = 'on' AND v_new_status = 'stay') OR
          (v_old_status = 'stay' AND v_new_status = 'on') THEN
      v_reset_needed := true; -- switching between active statuses
    ELSIF (OLD.is_active = false AND NEW.is_active = true AND NEW.is_online = true) THEN
      v_reset_needed := true; -- unsuspend
    ELSIF (NEW.queue_joined_at IS NULL AND NEW.is_online = true) THEN
      v_reset_needed := true; -- recovery state
    END IF;
  END IF;

  IF v_reset_needed THEN
    NEW.queue_joined_at := NOW();
  END IF;

  -- 3. Suspend: force out of queue
  IF NEW.is_active = false AND OLD.is_active = true THEN
    NEW.courier_status       := 'off';
    NEW.is_online            := false;
    NEW.queue_joined_at      := NULL;
    NEW.is_priority_recovery := false;
  END IF;

  -- 4. Audit trail
  IF (TG_OP = 'UPDATE') AND
     (v_old_status != v_new_status OR
      OLD.is_priority_recovery IS DISTINCT FROM NEW.is_priority_recovery) THEN

    INSERT INTO public.tier_change_log (
      courier_id, trigger_source,
      queue_joined_at_before, queue_joined_at_after,
      context, happened_at
    ) VALUES (
      NEW.id,
      'status_' || v_old_status || '_to_' || v_new_status,
      OLD.queue_joined_at, NEW.queue_joined_at,
      jsonb_build_object(
        'old_status', v_old_status,
        'new_status', v_new_status,
        'is_priority_recovery', NEW.is_priority_recovery
      ),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================
-- Function 2: handle_order_cancellation_priority
-- Grants priority recovery when order is cancelled
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_order_cancellation_priority()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    active_count INTEGER;
BEGIN
    -- Only trigger when status changes to 'cancelled'
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
        -- Check if courier has other active orders
        SELECT COUNT(*) INTO active_count
        FROM public.orders
        WHERE courier_id = NEW.courier_id
        AND status NOT IN ('delivered', 'cancelled')
        AND id != NEW.id;

        -- If no other active orders, grant priority recovery
        IF active_count = 0 THEN
            UPDATE public.profiles
            SET is_priority_recovery = true
            WHERE id = NEW.courier_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- =============================================
-- Function 3: rotate_courier_queue
-- Moves courier to end of queue by resetting timestamp
-- =============================================
CREATE OR REPLACE FUNCTION public.rotate_courier_queue(p_courier_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET queue_joined_at = NOW()
  WHERE id = p_courier_id;
END;
$$;

-- =============================================
-- Note: Function "reset_priority_recovery" is NOT NEEDED
-- =============================================
-- ✅ RESOLVED (by design): reset_priority_recovery tidak akan dibuat 
-- sebagai fungsi/trigger terpisah. Logic reset is_priority_recovery = false 
-- akan diimplementasikan di dalam RPC assign_order_and_rotate (FIX #7) 
-- sebagai bagian dari transaksi atomic assignment.

-- Alasan: menghindari race condition trigger timing yang sudah 
-- diidentifikasi di audit report.
-- FIX #4 APPROVED — BLOCKER resolved by design.
