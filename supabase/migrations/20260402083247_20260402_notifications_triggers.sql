-- Enable necessary extensions if not yet checked
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Function: orders -> notifications (Automation)
CREATE OR REPLACE FUNCTION handle_order_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_title TEXT;
  v_message TEXT;
  v_type TEXT := 'order_update';
BEGIN
  -- Logic to determine title/message based on status change
  IF NEW.status = 'assigned' AND (OLD.status IS NULL OR OLD.status != 'assigned') THEN
    v_title := '📦 Pesanan Baru!';
    v_message := 'Admin telah menugaskan pesanan ' || NEW.order_number || ' ke Anda. Segera proses ya!';
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
      jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number, 'status', NEW.status)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger: orders status update
DROP TRIGGER IF EXISTS trigger_handle_order_notification ON public.orders;
CREATE TRIGGER trigger_handle_order_notification
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION handle_order_notification();


-- 3. Function: notifications -> FCM Edge Function (Delivery)
CREATE OR REPLACE FUNCTION notify_courier_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Using pg_net to call the Supabase Edge Function asynchronously
  PERFORM
    net.http_post(
      url := 'https://bunycotovavltxmutier.supabase.co/functions/v1/notify-courier',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer kurirdev_notif_secret_2026'
      ),
      body := jsonb_build_object(
        'type', 'INSERT',
        'table', 'notifications',
        'record', row_to_json(NEW)
      )
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger: notifications INSERT
DROP TRIGGER IF EXISTS trigger_notify_courier_on_insert ON public.notifications;
CREATE TRIGGER trigger_notify_courier_on_insert
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION notify_courier_on_insert();
;
