DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
CREATE POLICY "Admins can manage all profiles" ON profiles
    FOR ALL
    USING (get_auth_user_role() = ANY (ARRAY['admin'::text, 'owner'::text, 'admin_kurir'::text, 'finance'::text]))
    WITH CHECK (get_auth_user_role() = ANY (ARRAY['admin'::text, 'owner'::text, 'admin_kurir'::text, 'finance'::text]));;
