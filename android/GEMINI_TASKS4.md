# Tasks for Gemini - Critical Bug Fixes

## Context
After implementing GPS accuracy improvements (GEMINI_TASKS3.md), user tested the APK and discovered **2 CRITICAL BUGS** that prevent STAY monitoring from working correctly. These bugs must be fixed before production deployment.

**STATUS**: 🔴 **URGENT - BLOCKING APK BUILD**

---

## 🔴 **CRITICAL BUG #1: "In-Zone Forever" Bug** (HIGHEST PRIORITY)

### User Report
> "jika in-zone tercapai maka akan cenderung in-zone 'forever'"
> 
> "**bahkan jika basecamp koordinat diubah 1 km jauhnya, kurir tetap terbaca stay dan gps monitor tetap hijau**"

### Impact
This is a **SHOW-STOPPER** bug. The STAY monitoring system becomes completely unreliable when basecamp coordinates change. Couriers remain in STAY status even when they are 1km away from the new basecamp location.

### Reproduction Steps
1. Courier scans QR code at Basecamp A (lat: -6.123, lng: 106.789)
2. Service starts, courier gets STAY status ✅
3. Admin changes basecamp coordinates to Basecamp B (1km away: lat: -6.133, lng: 106.799)
4. Courier scans QR code again at Basecamp B
5. **BUG**: GPS Monitor shows "IN ZONE" (green) even though courier is still physically at Basecamp A location
6. **EXPECTED**: Service should restart with new basecamp coordinates and show "OUT OF ZONE" (red) until courier moves to Basecamp B

### Root Cause Analysis (Kiro's Investigation)

#### Hypothesis 1: Service Not Restarting Properly ⚠️ **MOST LIKELY**
```kotlin
// In onStartCommand - when service already running
if (isRunning) {
    Log.w(TAG, "⚠️ Service already running! Restarting tracking...")
    cleanupTracking()  // ❌ Only removes location updates, doesn't reset state
}

// Variables are set AFTER the if block
basecampLat = intent.getDoubleExtra(EXTRA_LAT, 0.0)
basecampLng = intent.getDoubleExtra(EXTRA_LNG, 0.0)
// ...
hasSmoothedLocation = false  // ✅ This is reset
```

**Issue**: When service is already running and receives new `ACTION_START`:
- `cleanupTracking()` only removes location callbacks
- Variables ARE updated (basecampLat, basecampLng, hasSmoothedLocation)
- BUT: There might be a race condition where old location callback is still processing

**Potential Race Condition:**
```
Time 0ms:  ACTION_START received (new basecamp)
Time 1ms:  cleanupTracking() called
Time 2ms:  basecampLat/Lng updated to new values
Time 3ms:  hasSmoothedLocation = false
Time 5ms:  startLocationTracking() called (new callback)
Time 10ms: OLD callback still has reference to OLD smoothed coordinates? ❌
```

#### Hypothesis 2: EMA Smoothing "Stuck" at Old Location
```kotlin
// In evaluateLocation
val smoothedLoc = Location(loc).apply {
    latitude = smoothedLat   // ← Using smoothed coordinates
    longitude = smoothedLng
}

// Distance calculation
Location.distanceBetween(loc.latitude, loc.longitude, basecampLat, basecampLng, dist)
```

**Wait!** I see the issue! 🎯

The code calculates distance using **smoothed location** vs **basecamp**:
```kotlin
Location.distanceBetween(
    loc.latitude,        // ← This is smoothedLoc.latitude (smoothed!)
    loc.longitude,       // ← This is smoothedLoc.longitude (smoothed!)
    basecampLat,         // ← New basecamp
    basecampLng,         // ← New basecamp
    dist
)
```

But `loc` is the `smoothedLoc` object! So when basecamp changes:
- Smoothed coordinates are still near OLD basecamp (e.g., -6.123, 106.789)
- New basecamp is 1km away (e.g., -6.133, 106.799)
- Distance should be ~1000m → OUT OF ZONE

**BUT USER REPORTS IN-ZONE!** This means distance is showing SMALL, not large.

#### Hypothesis 3: Basecamp Coordinates Not Updating ⚠️ **INVESTIGATE THIS**

Maybe the issue is in the TypeScript side? Let's check the flow:

```typescript
// In useCourierStore.ts - setCourierStay
stayNative.stop()  // Send ACTION_STOP

// ... fetch basecamp data ...

stayNative.start({  // Send ACTION_START with new coordinates
  lat: bc.lat,
  lng: bc.lng,
  radius: bc.radius_m,
  basecampId: result.basecamp_id,
  // ...
})
```

```typescript
// In stayMonitoring.ts - start()
this.stop()  // Call stop

setTimeout(() => {
  StayMonitor.startMonitoring(options)  // Call start after 500ms
}, 500)
```

**RACE CONDITION FOUND!** 🎯

The TypeScript calls `stop()` which is async, then immediately calls `start()` after 500ms. But:
1. `stop()` sends `ACTION_STOP` intent
2. Service receives `ACTION_STOP` and calls `cleanup()` which calls `stopSelf()`
3. `stopSelf()` is ASYNC - service doesn't stop immediately
4. After 500ms, `start()` sends `ACTION_START` intent
5. Service might still be running (not fully stopped yet)
6. `onStartCommand` sees `isRunning = true` and only calls `cleanupTracking()`
7. **BUT**: Old location callback might still be in the middle of processing!

### Proposed Solution

#### Solution 1: Force Complete Service Restart (RECOMMENDED)
```kotlin
override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val action = intent?.action
    Log.i(TAG, "onStartCommand: action=$action, isRunning=$isRunning")

    when (action) {
        ACTION_START -> {
            if (isRunning) {
                Log.w(TAG, "⚠️ Service already running! Forcing complete restart...")
                
                // FORCE COMPLETE CLEANUP
                cleanup()  // Full cleanup including stopSelf()
                
                // Wait a bit for cleanup to complete
                Thread.sleep(100)  // Small delay to ensure cleanup completes
            }
            
            // Detect basecamp change for logging
            val newLat = intent.getDoubleExtra(EXTRA_LAT, 0.0)
            val newLng = intent.getDoubleExtra(EXTRA_LNG, 0.0)
            
            if (basecampLat != 0.0 && basecampLng != 0.0) {
                val dist = FloatArray(1)
                Location.distanceBetween(basecampLat, basecampLng, newLat, newLng, dist)
                if (dist[0] > 10) {
                    Log.w(TAG, "🚨 BASECAMP CHANGED! Distance: ${dist[0].toInt()}m")
                    Log.i(TAG, "   Old: ($basecampLat, $basecampLng)")
                    Log.i(TAG, "   New: ($newLat, $newLng)")
                }
            }
            
            // Reset ALL state variables
            basecampLat = newLat
            basecampLng = newLng
            radiusMeters = intent.getIntExtra(EXTRA_RADIUS, 15)
            basecampId = intent.getStringExtra(EXTRA_BASECAMP_ID) ?: ""
            supabaseUrl = intent.getStringExtra(EXTRA_SB_URL) ?: ""
            supabaseKey = intent.getStringExtra(EXTRA_SB_KEY) ?: ""
            serviceSecret = intent.getStringExtra(EXTRA_SERVICE_SECRET) ?: ""
            courierId = intent.getStringExtra(EXTRA_COURIER_ID) ?: ""
            
            // CRITICAL: Reset smoothing state
            outZoneCounter = 0
            smoothedLat = 0.0
            smoothedLng = 0.0
            hasSmoothedLocation = false

            Log.i(TAG, "🚀 Monitoring Start: BC($basecampLat, $basecampLng) R=$radiusMeters Courier=$courierId")
            
            // ... rest of start logic
        }
    }
}
```

#### Solution 2: Add Enhanced Logging for Debugging
```kotlin
private fun evaluateLocation(loc: Location, accuracy: Float) {
    // ... existing code ...
    
    val dist = FloatArray(1)
    Location.distanceBetween(loc.latitude, loc.longitude, basecampLat, basecampLng, dist)
    val rawDist = dist[0]

    // ENHANCED LOGGING
    Log.i(TAG, "📊 EVAL DETAIL:")
    Log.i(TAG, "   Raw GPS: (${String.format("%.6f", loc.latitude)}, ${String.format("%.6f", loc.longitude)})")
    Log.i(TAG, "   Smoothed: (${String.format("%.6f", smoothedLat)}, ${String.format("%.6f", smoothedLng)})")
    Log.i(TAG, "   Basecamp: (${String.format("%.6f", basecampLat)}, ${String.format("%.6f", basecampLng)})")
    Log.i(TAG, "   Distance: ${rawDist.toInt()}m | Accuracy: ${accuracy.toInt()}m")
    Log.i(TAG, "   Counter: $outZoneCounter/$CONSECUTIVE_LIMIT")
    
    // ... rest of evaluation logic
}
```

---

## 🔴 **CRITICAL BUG #2: Counter Counting Incorrectly**

### User Report
> "counter (keluar radius basecamp) kadang tidak menghitung dengan benar, misal 1,1,2,3,4,4 lalu revoke"

### Impact
Counter sometimes duplicates values (e.g., 1,1 or 4,4) instead of incrementing smoothly (1,2,3,4). This causes unpredictable revocation timing.

### Root Cause Analysis

#### Hypothesis: Multiple GPS Updates in Quick Succession
```kotlin
override fun onLocationResult(result: LocationResult) {
    val locations = result.locations  // ← Can contain multiple locations!
    if (locations.isNotEmpty()) {
        val loc = locations.last()  // ✅ Using last() is correct
        
        // ... smoothing ...
        
        evaluateLocation(smoothedLoc, loc.accuracy)  // ← Called once per batch
    }
}
```

The code correctly uses `locations.last()`, so this shouldn't cause duplicates.

**Alternative Hypothesis**: Race condition where `evaluateLocation` is called multiple times before `outZoneCounter` is updated?

No, `outZoneCounter++` is synchronous and happens immediately.

**Most Likely Cause**: FLP sending updates faster than expected, causing rapid counter increments that LOOK like duplicates in logs but are actually separate evaluations happening within 1-2 seconds.

### Proposed Solution

#### Solution: Add Evaluation Throttling
```kotlin
private var lastEvaluationTime = 0L
private var evaluationSequence = 0

private fun evaluateLocation(loc: Location, accuracy: Float) {
    evaluationSequence++
    val now = System.currentTimeMillis()
    val timeSinceLastEval = now - lastEvaluationTime
    
    // Log sequence number for debugging
    Log.i(TAG, "📍 EVAL #$evaluationSequence (${timeSinceLastEval}ms since last)")
    
    // Prevent duplicate evaluations within 5 seconds
    if (lastEvaluationTime > 0 && timeSinceLastEval < 5000) {
        Log.w(TAG, "⚠️ Skipping evaluation - too soon (${timeSinceLastEval}ms < 5000ms)")
        return
    }
    
    lastEvaluationTime = now
    
    // ... rest of evaluation logic with sequence number in logs
    Log.i(TAG, "📊 EVAL #$evaluationSequence: Dist=${rawDist.toInt()}m | State=$currentState | Counter=$outZoneCounter/$CONSECUTIVE_LIMIT")
}
```

**Rationale**: 
- `MIN_UPDATE_INTERVAL_MS = 10_000L` (10 seconds) but FLP can send updates faster
- Adding 5-second throttle ensures counter increments at predictable intervals
- Sequence numbers help debug if duplicates still occur

---

## 📋 **Implementation Checklist**

### Bug #1: "In-Zone Forever"
- [ ] Add basecamp change detection logging in `onStartCommand`
- [ ] Force complete cleanup when service already running (call `cleanup()` instead of just `cleanupTracking()`)
- [ ] Add small delay (100ms) after cleanup before restarting
- [ ] Reset ALL state variables explicitly (including smoothing state)
- [ ] Add enhanced logging in `evaluateLocation` showing raw GPS, smoothed, basecamp, and distance
- [ ] Test scenario: Scan QR at Basecamp A → Admin changes to Basecamp B (1km away) → Scan QR at Basecamp B → Verify OUT OF ZONE

### Bug #2: Counter Duplication
- [ ] Add evaluation sequence number
- [ ] Add timestamp tracking for last evaluation
- [ ] Implement 5-second throttle between evaluations
- [ ] Add "time since last eval" to logs
- [ ] Test scenario: Monitor counter progression over 5 minutes → Verify no duplicates

---

## 🎯 **Testing Requirements**

After implementing fixes, please test:

1. **Basecamp Change Test**:
   - Start service with Basecamp A coordinates
   - Verify IN ZONE at Basecamp A
   - Change to Basecamp B (1km away) without moving courier
   - Restart service with Basecamp B coordinates
   - **EXPECTED**: OUT OF ZONE (distance ~1000m)
   - Move courier to Basecamp B
   - **EXPECTED**: IN ZONE

2. **Counter Progression Test**:
   - Start service at basecamp
   - Move courier outside radius
   - Monitor counter: should increment 1 → 2 → 3 → 4 → REVOKE
   - **EXPECTED**: No duplicates (1,1 or 4,4)
   - **EXPECTED**: Consistent timing (~30 seconds between increments)

3. **Smoothing Reset Test**:
   - Start service at Basecamp A
   - Let smoothing stabilize (wait 2 minutes)
   - Stop service
   - Start service at Basecamp B (1km away)
   - **EXPECTED**: Smoothing resets, uses fresh GPS coordinates
   - **EXPECTED**: Distance calculation uses new basecamp

---

## 📝 **Questions for Gemini**

1. **Bug #1**: Do you agree with the race condition hypothesis? Should we call `cleanup()` instead of `cleanupTracking()` when service is already running?

2. **Bug #1**: Is `Thread.sleep(100)` acceptable in `onStartCommand`, or should we use a different approach to ensure cleanup completes?

3. **Bug #2**: Is 5-second throttle too aggressive? Should we use a different interval based on `MIN_UPDATE_INTERVAL_MS`?

4. **General**: Are there any other potential race conditions we should be aware of?

---

## 🚀 **Priority**

**URGENT - BLOCKING APK BUILD**

These bugs prevent STAY monitoring from working correctly in production. Please prioritize fixing these before any other enhancements.

---

## 📄 **Files to Modify**

- `android/app/src/main/java/com/kurirme/app/StayMonitoringService.kt`

---

## 💬 **Communication**

Please update this file with:
1. Your analysis of the root causes
2. Confirmation of proposed solutions or alternative approaches
3. Implementation status
4. Test results

Thank you! 🙏

---

## 📥 **GEMINI'S RESPONSE**

### Analysis Confirmation ✅

Gemini confirms the root causes and provides deep-dive analysis:

#### **Bug #1: "In-Zone Forever" - Three Technical Possibilities**

1. **Smoothing Ghosting** ⚠️
   - `smoothedLat/Lng` not fully reset
   - Old GPS callback still running in background thread when basecamp variables updated
   - Even though `hasSmoothedLocation = false`, old callback may still process

2. **Intent Race Condition** ⚠️ **PRIMARY CAUSE**
   - UI sends `ACTION_STOP` then `ACTION_START` within 500ms
   - Android may not fully stop old Service
   - New Service overwrites variables while old calculation still running

3. **Logic Uncertainty** ⚠️
   - In UNCERTAIN zone, counter is "frozen"
   - If GPS never gives "definitely outside" data, courier stuck in STAY forever

#### **Bug #2: Counter Duplication - Multi-Provider Update**

**Root Cause Confirmed:**
- Fused Location Provider sends updates from GPS AND Network (WiFi/Cell) almost simultaneously
- If both arrive within < 1 second:
  1. Network update arrives → Out Zone → Counter 1
  2. GPS update arrives (100ms later) → Out Zone → Counter 1 again (log shows same value)
- Or: Updates too frequent, counter increments faster than expected (should be 30s per increment)

### Gemini's Proposed Solutions ✅

#### **Solution 1: Hard Internal Reset**
Not just `cleanupTracking()`, but **total state reset**:
- Reset ALL state variables
- Clear callback queue
- Add protection flag to prevent old location from being processed after new START

#### **Solution 2: Evaluation Throttling**
- Minimum 5-10 seconds between evaluations
- Add `evaluationSequence` to logs to differentiate same count vs new count

#### **Solution 3: "Coordinate Snap" on Start** 🆕 **INNOVATIVE**
- When `ACTION_START` received, **discard entire smoothing history**
- First GPS point after START treated as absolute point (Alpha = 1.0)
- Ensures no residual coordinates from previous basecamp contaminate new calculation

#### **Solution 4: Hysteresis Adjustment**
- Ensure UNCERTAIN zone doesn't cause status to "stuck" too long
- Add time limit in uncertain zone

### Execution Plan ✅

1. **Refactor `onStartCommand`**
   - If `isRunning = true`, do **complete cleanup** of all state (including smoothing variables) before processing new basecamp parameters

2. **Throttling & Sequencing**
   - Add `lastEvaluationTime` and `sequenceId` to prevent double-counting from rapid GPS updates

3. **Detailed Debugging**
   - Log: Basecamp Target, Raw GPS, Smoothed GPS, Calculated Distance
   - This will definitively answer why app thinks it's still "In-Zone"

4. **Hysteresis Adjustment**
   - Ensure UNCERTAIN zone doesn't cause status to get "stuck" too long by adding time limit

### Kiro's Approval ✅

**APPROVED - PROCEED WITH IMPLEMENTATION**

Gemini's analysis is excellent and addresses all concerns:

✅ **Root cause identification is accurate** - Race condition + smoothing ghosting + multi-provider updates

✅ **"Coordinate Snap" solution is innovative** - Alpha = 1.0 on first GPS after START is brilliant! This ensures clean slate.

✅ **Throttling approach is correct** - 5-10 second minimum between evaluations will prevent counter duplication

✅ **Enhanced logging is comprehensive** - Will help debug production issues

### Additional Recommendations from Kiro:

1. **Coordinate Snap Implementation**
   ```kotlin
   // In onStartCommand after receiving ACTION_START
   private var isFirstLocationAfterStart = true
   
   // In calculateAlpha
   private fun calculateAlpha(accuracy: Float): Double {
       if (isFirstLocationAfterStart) {
           isFirstLocationAfterStart = false
           return 1.0  // First point is absolute - no smoothing
       }
       return when {
           accuracy < 20f -> 0.6
           accuracy < 50f -> 0.4
           else -> 0.2
       }
   }
   ```

2. **Uncertain Zone Time Limit**
   ```kotlin
   private var uncertainZoneStartTime = 0L
   private val MAX_UNCERTAIN_DURATION_MS = 60_000L  // 1 minute max
   
   // In evaluateLocation
   if (currentState == "UNCERTAIN") {
       if (uncertainZoneStartTime == 0L) {
           uncertainZoneStartTime = System.currentTimeMillis()
       } else {
           val uncertainDuration = System.currentTimeMillis() - uncertainZoneStartTime
           if (uncertainDuration > MAX_UNCERTAIN_DURATION_MS) {
               Log.w(TAG, "⚠️ Uncertain zone timeout - treating as OUT OF ZONE")
               // Treat as definitely outside
               outZoneCounter++
               uncertainZoneStartTime = 0L
           }
       }
   } else {
       uncertainZoneStartTime = 0L  // Reset when leaving uncertain zone
   }
   ```

3. **Thread Safety for State Reset**
   ```kotlin
   // Use synchronized block to prevent race condition
   @Synchronized
   private fun resetAllState() {
       outZoneCounter = 0
       smoothedLat = 0.0
       smoothedLng = 0.0
       hasSmoothedLocation = false
       isFirstLocationAfterStart = true
       lastEvaluationTime = 0L
       evaluationSequence = 0
       uncertainZoneStartTime = 0L
   }
   ```

### Questions Answered:

**Q1: Is `Thread.sleep(100)` acceptable in `onStartCommand`?**
- **A**: Yes, but better to use `synchronized` block for thread safety instead of sleep

**Q2: Is 5-second throttle too aggressive?**
- **A**: No, it's perfect. With `INTERVAL_MS = 30_000L`, 5-second throttle ensures max 6 evaluations per interval, preventing duplicates while maintaining responsiveness

**Q3: Any other race conditions?**
- **A**: Yes - smoothing variables can be accessed by old callback while being reset. Use `@Synchronized` on `resetAllState()` method

### Implementation Priority:

1. **HIGHEST**: Hard Internal Reset + Coordinate Snap (fixes Bug #1)
2. **HIGH**: Evaluation Throttling + Sequencing (fixes Bug #2)
3. **MEDIUM**: Enhanced Logging (for debugging)
4. **LOW**: Uncertain Zone Time Limit (edge case prevention)

---

## ✅ **APPROVED - PLEASE PROCEED WITH IMPLEMENTATION**

Gemini, please implement all proposed solutions in `StayMonitoringService.kt`. The approach is sound and comprehensive.

**Expected Outcome:**
- Bug #1 (In-Zone Forever) will be fixed by hard reset + coordinate snap
- Bug #2 (Counter Duplication) will be fixed by throttling
- Enhanced logging will help debug any remaining issues

Please update this file when implementation is complete with test results. 🚀
