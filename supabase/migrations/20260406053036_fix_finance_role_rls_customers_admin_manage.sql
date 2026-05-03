DROP POLICY IF EXISTS "Admins can do everything on customers" ON customers;
CREATE POLICY "Admins can do everything on customers" ON customers
    FOR ALL
    USING (get_auth_user_role() = ANY (ARRAY['admin'::text, 'owner'::text, 'admin_kurir'::text, 'finance'::text]))
    WITH CHECK (get_auth_user_role() = ANY (ARRAY['admin'::text, 'owner'::text, 'admin_kurir'::text, 'finance'::text]));
    
DROP POLICY IF EXISTS "Only admins/owners can insert/update/delete customers" ON customers;
CREATE POLICY "Only admins/owners can insert/update/delete customers" ON customers
    FOR ALL
    USING (get_auth_user_role() = ANY (ARRAY['owner'::text, 'admin_kurir'::text, 'admin'::text, 'finance'::text]))
    WITH CHECK (get_auth_user_role() = ANY (ARRAY['owner'::text, 'admin_kurir'::text, 'admin'::text, 'finance'::text]));
    
DROP POLICY IF EXISTS "Only admins/owners can update customers" ON customers;
CREATE POLICY "Only admins/owners can update customers" ON customers
    FOR UPDATE
    USING (get_auth_user_role() = ANY (ARRAY['admin'::text, 'owner'::text, 'admin_kurir'::text, 'finance'::text]))
    WITH CHECK (get_auth_user_role() = ANY (ARRAY['admin'::text, 'owner'::text, 'admin_kurir'::text, 'finance'::text]));;
