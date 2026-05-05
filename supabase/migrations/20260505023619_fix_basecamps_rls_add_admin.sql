-- Migration: Fix RLS Policy for basecamps to include 'admin' role
-- Date: 2026-05-05
-- Description: Allows super admin (role: 'admin') to manage basecamps (INSERT, UPDATE, DELETE)

-- Drop existing policy
DROP POLICY IF EXISTS "basecamps_write_admin" ON public.basecamps;

-- Create new policy with 'admin' role included
CREATE POLICY "basecamps_write_admin" ON public.basecamps 
FOR ALL 
USING (
  auth.uid() IN (
    SELECT id FROM public.profiles 
    WHERE role IN ('owner', 'admin_kurir', 'admin')
  )
);

-- Comment for documentation
COMMENT ON POLICY "basecamps_write_admin" ON public.basecamps IS 
'Allows users with role admin, owner, or admin_kurir to manage basecamps (INSERT, UPDATE, DELETE)';
