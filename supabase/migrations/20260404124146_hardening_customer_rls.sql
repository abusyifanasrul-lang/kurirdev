-- hardening_customer_rls.sql
-- Goal: Deny direct updates to couriers, forcing them through the approval workflow implemented in the frontend.

-- 1. Remove the overly permissive policy
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.customers;

-- 2. Refine Courier Access: They can read and create new records, but cannot UPDATE or DELETE existing ones.
-- (Existing "Everyone can read customers" handles SELECT)

DROP POLICY IF EXISTS "Couriers can create customers" ON public.customers;
CREATE POLICY "Couriers can create customers" ON public.customers
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.role() = 'authenticated' AND 
        get_auth_user_role() = 'courier'
    );

-- 3. Confirm Admin/Owner full access (Update/Delete/Insert)
-- This ensures that only these roles can bypass the approval flow if needed (though the frontend uses the flow).
-- There is already "Admins can do everything on customers" but let's be explicit for updates.

DROP POLICY IF EXISTS "Only admins/owners can update customers" ON public.customers;
CREATE POLICY "Only admins/owners can update customers" ON public.customers
    FOR UPDATE TO authenticated
    USING (
        get_auth_user_role() = ANY (ARRAY['admin', 'owner', 'admin_kurir'])
    );
;
