# Tasks for Gemini - GPS Accuracy Improvement (COMPLETED)

## Context
User reported poor GPS accuracy causing premature revocation of STAY status. Gemini has implemented a sophisticated GPS filtering and evaluation system.

**STATUS**: ✅ **COMPLETED**

---

## Implementation Details

I have implemented a production-grade GPS filtering system in `StayMonitoringService.kt` using the following techniques:

### 1. Exponential Moving Average (EMA) Smoothing
Instead of raw coordinates, the service now maintains a "smoothed" position.
- **Formula**: `smoothed = (new * 0.4) + (old * 0.6)`
- **Benefit**: Redraws the "jitter" caused by GPS noise while remaining responsive to actual movement.

### 2. Hysteresis Logic & Uncertain Zone
We now use an asymmetrical state machine for STAY transitions:
- **IN → OUT (Strict)**: Only increments the counter if `(distance - accuracy) > radius`. This means even the closest edge of the error circle is outside the basecamp.
- **OUT → IN (Tolerant)**: Resets immediately if `distance < (radius + dynamicBuffer)`. 
- **Uncertain Zone**: If the courier is in a gray area (error circle overlaps the boundary), we "freeze" the counter and wait for better data.

### 3. Stale Location Protection
- **Age Check**: Skips any location data older than 60 seconds (detected via `elapsedRealtimeNanos`).
- **Benefit**: Prevents false revocations caused by the system returning old cached locations when GPS is lost.

### 4. Optimized LocationRequest
- **Min Distance**: `setMinUpdateDistanceMeters(3f)` to ignore minor oscillations when stationary.
- **Max Age**: `setMaxUpdateAgeMillis(60_000)` to ensure fresh data.
- **Interval**: 30s interval with 10s min interval for better responsiveness.

### 5. Adaptive Reset Buffer
- Uses a dynamic buffer (5m to 15m) based on current accuracy to make it easier for couriers to "return" to STAY status in poor signal conditions.

---

## Technical Specs
- **Channel ID**: `stay_monitoring_v14`
- **EMA Alpha**: 0.4
- **Accuracy Filter**: Skip if `accuracy > 150m` (likely BTS jump)
- **Consecutive Limit**: 4 (approx 2 minutes of "definitely outside" readings)

## Files Modified
- `android/app/src/main/java/com/kurirme/app/StayMonitoringService.kt`

## Feedback for Kiro
The native side is now much more robust. 
1. **Testing**: Please test in an area with weak GPS (indoors) to verify the "Uncertain Zone" holding the state.
2. **Logs**: Use `adb logcat | grep StayMonitorService` to see real-time EVAL logs showing `State=INSIDE/OUTSIDE/UNCERTAIN`.
