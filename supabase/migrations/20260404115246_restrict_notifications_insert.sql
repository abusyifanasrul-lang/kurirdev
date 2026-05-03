-- Drop policy lama
DROP POLICY IF EXISTS "System and Admins can insert notifications" ON public.notifications;

-- Buat policy baru yang lebih ketat
CREATE POLICY "Only admins can send notifications" ON public.notifications
  FOR INSERT WITH CHECK (
    public.get_auth_user_role() IN ('owner', 'admin_kurir', 'admin')
  );
;
