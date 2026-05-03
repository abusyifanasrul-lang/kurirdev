-- 1. Update SELECT policy
DROP POLICY IF EXISTS "notifications_select" ON "public"."notifications";
CREATE POLICY "notifications_select" ON "public"."notifications"
FOR SELECT
TO authenticated
USING (
  (user_id = auth.uid()) 
  OR 
  (get_auth_user_role() = ANY (ARRAY['owner'::text, 'admin_kurir'::text, 'admin'::text]))
);

-- 2. Update UPDATE policy
DROP POLICY IF EXISTS "notifications_update" ON "public"."notifications";
CREATE POLICY "notifications_update" ON "public"."notifications"
FOR UPDATE
TO authenticated
USING (
  (user_id = auth.uid()) 
  OR 
  (get_auth_user_role() = ANY (ARRAY['owner'::text, 'admin_kurir'::text, 'admin'::text]))
)
WITH CHECK (
  (user_id = auth.uid()) 
  OR 
  (get_auth_user_role() = ANY (ARRAY['owner'::text, 'admin_kurir'::text, 'admin'::text]))
);;
