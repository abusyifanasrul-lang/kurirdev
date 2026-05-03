-- Add INSERT policy for tracking_logs to allow couriers to log their actions
-- This is a safety measure, though the RPC should ideally handle it.
CREATE POLICY "Authenticated users can insert tracking logs"
ON public.tracking_logs
FOR INSERT
TO authenticated
WITH CHECK (true);
;
