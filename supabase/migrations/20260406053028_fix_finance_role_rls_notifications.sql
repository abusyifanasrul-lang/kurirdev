DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications" ON notifications
    FOR SELECT
    USING ((user_id = auth.uid()) OR (get_auth_user_role() = ANY (ARRAY['owner'::text, 'admin_kurir'::text, 'finance'::text])));;
