-- Migration: Fix RLS Policy for stay_qr_tokens to include 'admin' role
-- Date: 2026-05-05
-- Description: Allows super admin (role: 'admin') to insert QR tokens for STAY verification

-- Drop existing policy
DROP POLICY IF EXISTS "qr_tokens_insert_admin" ON public.stay_qr_tokens;

-- Create new policy with 'admin' role included
CREATE POLICY "qr_tokens_insert_admin" ON public.stay_qr_tokens 
FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM public.profiles 
    WHERE role IN ('owner', 'admin_kurir', 'admin')
  )
);

-- Comment for documentation
COMMENT ON POLICY "qr_tokens_insert_admin" ON public.stay_qr_tokens IS 
'Allows users with role admin, owner, or admin_kurir to insert QR tokens for STAY verification';
