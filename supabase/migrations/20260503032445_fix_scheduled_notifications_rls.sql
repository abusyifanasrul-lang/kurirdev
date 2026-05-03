-- Fix RLS policy for scheduled_notifications
-- Allow admin to INSERT scheduled notifications

DROP POLICY IF EXISTS "Admin can manage scheduled notifications" ON public.scheduled_notifications;

CREATE POLICY "Admin can manage scheduled notifications"
  ON public.scheduled_notifications
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('owner', 'admin_kurir')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('owner', 'admin_kurir')
    )
  );;
