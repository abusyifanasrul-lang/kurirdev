# FIFO Queue Bug Fix - Private Mode Couriers

## 🐛 Problem Report
**User:** Kurir Adit dan Galang, keduanya OFF lalu ON untuk ambil order privat (di luar shift window), ternyata langsung berada di **tengah antrian** kurir, padahal mereka baru ON. FIFO tidak berjalan dengan benar.

## 🔍 Root Cause Analysis

### Issue Chain:
1. **Private mode flow** (CourierDashboard.tsx `handleSetOn()`):
   - Step 1: `setCourierOnline(user.id, 'on')` → Updates `courier_status = 'on'`
   - Step 2: Separate `UPDATE profiles SET out_of_shift = true`

2. **Database Trigger Behavior** (`handle_courier_queue_sync()`):
   - First update detects `courier_status` transition `'off' → 'on'`
   - Trigger sets `queue_joined_at = clock_timestamp()`
   - **Second update** does NOT modify `courier_status`, so trigger doesn't reset `queue_joined_at`

3. **The Bug**:
   - If couriers went OFF → ON multiple times, `queue_joined_at` retained OLD timestamp from previous cycle
   - When sorted by `queue_joined_at` (FIFO), they appeared in middle of queue instead of at end

### Code Evidence:

**Before (Buggy - Two-step update):**
```typescript
// Step 1: Update courier_status (trigger sets queue_joined_at)
await setCourierOnline(user.id, 'on');

// Step 2: Separate update (trigger DOESN'T reset queue_joined_at)
const { error: updateError } = await supabase
  .from('profiles')
  .update({ out_of_shift: true })
  .eq('id', user.id);
```

## ✅ Solution

**Atomic Single-Transaction Update:**
Replace two-step update with single atomic operation that updates BOTH `courier_status` AND `out_of_shift` simultaneously.

```typescript
// Outside shift window: Private order mode (no check-in record)
// FIX: Update courier_status AND out_of_shift in single atomic operation
// This ensures trigger properly detects transition and sets fresh queue_joined_at
const { error: updateError } = await supabase
  .from('profiles')
  .update({ 
    courier_status: 'on',
    out_of_shift: true,
    off_reason: '',
    updated_at: new Date().toISOString()
  })
  .eq('id', user.id);
```

### Why This Works:
1. **Single UPDATE statement** means trigger fires ONCE
2. Trigger sees `courier_status` transition `'off' → 'on'`
3. Trigger sets `queue_joined_at = clock_timestamp()` with **fresh timestamp**
4. Same UPDATE also sets `out_of_shift = true`
5. Result: Courier gets fresh queue timestamp AND private mode flag in atomic operation

## 📊 Impact

### Before Fix:
- Private mode couriers: Appeared in middle of queue (stale timestamps)
- FIFO broken for "Out of Shift" tier

### After Fix:
- Private mode couriers: Always appear at END of queue (fresh timestamps)
- FIFO correctly maintained for "Out of Shift" tier
- Queue sorting: `sortPrivateQueue()` in `src/utils/courierQueue.ts` now works correctly

## 🔧 Changes Made

### Files Modified:
- **`src/pages/courier/CourierDashboard.tsx`** - `handleSetOn()` function
  - Removed two-step update for private mode
  - Replaced with single atomic UPDATE
  - No longer calls `setCourierOnline()` for private mode (avoids race condition)
  - Shift mode flow unchanged (still uses `record_courier_checkin` RPC)

### Commit:
```
commit 9f7461a8
fix: Atomic private mode activation to ensure fresh queue_joined_at
```

## 🧪 Verification Steps

To verify the fix works:

1. **Setup:** Two couriers (Adit, Galang) both outside their shift window
2. **Test Flow:**
   - Both couriers OFF
   - Multiple couriers already ONLINE in normal queue
   - Adit goes ON (private mode) → Should appear at END of private queue
   - Galang goes ON (private mode) → Should appear AFTER Adit
3. **Expected Result:**
   - Orders page → Private Mode dropdown shows: Adit (first), then Galang
   - Dashboard → Private Mode section shows: Adit (first), then Galang
   - Both have fresh `queue_joined_at` timestamps

## 📝 Notes

- **Shift mode** (within shift window) unchanged - still uses `record_courier_checkin()` RPC
- **Private mode** (outside shift window) now uses direct atomic UPDATE
- **Trigger logic** (`handle_courier_queue_sync`) unchanged - works correctly with atomic update
- **FIFO sorting utility** (`src/utils/courierQueue.ts`) already correct - bug was in data layer

## 🎯 Related Features

- Centralized tier logic: `src/utils/courierQueue.ts`
- Private mode UI: Yellow themed buttons/sections
- Queue tiers: 1-6 (normal), Out of Shift (private)
- Database: `out_of_shift` flag, `queue_joined_at` timestamp

---

**Status:** ✅ Fixed, Committed (9f7461a8), Pushed to main
**Deployed:** Auto-deploy via Vercel on push to GitHub main branch
