-- Drop all existing policies
DROP POLICY IF EXISTS "Admin can manage scheduled notifications" ON public.scheduled_notifications;
DROP POLICY IF EXISTS "Service role full access" ON public.scheduled_notifications;
DROP POLICY IF EXISTS "Users can view own scheduled notifications" ON public.scheduled_notifications;

-- Recreate policies with proper WITH CHECK clauses

-- Policy 1: Admin can do everything
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
  );

-- Policy 2: Service role full access
CREATE POLICY "Service role full access"
  ON public.scheduled_notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy 3: Users can view their own
CREATE POLICY "Users can view own scheduled notifications"
  ON public.scheduled_notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());;
