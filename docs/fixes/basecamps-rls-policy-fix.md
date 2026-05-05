# Fix: Basecamps RLS Policy Missing Admin Role

## Issue
Error saat update basecamp sebagai super admin:
```
PGRST116: Cannot coerce the result to a single JSON object
Details: The result contains 0 rows
HTTP Status: 406 Not Acceptable
```

## Root Cause Analysis

### RLS Policy Restriction
**Existing Policy** (before fix):
```sql
CREATE POLICY "basecamps_write_admin" ON basecamps
FOR ALL
USING (
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE role IN ('owner', 'admin_kurir')  -- ❌ Missing 'admin'
  )
);
```

**Problem**: Super admin (role: 'admin') tidak termasuk dalam policy, sehingga:
- INSERT operations → Blocked by RLS
- UPDATE operations → Returns 0 rows (PGRST116)
- DELETE operations → Returns 0 rows (PGRST116)

### Error Flow
1. User dengan role 'admin' mencoba update basecamp
2. Supabase executes: `UPDATE basecamps SET ... WHERE id = ? AND <RLS_POLICY>`
3. RLS policy evaluates to FALSE untuk user 'admin'
4. Query returns 0 rows
5. PostgREST error: **PGRST116** - Cannot coerce to single JSON object

### Why PGRST116?
- Supabase client expects `.single()` to return exactly 1 row
- RLS policy filters out the row, returning 0 rows
- PostgREST cannot coerce 0 rows to a single object
- HTTP 406 Not Acceptable

## Solution Implemented

### Migration File
**File**: `supabase/migrations/20260505023619_fix_basecamps_rls_add_admin.sql`

```sql
-- Drop existing policy
DROP POLICY IF EXISTS "basecamps_write_admin" ON public.basecamps;

-- Create new policy with 'admin' role included
CREATE POLICY "basecamps_write_admin" ON public.basecamps 
FOR ALL 
USING (
  auth.uid() IN (
    SELECT id FROM public.profiles 
    WHERE role IN ('owner', 'admin_kurir', 'admin')  -- ✅ Added 'admin'
  )
);

-- Comment for documentation
COMMENT ON POLICY "basecamps_write_admin" ON public.basecamps IS 
'Allows users with role admin, owner, or admin_kurir to manage basecamps (INSERT, UPDATE, DELETE)';
```

### Policy Scope
- **Command**: `FOR ALL` (covers INSERT, UPDATE, DELETE)
- **Roles Allowed**: 
  - `admin` (super admin) ✅
  - `owner` (business owner)
  - `admin_kurir` (courier administrator)

## Verification

### Policy Check
```sql
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'basecamps' AND policyname = 'basecamps_write_admin';

-- Result:
-- policyname: basecamps_write_admin
-- cmd: ALL
-- qual: auth.uid() IN (SELECT id FROM profiles WHERE role IN ('owner', 'admin_kurir', 'admin'))
```

### Testing Checklist

#### As Super Admin (role: 'admin')
- [x] Create new basecamp → Success
- [x] Update existing basecamp → Success
- [x] Delete basecamp → Success
- [x] No PGRST116 error
- [x] No 406 Not Acceptable error

#### As Owner (role: 'owner')
- [x] Create new basecamp → Success
- [x] Update existing basecamp → Success
- [x] Delete basecamp → Success

#### As Admin Kurir (role: 'admin_kurir')
- [x] Create new basecamp → Success
- [x] Update existing basecamp → Success
- [x] Delete basecamp → Success

#### As Other Roles (courier, finance)
- [x] Create basecamp → Blocked (expected)
- [x] Update basecamp → Blocked (expected)
- [x] Delete basecamp → Blocked (expected)

## Related Issues

This is the **second RLS policy fix** in this session:

1. **stay_qr_tokens** - Fixed in migration `20260505010340_fix_stay_qr_tokens_rls_add_admin.sql`
   - Issue: Super admin couldn't generate QR tokens (403 error)
   - Fix: Added 'admin' role to INSERT policy

2. **basecamps** - Fixed in migration `20260505023619_fix_basecamps_rls_add_admin.sql`
   - Issue: Super admin couldn't manage basecamps (PGRST116 error)
   - Fix: Added 'admin' role to ALL operations policy

### Pattern Identified
Multiple tables have RLS policies that exclude super admin role. This suggests a **systematic issue** in the initial RLS setup.

### Recommendation: Audit All RLS Policies
```sql
-- Find all policies that might be missing 'admin' role
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND qual LIKE '%profiles%'
  AND qual LIKE '%role%'
  AND qual NOT LIKE '%admin%'
ORDER BY tablename, policyname;
```

Run this query to identify other tables that might have the same issue.

## Files Created

1. **Migration**: `supabase/migrations/20260505023619_fix_basecamps_rls_add_admin.sql`
2. **Documentation**: `docs/fixes/basecamps-rls-policy-fix.md`

## Migration Status

- [x] Migration file created
- [x] Migration applied to database
- [x] Policy verified in pg_policies
- [x] Tested with super admin user
- [x] No breaking changes to existing functionality

## Notes

- This fix is **backward compatible** - existing owner and admin_kurir users are unaffected
- Super admin now has full CRUD access to basecamps table
- RLS still enforces authentication (must be logged in)
- Consider creating a migration template for future RLS policies to avoid this pattern

## Prevention

### RLS Policy Template
When creating new RLS policies for admin-managed tables, use this template:

```sql
-- Admin write policy template
CREATE POLICY "<table>_write_admin" ON public.<table>
FOR ALL
USING (
  auth.uid() IN (
    SELECT id FROM public.profiles 
    WHERE role IN ('admin', 'owner', 'admin_kurir')  -- Always include 'admin' first
  )
);
```

### Checklist for New Tables
- [ ] Does this table need admin access?
- [ ] If yes, include 'admin' role in RLS policy
- [ ] Test with all three admin roles (admin, owner, admin_kurir)
- [ ] Document the policy in migration comments
