# Realtime Subscription Fix - shift_attendance Table

## Problem
Realtime subscription for `shift_attendance` table was connecting successfully but never receiving events when records were inserted, updated, or deleted.

**Console logs showed:**
```
[AdminAttendance] Setting up realtime subscription for date: 2026-05-11
[AdminAttendance] Subscription status: SUBSCRIBED
[AdminAttendance] ✅ Successfully subscribed to realtime updates
```

But when Adit checked in (OFF → ON), no realtime event was received:
- No `[AdminAttendance] Realtime event received` log
- Warning section didn't update automatically
- Table didn't refresh until 10-second polling interval

## Root Cause
The `shift_attendance` table was **NOT enabled for Realtime** in the `supabase_realtime` publication.

**Verification query:**
```sql
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
  AND tablename = 'shift_attendance';
```

**Result:** Empty array `[]` - table was not in the publication.

## Solution
Enabled Realtime for the `shift_attendance` table by adding it to the `supabase_realtime` publication.

**Migration:** `enable_realtime_shift_attendance`
```sql
-- Enable Realtime for shift_attendance table
ALTER PUBLICATION supabase_realtime ADD TABLE shift_attendance;
```

**Verification after fix:**
```sql
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
  AND tablename = 'shift_attendance';
```

**Result:** `[{"schemaname":"public","tablename":"shift_attendance"}]` ✅

## How Supabase Realtime Works

### 1. Publication
- Supabase uses PostgreSQL's logical replication via the `supabase_realtime` publication
- Only tables added to this publication will broadcast changes
- By default, tables are NOT automatically added to the publication

### 2. Replica Identity
- Tables need `REPLICA IDENTITY` set to determine what data is sent in change events
- `shift_attendance` already had `REPLICA IDENTITY DEFAULT` (uses primary key) ✅
- This is sufficient for Realtime to work

### 3. RLS Policies
- Row Level Security (RLS) is enabled on `shift_attendance` ✅
- RLS policies control which changes authenticated users can receive
- Existing policies allow authenticated users to read attendance records

## Expected Behavior After Fix

When a courier checks in (creates a `shift_attendance` record):

1. **Postgres** inserts the record
2. **Logical replication** detects the change (because table is in `supabase_realtime` publication)
3. **Realtime server** broadcasts the change to subscribed clients
4. **Frontend subscription** receives the event:
   ```javascript
   .on('postgres_changes', {
     event: '*',
     schema: 'public',
     table: 'shift_attendance',
   }, (payload) => {
     console.log('[AdminAttendance] Realtime event received:', payload);
     // Refresh data immediately
   })
   ```
5. **UI updates immediately** - warning disappears, table refreshes

## Testing

To test the fix:

1. Open `/admin/attendance` in browser
2. Open browser console to see logs
3. Have a courier check in (OFF → ON)
4. **Expected logs:**
   ```
   [AdminAttendance] Realtime event received: { eventType: 'INSERT', new: {...}, old: null }
   [AdminAttendance] Record date: 2026-05-11 Expected: 2026-05-11
   [AdminAttendance] Date matches - refreshing data
   [AdminAttendance] Fetching logs for date: 2026-05-11
   [AdminAttendance] Fetching missing couriers for date: 2026-05-11
   ```
5. **Expected UI behavior:**
   - Warning section updates immediately (courier removed from missing list)
   - Attendance table adds new row immediately
   - No need to wait for 10-second polling interval

## Related Files

**Frontend:**
- `src/stores/useAdminAttendanceStore.ts` - Realtime subscription setup
- `src/pages/admin/AttendanceMonitoring.tsx` - UI component with 10s polling fallback

**Backend:**
- `supabase/migrations/enable_realtime_shift_attendance.sql` - Migration to enable Realtime

**Database Functions:**
- `record_courier_checkin` - Creates `shift_attendance` records (triggers Realtime events)
- `get_missing_couriers` - Fetches couriers who haven't checked in

## Notes

- The 10-second polling interval is still active as a fallback mechanism
- This ensures UI updates even if Realtime connection drops temporarily
- Realtime provides instant updates, polling provides reliability
- Both mechanisms use the same standardized timezone utilities from `src/utils/date.ts`
