CREATE OR REPLACE FUNCTION public.handle_order_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_title TEXT;
  v_message TEXT;
  v_type TEXT := 'order_update';
BEGIN
  -- Logic to determine title/message based on status change
  IF NEW.status = 'assigned' AND (OLD.status IS NULL OR OLD.status != 'assigned') THEN
    v_title := '🛵 Order Baru — ' || NEW.order_number;
    -- Incorporate notes (instruction) if available
    IF NEW.notes IS NOT NULL AND NEW.notes != '' THEN
      v_message := NEW.customer_name || ' • 📋 ' || NEW.notes;
    ELSE
      v_message := NEW.customer_name || ' • Segera proses!';
    END IF;
    v_type := 'order_assigned';
    
  ELSIF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    v_title := '🚫 Pesanan Dibatalkan';
    v_message := 'Pesanan ' || NEW.order_number || ' telah dibatalkan oleh Admin/Customer.';
  ELSE
    -- Other status changes logic could go here if needed
    RETURN NEW;
  END IF;

  -- Only insert if we have a notification to send
  IF v_title IS NOT NULL AND NEW.courier_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, data)
    VALUES (
      NEW.courier_id, 
      v_title, 
      v_message, 
      v_type, 
      jsonb_build_object(
        'order_id', NEW.id, 
        'order_number', NEW.order_number, 
        'status', NEW.status,
        'customer_name', NEW.customer_name
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;;
