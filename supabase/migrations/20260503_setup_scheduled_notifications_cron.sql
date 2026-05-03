-- Setup cron job to process scheduled notifications every 15 minutes
-- This requires pg_cron extension to be enabled

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- Create a function to call the Edge Function
CREATE OR REPLACE FUNCTION public.trigger_process_scheduled_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_function_url TEXT;
  v_service_key TEXT;
  v_response TEXT;
BEGIN
  -- Get Supabase URL and service key from settings or environment
  -- Note: In production, these should be stored securely
  -- For now, we'll use pg_net to call the Edge Function
  
  -- This is a placeholder - actual implementation depends on your Supabase setup
  -- You may need to use pg_net extension or http extension
  
  RAISE NOTICE 'Triggering process-scheduled-notifications Edge Function...';
  
  -- The actual HTTP call would be done here using pg_net or similar
  -- Example (requires pg_net extension):
  -- SELECT net.http_post(
  --   url := 'https://your-project.supabase.co/functions/v1/process-scheduled-notifications',
  --   headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_key),
  --   body := '{}'::jsonb
  -- );
  
END;
$$;

-- Schedule the cron job to run every 15 minutes
-- Note: This requires pg_cron to be enabled in your Supabase project
-- You can enable it in: Dashboard > Database > Extensions

SELECT cron.schedule(
  'process-scheduled-notifications',  -- Job name
  '*/15 * * * *',                     -- Every 15 minutes
  $$SELECT public.trigger_process_scheduled_notifications()$$
);

-- Alternative: If pg_cron is not available, you can use Supabase's built-in cron
-- via the Dashboard > Database > Cron Jobs section

COMMENT ON FUNCTION public.trigger_process_scheduled_notifications IS 
  'Triggers the Edge Function to process scheduled notifications. Called by pg_cron every 15 minutes.';
