-- Fix RLS Policy for basecamps to include 'admin' role
-- Previous migration (20260504183701) didn't apply correctly
-- This ensures admin role can manage basecamps

DROP POLICY IF EXISTS "basecamps_write_admin" ON public.basecamps;

CREATE POLICY "basecamps_write_admin" ON public.basecamps 
FOR ALL 
USING (
  auth.uid() IN (
    SELECT id FROM public.profiles 
    WHERE role IN ('owner', 'admin_kurir', 'admin')
  )
);

COMMENT ON POLICY "basecamps_write_admin" ON public.basecamps IS 
'Allows users with role admin, owner, or admin_kurir to manage basecamps (INSERT, UPDATE, DELETE)';;
