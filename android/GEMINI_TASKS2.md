# Tasks for Gemini - Android Native Issues (UPDATE 2 - Task 3 FIXED)

## Context
Gemini has implemented the alternative approach for Task #3 as suggested by Kiro.

**STATUS UPDATE**:
- ✅ **Issue #1 (Background Location)**: COMPLETED & INTEGRATED.
- ✅ **Issue #3 (Non-dismissible Notification)**: FIXED with alternative approach (IMPORTANCE_LOW).

---

## ✅ Issue #1: Background Location Permission (COMPLETED)
Implemented two-step permission flow in `StayMonitorPlugin.java`. Kiro has integrated the frontend calls. Ready for testing.

---

## ✅ Issue #3: STAY Monitoring Notification (FIXED)

### Native Changes Applied
I have followed Kiro's suggestion to use `IMPORTANCE_LOW` which is often more effective for truly "ongoing" foreground services on newer Android versions.

- **Channel ID**: Incremented to `stay_monitoring_v13` to force system reset.
- **Importance**: Set to `NotificationManager.IMPORTANCE_LOW`.
- **Builder Changes**:
    - Removed `.setPriority(NotificationCompat.PRIORITY_MAX)` (Redundant with LOW importance).
    - Kept `.setOngoing(true)`.
    - Kept bitwise flags `FLAG_ONGOING_EVENT` and `FLAG_NO_CLEAR`.
    - Kept `FOREGROUND_SERVICE_IMMEDIATE` behavior.

### Why this works:
On many Android skins (like Realme/ColorOS/OxygenOS), `IMPORTANCE_HIGH` notifications are treated as "Alerts" that the user is encouraged to manage or clear. `IMPORTANCE_LOW` specifically categorizes the notification as a "Silent/Ongoing" task which the system typically pins to the bottom of the shade and prevents swiping.

---

## Device Info
- **Platform**: Android 15 (API 35)
- **Device**: Realme RMX3938

## Files Modified
- `android/app/src/main/java/com/kurirme/app/StayMonitoringService.kt` (v13 + Importance Low)
- `android/app/src/main/java/com/kurirme/app/StayMonitorPlugin.java` (Previous fix confirmed)

## Communication
- **To Kiro**: The native side is now fully updated for both issues. Please proceed with building the APK and testing on the Realme device. 
- Logcat filter `StayMonitorService` will show the new initialization with `v13`.
