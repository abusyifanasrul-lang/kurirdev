-- Function to handle courier queue synchronization
CREATE OR REPLACE FUNCTION public.handle_courier_queue_sync()
RETURNS TRIGGER AS $$
DECLARE
  max_pos INTEGER;
BEGIN
  -- If not a courier, ensure queue_position is null
  IF NEW.role != 'courier' THEN
    NEW.queue_position := NULL;
    RETURN NEW;
  END IF;

  -- Logic for Courier Queue Shifting
  -- This runs BEFORE the change is applied to the database

  -- Case 1: Courier is being deactivated or taken offline
  IF (TG_OP = 'UPDATE') AND 
     ((OLD.is_active = true AND NEW.is_active = false) OR 
      (OLD.is_online = true AND NEW.is_online = false)) THEN
    
    -- If they had a position, shift others who were behind them
    IF OLD.queue_position IS NOT NULL THEN
      UPDATE public.profiles 
      SET queue_position = queue_position - 1 
      WHERE queue_position > OLD.queue_position 
      AND role = 'courier'
      AND queue_position IS NOT NULL;
    END IF;
    
    NEW.queue_position := NULL;
    
  -- Case 2: Courier is being activated AND put online
  ELSIF (NEW.is_active = true AND NEW.is_online = true) AND 
        (TG_OP = 'INSERT' OR (OLD.is_active = false OR OLD.is_online = false OR OLD.queue_position IS NULL)) THEN
    
    -- Assign to the end of the queue if they don't have a position
    IF NEW.queue_position IS NULL THEN
      SELECT COALESCE(MAX(queue_position), 0) INTO max_pos 
      FROM public.profiles 
      WHERE role = 'courier';
      
      NEW.queue_position := max_pos + 1;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function
-- We only trigger when the status columns change to avoid unnecessary overhead and recursion
DROP TRIGGER IF EXISTS on_courier_status_change ON public.profiles;
CREATE TRIGGER on_courier_status_change
  BEFORE INSERT OR UPDATE OF is_active, is_online, role
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_courier_queue_sync();

-- Function to rotate courier to the end of the queue (called via RPC after assignment)
CREATE OR REPLACE FUNCTION public.rotate_courier_queue(target_user_id UUID)
RETURNS VOID AS $$
DECLARE
  current_pos INTEGER;
  max_pos INTEGER;
BEGIN
  -- Get current position of the assigned courier
  SELECT queue_position INTO current_pos 
  FROM public.profiles 
  WHERE id = target_user_id;
  
  IF current_pos IS NOT NULL THEN
    -- 1. Shift everyone who was behind this courier up by one
    UPDATE public.profiles 
    SET queue_position = queue_position - 1 
    WHERE queue_position > current_pos 
    AND role = 'courier'
    AND queue_position IS NOT NULL;
    
    -- 2. Move the assigned courier to the very end of the current queue
    SELECT COALESCE(MAX(queue_position), 0) INTO max_pos 
    FROM public.profiles 
    WHERE role = 'courier'
    AND id != target_user_id; -- exclude self from max calculation to be safe
    
    UPDATE public.profiles 
    SET queue_position = max_pos + 1 
    WHERE id = target_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
;
