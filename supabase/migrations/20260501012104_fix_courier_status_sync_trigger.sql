DROP TRIGGER IF EXISTS on_courier_status_change ON public.profiles;

CREATE TRIGGER on_courier_status_change
BEFORE INSERT OR UPDATE OF is_active, is_online, role, courier_status, is_priority_recovery, queue_joined_at
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION handle_courier_queue_sync();;
