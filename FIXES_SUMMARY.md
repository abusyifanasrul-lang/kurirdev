# Summary of Fixes

## Task 3: Commission Calculation Inconsistency - FIXED ✅

### Problem
Kurir Heru had inconsistent earnings display:
- **Finance Penagihan:** Rp 2.000 (CORRECT)
- **Dashboard Kurir:** Rp 4.000 (WRONG)
- **History Earnings:** Rp 8.000 per order (WRONG)

### Root Cause
The `calcAdminEarning` and `calcCourierEarning` functions were not using the order's `applied_commission_*` fields (snapshot from when order was created). Instead, they were using the current settings, which caused inconsistencies when commission settings changed.

### Solution
Modified `src/lib/calcEarning.ts` to prioritize order's applied commission fields:
- `applied_commission_rate`
- `applied_commission_threshold`
- `applied_commission_type`

Now both functions create an `effectiveSettings` object that uses the order's applied fields if available, falling back to current settings only if not present.

### Files Changed
- `src/lib/calcEarning.ts` - Added logic to prioritize order's applied_commission_* fields
- `src/pages/courier/CourierDashboard.tsx` - Removed manual override since function handles it internally

### Testing
Please verify:
1. Finance Penagihan shows correct amounts
2. Dashboard Kurir "BELUM DISETOR" matches Finance Penagihan
3. History Earnings shows correct per-order amounts
4. All calculations use the commission settings from when the order was created, not current settings

---

## Task 3.1: Settings UI Enhancement - FIXED ✅

### Problem
Settings page tidak menunjukkan dengan jelas perhitungan mana yang aktif (Persentase vs Potong Ribuan).

### Solution
Enhanced `src/components/settings/BusinessTab.tsx` with:
1. **"AKTIF" badge** on selected commission type button (green badge with white text)
2. **Prominent info box** below the segmented control showing:
   - Active mode name
   - Current calculation details in plain language
   - Color-coded: teal for percentage, amber for flat
   - Example: "Kurir mendapat 80% dari ongkir, Admin mendapat 20%. Ongkir ≤ Rp 5.000 tidak dipotong."

### Verification
Tombol "Simpan Pengaturan" sudah benar:
- ✅ Calls `updateSettings(data)` to update Zustand store
- ✅ Calls `syncSettingsToServer()` to update database
- ✅ Database column `commission_type` exists and is updated
- ✅ Current value in DB: `commission_type: "percentage"`

### Files Changed
- `src/components/settings/BusinessTab.tsx` - Enhanced UI with active mode indicator

---

## Task 2: Realtime Late Check-In Alert - IN PROGRESS 🔄

### Current Status
- ✅ Backend fixes completed (timezone, NULL handling, type mismatches)
- ✅ Subscription connects successfully (SUBSCRIBED status)
- ✅ Table in publication: YES
- ✅ RLS policies: Allow SELECT for authenticated
- ✅ Replica identity: FULL
- ✅ Static channel name: 'attendance-today'
- ✅ 60-second check for missing couriers (warning panel updates)
- ❌ **Events not received when courier checks in**

### Investigation
Added detailed logging to help diagnose why Realtime events are not being received:
- Timestamps on all console logs
- Error logging in subscription callback
- Event type logging
- Subscription status tracking

### Next Steps
1. **Test with enhanced logging**: When a courier checks in, we should now see detailed logs showing:
   - Whether the event is received
   - The event type (INSERT/UPDATE/DELETE)
   - The record date vs expected date
   - Any errors in the subscription

2. **If events are still not received**, possible causes:
   - Supabase Realtime connection pool exhaustion (seen in logs)
   - RLS policies blocking Realtime events (though SELECT policy looks correct)
   - Channel configuration issue (though other channels work fine)

3. **Workaround if Realtime continues to fail**:
   - Reduce polling interval from 60s to 10-15s
   - Add visual indicator that data is being refreshed
   - Consider using Supabase Edge Functions with webhooks

### Files Changed
- `src/stores/useAdminAttendanceStore.ts` - Enhanced logging for debugging

### Testing Instructions
1. Open Admin Attendance Monitoring page
2. Open browser console
3. Have a courier check in (click ON button)
4. Check console for:
   - `[AdminAttendance] 🔥 Realtime event received:` - If this appears, Realtime is working!
   - If not, check for any error messages
   - Note the timestamps to see if there's a delay

---

## Commits Made
1. `1feb8ac3` - fix: prioritize order's applied_commission fields in earning calculations
2. `9068dcd0` - debug: add detailed logging to attendance realtime subscription
3. `2433bdbc` - feat: add clear visual indicator for active commission mode

**Note:** Changes committed but NOT pushed (as per user's instruction to save tokens).
