-- 1. Add is_priority_recovery to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_priority_recovery BOOLEAN DEFAULT false;

-- 2. Function to handle order cancellation priority
CREATE OR REPLACE FUNCTION public.handle_order_cancellation_priority()
RETURNS trigger
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

-- 3. Trigger on orders table
DROP TRIGGER IF EXISTS tr_order_cancellation_priority ON public.orders;
CREATE TRIGGER tr_order_cancellation_priority
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_cancellation_priority();

-- 4. Update rotate_courier_queue to reset priority
CREATE OR REPLACE FUNCTION public.rotate_courier_queue(target_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  current_pos INTEGER;
  max_pos INTEGER;
BEGIN
  -- Get current position of the assigned courier
  SELECT queue_position INTO current_pos 
  FROM public.profiles 
  WHERE id = target_user_id;
  
  -- Reset priority recovery since they just got assigned
  UPDATE public.profiles 
  SET is_priority_recovery = false 
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
    AND id != target_user_id; -- exclude self from max calculation
    
    UPDATE public.profiles 
    SET queue_position = max_pos + 1 
    WHERE id = target_user_id;
  END IF;
END;
$function$;
;
