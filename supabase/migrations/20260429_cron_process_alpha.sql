-- Enable required extensions for cron and HTTP requests
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Create a function to invoke the process-alpha Edge Function
create or replace function invoke_process_alpha()
returns void
language plpgsql
as $$
declare
  supabase_url text := current_setting('app.settings.supabase_url', true);
  service_role_key text := current_setting('app.settings.service_role_key', true);
  response_status int;
  response_body text;
begin
  -- Use pg_net to make HTTP POST request to the Edge Function
  select
    status,
    body
  into
    response_status,
    response_body
  from
    net.http_post(
      url := supabase_url || '/functions/v1/process-alpha',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || service_role_key,
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  
  if response_status != 200 then
    raise warning 'Failed to invoke process-alpha: status=%, body=%', response_status, response_body;
  end if;
end;
$$;

-- Schedule the cron job to run at midnight every day (00:00 server time)
select cron.schedule(
  'process-alpha-midnight',  -- job name
  '0 0 * * *',              -- midnight every day (cron expression)
  'select invoke_process_alpha()'
);
