-- 1. Update get_auth_user_role to check is_active
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM profiles WHERE id = auth.uid() AND is_active = true;
$function$;

-- 2. Clean up permissive policies for 'orders'
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.orders;
DROP POLICY IF EXISTS "Admins and Owners can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Admins and Owners can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins and Owners can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Couriers can update their assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Couriers can view pending or assigned orders" ON public.orders;

-- 2.1 Re-add strict policies for 'orders'
CREATE POLICY "Admins and Finance can view all orders" 
ON public.orders FOR SELECT 
USING (get_auth_user_role() = ANY (ARRAY['admin', 'owner', 'admin_kurir', 'finance']));

CREATE POLICY "Couriers can view assigned or pending orders" 
ON public.orders FOR SELECT 
USING (
  (get_auth_user_role() = 'courier') AND 
  (status = 'pending' OR courier_id = auth.uid())
);

CREATE POLICY "Ops can insert/update orders" 
ON public.orders FOR ALL 
USING (get_auth_user_role() = ANY (ARRAY['admin', 'owner', 'admin_kurir']))
WITH CHECK (get_auth_user_role() = ANY (ARRAY['admin', 'owner', 'admin_kurir']));

CREATE POLICY "Couriers can update assigned orders status" 
ON public.orders FOR UPDATE 
USING ((get_auth_user_role() = 'courier') AND (courier_id = auth.uid()))
WITH CHECK ((get_auth_user_role() = 'courier') AND (courier_id = auth.uid()));

-- 3. Clean up permissive policies for 'profiles'
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone logged in" ON public.profiles;

-- 3.1 Re-add strict policies for 'profiles'
CREATE POLICY "Admins can manage all profiles" 
ON public.profiles FOR ALL 
USING (get_auth_user_role() = ANY (ARRAY['admin', 'owner', 'admin_kurir']))
WITH CHECK (get_auth_user_role() = ANY (ARRAY['admin', 'owner', 'admin_kurir']));

CREATE POLICY "Users can view and edit their own profile" 
ON public.profiles FOR ALL 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 4. Clean up permissive policies for 'tracking_logs'
DROP POLICY IF EXISTS "Tracking logs viewable by admins" ON public.tracking_logs;
DROP POLICY IF EXISTS "Tracking logs viewable by assigned courier" ON public.tracking_logs;

-- 4.1 Re-add strict policies for 'tracking_logs'
CREATE POLICY "Admins can view all tracking logs" 
ON public.tracking_logs FOR SELECT 
USING (get_auth_user_role() = ANY (ARRAY['admin', 'owner', 'admin_kurir', 'finance']));

CREATE POLICY "Couriers can view logs for their orders" 
ON public.tracking_logs FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = tracking_logs.order_id 
    AND orders.courier_id = auth.uid()
  )
);
;
