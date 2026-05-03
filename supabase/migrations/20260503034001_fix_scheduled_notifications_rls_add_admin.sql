-- Update policy to include 'admin' role
DROP POLICY IF EXISTS "Admin can manage scheduled notifications" ON public.scheduled_notifications;

CREATE POLICY "Admin can manage scheduled notifications"
  ON public.scheduled_notifications
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('owner', 'admin_kurir', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('owner', 'admin_kurir', 'admin')
    )
  );;
