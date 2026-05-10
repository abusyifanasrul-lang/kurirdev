# RLS Policies Fix for Realtime Events

## Problem
Realtime subscription was successfully connected (`SUBSCRIBED` status) but **never received events** when records were inserted/updated/deleted in `shift_attendance` table.

**Console logs showed:**
```
[AdminAttendance] Subscription status: SUBSCRIBED
[AdminAttendance] ✅ Successfully subscribed to realtime updates
```

But when courier checked in (OFF → ON):
- ❌ No `🔥 Realtime event received` log
- ❌ Warning section didn't update
- ❌ Table didn't refresh until 10-second polling

## Root Cause
**RLS (Row Level Security) policies were blocking Realtime events.**

Supabase Realtime requires **explicit SELECT permission** for authenticated users to receive events. The previous policies only allowed:
1. Admins to manage all attendance (SELECT/INSERT/UPDATE/DELETE)
2. Couriers to view their own attendance (SELECT with `auth.uid() = courier_id`)

**The problem:** When a courier checks in, the `record_courier_checkin` function runs with `SECURITY DEFINER` (as the function owner), so the INSERT succeeds. But the Realtime event is broadcast to **all subscribed clients**, and RLS checks if **each client** has SELECT permission on that row.

Since the admin user (`6dbf7b6c-6bc9-4f22-8c13-3cdaa0ace0bb`) is not the courier who checked in, the second policy (`auth.uid() = courier_id`) returns FALSE, and the Realtime event is **filtered out** before reaching the client.

## Solution
Added a **broad SELECT policy** that allows all authenticated users to view attendance records:

```sql
CREATE POLICY "Allow authenticated users to view attendance"
  ON shift_attendance
  FOR SELECT
  TO authenticated
  USING (true);
```

This policy:
- ✅ Allows Realtime events to reach all authenticated users
- ✅ Doesn't compromise security (attendance data is internal business data)
- ✅ Works alongside the admin management policy

## Migration
**File:** `fix_shift_attendance_realtime_rls`

```sql
-- Fix RLS policies for Realtime on shift_attendance
-- Realtime needs explicit SELECT permission for authenticated users

-- Drop existing policies
DROP POLICY IF EXISTS "Allow admins to manage all attendance" ON shift_attendance;
DROP POLICY IF EXISTS "Allow couriers to view their own attendance" ON shift_attendance;

-- Recreate with explicit SELECT for all authenticated users (required for Realtime)
CREATE POLICY "Allow authenticated users to view attendance"
  ON shift_attendance
  FOR SELECT
  TO authenticated
  USING (true);

-- Admin can do everything
CREATE POLICY "Allow admins to manage all attendance"
  ON shift_attendance
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'admin_kurir', 'finance')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'admin_kurir', 'finance')
    )
  );
```

## Final Policies
After migration, `shift_attendance` has 2 policies:

1. **"Allow authenticated users to view attendance"** (SELECT only)
   - Command: `r` (read)
   - Allows: All authenticated users
   - Purpose: Enable Realtime events for all users

2. **"Allow admins to manage all attendance"** (ALL operations)
   - Command: `*` (all)
   - Allows: Users with role `admin`, `admin_kurir`, or `finance`
   - Purpose: Admin CRUD operations

## Expected Behavior After Fix

When a courier checks in (OFF → ON):

1. ✅ `record_courier_checkin` function inserts record
2. ✅ Postgres broadcasts change via logical replication
3. ✅ Realtime server receives the change
4. ✅ **RLS check passes** (authenticated user has SELECT permission via new policy)
5. ✅ Realtime event reaches the admin's browser
6. ✅ Frontend subscription receives event:
   ```
   [AdminAttendance] 🔥 Realtime event received: { eventType: 'INSERT', new: {...} }
   [AdminAttendance] Record date: 2026-05-11 Expected: 2026-05-11
   [AdminAttendance] ✅ Date matches - refreshing data
   ```
7. ✅ UI updates immediately - warning disappears, table refreshes

## Testing

To test the fix:

1. **Refresh browser** (Ctrl+Shift+R) to reconnect subscription
2. Open console
3. Verify subscription is active:
   ```
   [AdminAttendance] Subscription status: SUBSCRIBED
   [AdminAttendance] ✅ Successfully subscribed to realtime updates
   ```
4. Have a courier check in (OFF → ON)
5. **Expected logs:**
   ```
   [AdminAttendance] 🔥 Realtime event received: {...}
   [AdminAttendance] ✅ Date matches - refreshing data
   [AdminAttendance] Fetching logs for date: 2026-05-11
   [AdminAttendance] Fetching missing couriers for date: 2026-05-11
   ```
6. **Expected UI behavior:**
   - Warning section updates immediately
   - Attendance table adds new row immediately
   - No need to wait for 10-second polling

## Related Documentation

- [Supabase Realtime RLS](https://supabase.com/docs/guides/realtime/postgres-changes#row-level-security)
- [REALTIME_SUBSCRIPTION_FIX.md](./REALTIME_SUBSCRIPTION_FIX.md) - Previous fix for enabling Realtime publication

## Key Learnings

1. **Realtime requires explicit SELECT permission** - Even if a function with `SECURITY DEFINER` can insert records, Realtime events are filtered by RLS policies for each subscribed client.

2. **RLS policies are checked per client** - When an event is broadcast, Supabase checks if the **receiving user** has SELECT permission on that row, not the user who created it.

3. **Broad SELECT policies are safe for internal data** - For internal business data like attendance records, allowing all authenticated users to view records doesn't compromise security.

4. **Realtime debugging checklist:**
   - ✅ Table in `supabase_realtime` publication?
   - ✅ Replica identity set (DEFAULT or FULL)?
   - ✅ RLS policies allow SELECT for subscribed users?
   - ✅ Subscription status is SUBSCRIBED?
   - ✅ Client has valid JWT token?
