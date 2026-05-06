# Tasks for Gemini - Android Native Issues

## Context
Kiro (AI assistant) is working on the frontend (TypeScript/React/Capacitor) while you (Gemini) handle Android native code (Java/Kotlin). We need your help with 2 critical Android issues.

## Issue #1: Background Location Permission Not Showing "Allow all the time"

### Problem
When requesting location permission during onboarding, the Android system dialog only shows 3 options:
- Don't allow
- Ask every time  
- Allow while using the app

The **"Allow all the time"** option is NOT shown, which is critical for STAY monitoring to work in background.

### Current Implementation
File: `android/app/src/main/java/com/kurirme/app/StayMonitorPlugin.java`

```java
@Permission(
    alias = "location",
    strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }
),
@Permission(
    alias = "backgroundLocation",
    strings = { Manifest.permission.ACCESS_BACKGROUND_LOCATION }
)
```

The frontend calls `Geolocation.requestPermissions()` from Capacitor, which only requests foreground location.

### Required Fix
On Android 10+ (API 29+), background location permission must be requested in **TWO STEPS**:
1. First request: `ACCESS_FINE_LOCATION` → Shows "While using the app" or "Only this time"
2. Second request: `ACCESS_BACKGROUND_LOCATION` → Shows "Allow all the time" option

**We need a custom method in StayMonitorPlugin.java** that:
1. Requests foreground location first
2. If granted, immediately requests background location
3. Returns success only if BOTH are granted

### Suggested Implementation
Add a new method to `StayMonitorPlugin.java`:

```java
@PluginMethod
public void requestBackgroundLocation(PluginCall call) {
    // Step 1: Check if foreground location is granted
    if (getPermissionState("location") != PermissionState.GRANTED) {
        // Request foreground first
        requestPermissionForAlias("location", call, "locationPermsCallback");
    } else {
        // Foreground already granted, request background
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            requestPermissionForAlias("backgroundLocation", call, "backgroundLocationPermsCallback");
        } else {
            // Android 9 and below don't need separate background permission
            call.resolve();
        }
    }
}

@PermissionCallback
private void locationPermsCallback(PluginCall call) {
    if (getPermissionState("location") == PermissionState.GRANTED) {
        // Foreground granted, now request background
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            requestPermissionForAlias("backgroundLocation", call, "backgroundLocationPermsCallback");
        } else {
            call.resolve();
        }
    } else {
        call.reject("Foreground location permission denied");
    }
}

@PermissionCallback
private void backgroundLocationPermsCallback(PluginCall call) {
    if (getPermissionState("backgroundLocation") == PermissionState.GRANTED) {
        call.resolve();
    } else {
        call.reject("Background location permission denied");
    }
}
```

### User Experience Goal
- User-friendly for non-technical users
- Clear two-step flow
- "Allow all the time" option must be visible and easy to select

---

## Issue #3: STAY Monitoring Notification Still Dismissible

### Problem
The STAY monitoring notification can still be swiped away to dismiss it, even though we set:
- `setOngoing(true)`
- `FLAG_ONGOING_EVENT`
- `FLAG_NO_CLEAR`
- `IMPORTANCE_HIGH`
- `PRIORITY_MAX`

### Current Implementation
File: `android/app/src/main/java/com/kurirme/app/StayMonitoringService.kt`

```kotlin
private fun buildNotification(text: String): Notification {
    val builder = NotificationCompat.Builder(this, CHANNEL_ID)
        .setContentTitle("KurirMe: STAY")
        .setContentText(text)
        .setSmallIcon(android.R.drawable.ic_menu_mylocation)
        .setOngoing(true) 
        .setPriority(NotificationCompat.PRIORITY_MAX)
        .setCategory(NotificationCompat.CATEGORY_SERVICE)
        .setContentIntent(pendingIntent)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setAutoCancel(false)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        builder.setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
    }

    val notification = builder.build()
    notification.flags = notification.flags or Notification.FLAG_ONGOING_EVENT or Notification.FLAG_NO_CLEAR
    
    return notification
}
```

### Required Fix
The notification MUST be truly non-dismissible. Users should NOT be able to swipe it away while STAY monitoring is active.

### Possible Solutions to Try
1. Check if notification channel settings override notification flags
2. Verify `IMPORTANCE_HIGH` is correct (maybe need `IMPORTANCE_LOW` to prevent dismissal?)
3. Check if `setOngoing(true)` is being overridden somewhere
4. Verify foreground service is properly started with correct type

### Testing
After fix, verify:
1. Notification appears when STAY monitoring starts
2. User CANNOT swipe away the notification
3. Notification only disappears when service stops (STAY revoked or manually stopped)

---

## Device Info
- **Platform**: Android 15 (API 35)
- **Device**: Realme RMX3938
- **Package**: com.kurirme.app
- **Target SDK**: 35
- **Min SDK**: 22

## Files You Can Edit
- `android/app/src/main/java/com/kurirme/app/StayMonitorPlugin.java`
- `android/app/src/main/java/com/kurirme/app/StayMonitoringService.kt`
- `android/app/src/main/AndroidManifest.xml` (if needed)

## Files You Should NOT Edit
- Any TypeScript/React files in `src/`
- Any JavaScript files
- Kiro will handle all frontend changes

## Communication
- Kiro will read your responses and implement frontend changes accordingly
- Please provide clear explanations of what you changed and why
- Include code snippets for any changes you make

## Priority
1. **Issue #1** (Background location) - CRITICAL for STAY monitoring
2. **Issue #3** (Non-dismissible notification) - HIGH priority for user experience

Thank you for your help!
