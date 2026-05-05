# STAY Monitoring Timing Optimization

**Date**: May 5, 2026  
**Type**: Performance & Fairness Improvement  
**Status**: ✅ Code Updated, ⏳ Awaiting Android Build & Test

---

## Problem

The STAY monitoring system used a 5-minute detection window (60 seconds × 5 readings) before revoking STAY status. This created unfairness in the courier queue system:

- Couriers with STAY status maintained priority even when leaving basecamp to complete orders
- Typical order completion time: 3-4 minutes
- Couriers could complete orders while still having STAY priority
- This was unfair to couriers who genuinely stayed at the basecamp

---

## Solution

Reduced the detection window from **5 minutes to 2.5 minutes** by changing the GPS check interval from 60 seconds to 30 seconds.

### Configuration Changes

| Parameter | Before | After | Change |
|-----------|--------|-------|--------|
| GPS Check Interval | 60 seconds | 30 seconds | ✅ Reduced |
| Revocation Threshold | 5 readings | 5 readings | ⏸️ Unchanged |
| Detection Window | 5 minutes | 2.5 minutes | ✅ Improved |

---

## Implementation

### 1. Android Native Service

**File**: `android/app/src/main/java/com/kurirdev/app/StayMonitoringService.kt`

**Changes**:
```kotlin
// BEFORE
const val INTERVAL_MS = 60_000L

// AFTER
// GPS check interval: 30 seconds (detection window: 30s × 5 = 2.5 minutes)
// Reduced from 60s to improve queue fairness while maintaining GPS error tolerance
const val INTERVAL_MS = 30_000L
```

**Log Message Added**:
```kotlin
android.util.Log.d("StayMonitor", "Starting monitoring with interval=30s, threshold=5 (2.5 min detection window)")
```

### 2. Architecture Documentation

**File**: `docs/architecture/stay-monitoring-system.md`

**Updates**:
- Added "GPS Monitoring Parameters" section with rationale
- Updated all timing references from 60s to 30s
- Updated detection window from 5 minutes to 2.5 minutes
- Added battery impact analysis
- Documented fairness improvements

---

## Benefits

### ✅ Fairness Improvements

**Before**:
```
Courier leaves basecamp at 0:00
0:30 - Still has STAY priority (counter = 1)
1:00 - Still has STAY priority (counter = 2)
1:30 - Still has STAY priority (counter = 3)
2:00 - Still has STAY priority (counter = 4)
2:30 - Still has STAY priority (counter = 5, about to revoke)
3:00 - STAY revoked (but order might be done)
4:00 - Courier returns

Problem: Had STAY priority for 3 minutes while on delivery!
```

**After**:
```
Courier leaves basecamp at 0:00
0:30 - Still has STAY priority (counter = 1)
1:00 - Still has STAY priority (counter = 2)
1:30 - Still has STAY priority (counter = 3)
2:00 - Still has STAY priority (counter = 4)
2:30 - STAY revoked (counter = 5) ✓
3:00 - No STAY priority (fair!)
4:00 - Courier returns

Improvement: STAY revoked 2.5 minutes faster!
```

### ✅ GPS Error Tolerance Maintained

- Still requires 5 consecutive out-of-zone readings
- Tolerates up to 4 consecutive GPS errors
- Counter resets when courier returns inside zone

### ⚠️ Battery Impact

**Analysis**:
- GPS checks per hour: 60 → 120 (2× increase)
- Battery usage: ~2-5% → ~3-7% per hour
- Additional drain: ~1-2% per hour
- Acceptable for typical 4-8 hour courier shifts

---

## Testing Scenarios

### Scenario 1: Courier Leaves and Doesn't Return (SHOULD REVOKE)

```
Time    GPS Reading    Counter    Action
-----   -----------    -------    ------
0:00    INSIDE         0          -
0:30    OUTSIDE        1          -
1:00    OUTSIDE        2          -
1:30    OUTSIDE        3          -
2:00    OUTSIDE        4          -
2:30    OUTSIDE        5          REVOKE! ✓
```

**Expected**: STAY revoked after 2.5 minutes

### Scenario 2: Courier Leaves Briefly and Returns (SHOULD NOT REVOKE)

```
Time    GPS Reading    Counter    Action
-----   -----------    -------    ------
0:00    INSIDE         0          -
0:30    OUTSIDE        1          -
1:00    OUTSIDE        2          -
1:30    INSIDE         0          Reset! ✓
2:00    INSIDE         0          -
2:30    INSIDE         0          -
```

**Expected**: STAY maintained (courier returned within 2.5 minutes)

### Scenario 3: GPS Error Pattern (SHOULD NOT REVOKE)

```
Time    GPS Reading    Counter    Action
-----   -----------    -------    ------
0:00    INSIDE         0          -
0:30    OUTSIDE        1          GPS error
1:00    INSIDE         0          Reset! ✓
1:30    INSIDE         0          -
2:00    OUTSIDE        1          GPS error
2:30    INSIDE         0          Reset! ✓
```

**Expected**: STAY maintained (counter resets on each "inside" reading)

---

## Manual Testing Checklist

### Prerequisites
- [ ] Android device with GPS enabled
- [ ] Location permissions granted
- [ ] Battery optimization disabled for app
- [ ] Active STAY session

### Test Cases

#### Test 1: Basic Revocation
- [ ] Activate STAY at basecamp
- [ ] Leave basecamp and stay away for 3 minutes
- [ ] Verify STAY revoked at 2.5 minutes (check logs)
- [ ] Verify status changed to 'on' in database
- [ ] Verify toast notification shown

#### Test 2: Return Before Revocation
- [ ] Activate STAY at basecamp
- [ ] Leave basecamp for 2 minutes
- [ ] Return to basecamp
- [ ] Verify STAY still active
- [ ] Verify counter reset to 0 (check logs)

#### Test 3: GPS Error Tolerance
- [ ] Activate STAY at basecamp
- [ ] Test in area with poor GPS signal
- [ ] Verify intermittent "outside" readings don't revoke STAY
- [ ] Verify counter resets when GPS shows "inside"

#### Test 4: Log Verification
- [ ] Check Android logs for: "Starting monitoring with interval=30s, threshold=5 (2.5 min detection window)"
- [ ] Verify GPS checks happen every 30 seconds
- [ ] Verify counter increments/resets correctly

#### Test 5: Battery Usage
- [ ] Monitor battery usage over 1-hour period
- [ ] Compare with previous version (if available)
- [ ] Verify battery drain is acceptable

---

## Deployment Steps

### 1. Build Android APK

```bash
cd android
./gradlew assembleDebug
```

**Output**: `android/app/build/outputs/apk/debug/app-debug.apk`

### 2. Deploy to Test Device

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### 3. Run Manual Tests

Follow the "Manual Testing Checklist" above.

### 4. Monitor Logs

```bash
adb logcat | grep StayMonitor
```

**Expected logs**:
```
StayMonitor: Starting monitoring with interval=30s, threshold=5 (2.5 min detection window)
StayMonitor: Location update: lat=X, lng=Y, distance=Z
StayMonitor: Counter: 1/5
StayMonitor: Counter: 2/5
...
StayMonitor: Threshold reached (5 >= 5), revoking STAY
StayMonitor: Revocation response: 200 (attempt 1)
```

### 5. Production Deployment

Once testing is successful:

1. Build production APK:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

2. Sign APK (if not auto-signed)

3. Deploy to app store or distribution channel

4. Monitor for issues in first 24 hours

5. Collect feedback from couriers and admins

---

## Rollback Plan

If issues occur:

### 1. Revert Code Change

```kotlin
// Change back to 60 seconds
const val INTERVAL_MS = 60_000L
```

### 2. Rebuild APK

```bash
cd android
./gradlew assembleDebug
```

### 3. Redeploy

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

**Risk**: Low - Simple constant change, easy to revert

---

## Files Modified

1. ✅ `android/app/src/main/java/com/kurirdev/app/StayMonitoringService.kt`
   - Changed `INTERVAL_MS` from 60000 to 30000
   - Added explanatory comments
   - Added log message with new timing

2. ✅ `docs/architecture/stay-monitoring-system.md`
   - Added "GPS Monitoring Parameters" section
   - Updated all timing references
   - Added rationale and fairness analysis
   - Updated battery impact analysis

3. ✅ `.kiro/specs/configurable-stay-monitoring/requirements.md`
   - Created simplified requirements (10 requirements)

4. ✅ `.kiro/specs/configurable-stay-monitoring/design.md`
   - Created design document with timing examples

5. ✅ `.kiro/specs/configurable-stay-monitoring/tasks.md`
   - Created task list (4 tasks)

6. ✅ `docs/fixes/stay-monitoring-timing-optimization.md` (this file)
   - Comprehensive documentation of the change

---

## Next Steps

1. ⏳ **Build Android APK** (requires Java/Android SDK)
2. ⏳ **Deploy to test device**
3. ⏳ **Run manual testing checklist**
4. ⏳ **Monitor battery usage**
5. ⏳ **Collect courier feedback**
6. ⏳ **Deploy to production**

---

## Notes

- **No Database Changes**: This implementation does not require any database migrations
- **No Frontend Changes**: No UI modifications needed
- **No Backend Changes**: No API modifications needed
- **Scope**: Android native service only
- **Risk Level**: Low (isolated change, easy rollback)
- **Testing**: Requires physical Android device with GPS

---

## References

- Spec: `.kiro/specs/configurable-stay-monitoring/`
- Architecture Doc: `docs/architecture/stay-monitoring-system.md`
- Android Service: `android/app/src/main/java/com/kurirdev/app/StayMonitoringService.kt`
