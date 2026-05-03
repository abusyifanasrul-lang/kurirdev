-- Setup automatic processing of scheduled notifications using database triggers
-- This approach is more efficient than polling - only runs when needed

-- Enable pg_net extension for HTTP requests from database
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to schedule Edge Function call at the right time
CREATE OR REPLACE FUNCTION public.schedule_notification_processing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_url TEXT;
  v_anon_key TEXT;
  v_delay_seconds INTEGER;
  v_now TIMESTAMPTZ;
BEGIN
  -- Get current time
  v_now := NOW();
  
  -- Calculate delay in seconds until scheduled_at
  v_delay_seconds := GREATEST(0, EXTRACT(EPOCH FROM (NEW.scheduled_at - v_now))::INTEGER);
  
  -- Only schedule if in the future (with 1 minute buffer to avoid immediate execution)
  IF v_delay_seconds > 60 THEN
    -- Get Supabase project URL and anon key from Vault
    SELECT decrypted_secret INTO v_project_url
    FROM vault.decrypted_secrets
    WHERE name = 'supabase_url'
    LIMIT 1;
    
    SELECT decrypted_secret INTO v_anon_key
    FROM vault.decrypted_secrets
    WHERE name = 'supabase_anon_key'
    LIMIT 1;
    
    -- Validate that secrets were found
    IF v_project_url IS NULL OR v_anon_key IS NULL THEN
      RAISE WARNING 'Supabase credentials not found in Vault. Notification % will not be scheduled.', NEW.id;
      RETURN NEW;
    END IF;
    
    -- Schedule HTTP request to Edge Function using pg_net
    -- This will be executed at the scheduled time
    PERFORM net.http_post(
      url := v_project_url || '/functions/v1/process-scheduled-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := jsonb_build_object(
        'scheduled_notification_id', NEW.id,
        'user_id', NEW.user_id,
        'scheduled_at', NEW.scheduled_at
      ),
      timeout_milliseconds := 30000
    );
    
    RAISE NOTICE 'Scheduled notification processing for % at % (delay: % seconds)', NEW.id, NEW.scheduled_at, v_delay_seconds;
  ELSE
    -- If scheduled time is within 1 minute, process immediately
    RAISE NOTICE 'Scheduled notification % is due soon (in % seconds), will be processed immediately', NEW.id, v_delay_seconds;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger on INSERT to scheduled_notifications
CREATE TRIGGER trigger_schedule_notification_processing
  AFTER INSERT ON public.scheduled_notifications
  FOR EACH ROW
  WHEN (NEW.sent = false)
  EXECUTE FUNCTION public.schedule_notification_processing();

-- Create a safety net function that can be called manually or via cron if needed
CREATE OR REPLACE FUNCTION public.process_due_scheduled_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_url TEXT;
  v_anon_key TEXT;
  v_count INTEGER;
BEGIN
  -- Count how many notifications are due
  SELECT COUNT(*) INTO v_count
  FROM public.scheduled_notifications
  WHERE scheduled_at <= NOW()
    AND sent = false;
  
  -- Only proceed if there are notifications to process
  IF v_count > 0 THEN
    -- Get credentials from Vault
    SELECT decrypted_secret INTO v_project_url
    FROM vault.decrypted_secrets
    WHERE name = 'supabase_url'
    LIMIT 1;
    
    SELECT decrypted_secret INTO v_anon_key
    FROM vault.decrypted_secrets
    WHERE name = 'supabase_anon_key'
    LIMIT 1;
    
    IF v_project_url IS NULL OR v_anon_key IS NULL THEN
      RAISE WARNING 'Supabase credentials not found in Vault. Cannot process notifications.';
      RETURN;
    END IF;
    
    -- Call Edge Function to process due notifications
    PERFORM net.http_post(
      url := v_project_url || '/functions/v1/process-scheduled-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := jsonb_build_object('trigger', 'manual_safety_net'),
      timeout_milliseconds := 30000
    );
    
    RAISE NOTICE 'Processed % due scheduled notifications via safety net', v_count;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.schedule_notification_processing IS 
  'Automatically schedules Edge Function call when a new scheduled notification is created. Reads credentials from Vault.';

COMMENT ON FUNCTION public.process_due_scheduled_notifications IS 
  'Safety net function that processes any missed scheduled notifications. Can be called manually or via cron.';
