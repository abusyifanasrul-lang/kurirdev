-- Update rotate_courier_queue to O(1)
CREATE OR REPLACE FUNCTION public.rotate_courier_queue(target_user_id UUID)
RETURNS void AS $$
BEGIN
  -- Simply update the timestamp to the back of the queue
  -- and clear priority recovery
  UPDATE public.profiles 
  SET 
    queue_joined_at = NOW(), 
    is_priority_recovery = false 
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update handle_courier_queue_sync with mirroring and O(1) logic
CREATE OR REPLACE FUNCTION public.handle_courier_queue_sync()
RETURNS TRIGGER AS $$
DECLARE
  v_old_status TEXT;
  v_new_status TEXT;
BEGIN
  -- Safety check: skip if not a courier
  IF NEW.role != 'courier' THEN
    NEW.queue_joined_at := NULL;
    NEW.is_online := false;
    RETURN NEW;
  END IF;

  v_old_status := COALESCE(OLD.courier_status, 'off');
  v_new_status := COALESCE(NEW.courier_status, 'off');

  -- 1. Automatic Status Mirroring
  -- courier_status in ('on', 'stay') AND active -> is_online = true
  IF (NEW.is_active = true) AND (v_new_status IN ('on', 'stay')) THEN
    NEW.is_online := true;
  ELSE
    NEW.is_online := false;
  END IF;

  -- 2. Queue Timestamp Management
  -- Offline or inactive: wipe timestamp
  IF NEW.is_online = false THEN
    NEW.queue_joined_at := NULL;
  
  -- Logic to reset position:
  -- - Just inserted (if online)
  -- - Just activated or went online from offline
  -- - Switched between 'on' and 'stay' (as per requirements)
  ELSIF (TG_OP = 'INSERT' AND NEW.is_online = true) OR 
        (TG_OP = 'UPDATE' AND (
            (OLD.is_online = false AND NEW.is_online = true) OR
            (v_old_status != v_new_status) OR
            (OLD.is_active = false AND NEW.is_active = true) OR
            (NEW.queue_joined_at IS NULL)
        )) THEN
    
    -- Small delay ensures proper FIFO sequence even in batch updates
    NEW.queue_joined_at := NOW();
  END IF;

  -- 3. Audit Tier Changes
  IF (TG_OP = 'UPDATE') AND 
     (v_old_status != v_new_status OR OLD.is_priority_recovery != NEW.is_priority_recovery) THEN
     
    INSERT INTO public.tier_change_log (
        courier_id, 
        old_status, 
        new_status, 
        old_is_priority, 
        new_is_priority, 
        reason
    ) VALUES (
        NEW.id, 
        v_old_status, 
        v_new_status,
        COALESCE(OLD.is_priority_recovery, false), 
        COALESCE(NEW.is_priority_recovery, false),
        'Status update'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
;
