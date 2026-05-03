DROP POLICY IF EXISTS "Ops can insert/update orders" ON orders;
CREATE POLICY "Ops can insert/update orders" ON orders
    FOR ALL
    USING (get_auth_user_role() = ANY (ARRAY['admin'::text, 'owner'::text, 'admin_kurir'::text, 'finance'::text]))
    WITH CHECK (get_auth_user_role() = ANY (ARRAY['admin'::text, 'owner'::text, 'admin_kurir'::text, 'finance'::text]));;
