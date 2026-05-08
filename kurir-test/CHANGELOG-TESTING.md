# Playwright Testing Improvements

## Changes Made (2026-05-08)

### 1. Browser Permissions
**Added**: Notification and Geolocation permissions to all contexts

**Admin Context:**
```javascript
permissions: ['notifications']
```

**Courier Contexts:**
```javascript
permissions: ['notifications', 'geolocation']
geolocation: { latitude: -5.1477, longitude: 119.4327 }  // Makassar
```

**Impact:**
- Notifications should now work in Playwright
- Geolocation ready for STAY monitoring tests

---

### 2. Staggered Launch
**Changed**: Delay between courier window launches

**Before:** 1000ms (1 second)
**After:** 2500ms (2.5 seconds)

**Impact:**
- Reduces concurrent database operations
- Gives each courier time to establish realtime connection
- Reduces race conditions during login

---

### 3. Realtime Monitoring
**Added**: Automatic console logging for realtime connection status

**What it does:**
- Logs every 5 seconds for 100 seconds (20 checks total)
- Shows realtime connection status
- Shows active orders count

**Console Output Example:**
```
[RT-Monitor 1] Status: { "orders:courier:xxx": "joining" } | Active Orders: 0
[RT-Monitor 2] Status: { "orders:courier:xxx": "joined" } | Active Orders: 0
[RT-Monitor 3] Status: { "orders:courier:xxx": "joined" } | Active Orders: 1
```

**How to use:**
1. Open browser console (F12) in any courier window
2. Watch for `[RT-Monitor]` logs
3. Verify status changes from "joining" → "joined"
4. Verify active orders count updates when admin creates orders

---

### 4. Automation Detection
**Added**: Flag to hide automation detection

```javascript
'--disable-blink-features=AutomationControlled'
```

**Impact:**
- Browser behaves more like a real user browser
- Some websites detect Playwright/Selenium and behave differently
- This flag helps avoid that detection

---

## Testing Protocol

### Step 1: Launch Test
```bash
cd kurir-test
node launch-test.js
```

**Expected:**
- 9 windows open (1 admin + 8 couriers)
- Each window takes ~2.5s to launch
- Total launch time: ~25 seconds

### Step 2: Verify Realtime Connections
1. Open console (F12) in 2-3 courier windows
2. Wait for `[RT-Monitor]` logs
3. Verify all show `"joined"` status within 30 seconds

**Good:**
```
[RT-Monitor 3] Status: { "orders:courier:abc123": "joined" } | Active Orders: 0
```

**Bad:**
```
[RT-Monitor 5] Status: { "orders:courier:abc123": "errored" } | Active Orders: 0
```

### Step 3: Test Order Assignment
1. Go to Admin window
2. Create a new order
3. Assign to a courier
4. Watch courier console for:
   - `[RT-Monitor]` showing Active Orders: 1
   - Order appearing in dashboard

### Step 4: Test FIFO Queue
1. Set all 8 couriers to "ON" status
2. Note the order they went online (check console timestamps)
3. Create 3 orders from admin
4. Verify orders are assigned in FIFO order

**Expected FIFO:**
- Order 1 → First courier who went online
- Order 2 → Second courier who went online
- Order 3 → Third courier who went online

### Step 5: Test Notifications
1. Create order from admin
2. Assign to courier
3. Check if notification appears in courier window

**Note:** Browser notifications may not work perfectly in Playwright even with permissions. This is a known limitation.

---

## Troubleshooting

### Issue: Realtime shows "errored" or "closed"
**Possible causes:**
- Supabase connection limit reached
- Network issues
- Too many concurrent connections

**Solutions:**
1. Reduce number of couriers (test with 3-4 first)
2. Check Supabase dashboard for connection count
3. Restart test after closing all windows

### Issue: Orders not appearing in courier dashboard
**Check:**
1. Console for `[RT-Monitor]` logs - is status "joined"?
2. Network tab - are WebSocket connections established?
3. Admin dashboard - is order actually assigned to that courier?

**Debug:**
```javascript
// In courier console, run:
window.__ZUSTAND_STORES__.orderStore.getState().activeOrdersByCourier
// Should show array of orders
```

### Issue: FIFO not working correctly
**Check:**
1. Database `profiles` table - `queue_timestamp` column
2. Are timestamps different for each courier?
3. Are couriers going online in the expected order?

**Debug:**
```sql
-- Run in Supabase SQL Editor
SELECT id, name, queue_timestamp, is_online, courier_status 
FROM profiles 
WHERE role = 'courier' 
ORDER BY queue_timestamp;
```

### Issue: Notifications not appearing
**Expected behavior:**
- Playwright has limited notification support
- Notifications may not appear even with permissions granted
- This is a known limitation of browser automation tools

**Workaround:**
- Test notifications manually with real browser
- Or use real devices for notification testing

---

## Known Limitations

### 1. Notifications
- May not work reliably in Playwright
- Browser automation tools have limited notification support
- Recommend manual testing for notifications

### 2. Service Workers
- May not behave exactly like production
- Background sync may not work
- Push notifications may not work

### 3. Concurrent Connections
- 9 windows = 9+ WebSocket connections to Supabase
- May hit connection limits on free tier
- Recommend testing with fewer couriers if issues occur

### 4. Performance
- 9 windows consume significant RAM (~2-3GB)
- May slow down on lower-end machines
- Recommend closing other applications during testing

---

## Recommendations

### For Development Testing
- Use 3-4 couriers instead of 8
- Faster to launch and easier to debug
- Less resource intensive

### For Load Testing
- Use all 8 couriers
- Monitor system resources
- Check Supabase connection limits

### For Production Validation
- Use real devices (phones/tablets)
- Test with actual network conditions
- Validate notifications work correctly

---

## Next Steps

1. **Run test with current changes**
2. **Monitor console logs for [RT-Monitor]**
3. **Report results:**
   - Does FIFO work correctly?
   - Do orders appear in realtime?
   - Do notifications work?
4. **Adjust based on findings**

