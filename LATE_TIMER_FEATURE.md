# Late Timer Feature - Courier Dashboard

**Date:** 2026-06-03  
**Feature:** Realtime count-up timer for couriers who are late to check-in

---

## Feature Overview

Added **live late timer** di dashboard kurir yang menunjukkan **berapa lama sudah terlambat** untuk check-in. Timer ini **count-up** (menghitung naik) sejak shift start, bukan countdown.

### Visual Comparison

**BEFORE (Countdown Timer - Sebelum Shift):**
```
┌────────────────────────────────────────┐
│ 📅  JADWAL SHIFT                      │
│     10:45:00 - 11:45:00               │
│                   ⏰ 1j 1m            │
│                   MENUJU SHIFT  ◄─── ORANGE
└────────────────────────────────────────┘
```

**NEW (Count-Up Timer - Terlambat Check-In):**
```
┌────────────────────────────────────────┐
│ ⚠️  JADWAL SHIFT                      │
│     10:45:00 - 11:45:00               │
│     Terlambat 15 menit                │
│                   🔴 15m 23d          │
│                   TERLAMBAT     ◄─── RED
└────────────────────────────────────────┘
```

**AFTER CHECK-IN (Normal Status):**
```
┌────────────────────────────────────────┐
│ ✓   JADWAL SHIFT                      │
│     10:45:00 - 11:45:00               │
│                   SEDANG SHIFT  ◄─── GREEN
└────────────────────────────────────────┘
```

---

## Behavior Description

### Trigger Conditions

Timer **ONLY muncul** ketika **SEMUA kondisi ini terpenuhi**:
1. ✅ Shift sudah dimulai (current time >= shift start time)
2. ✅ Masih dalam shift window (current time < shift end time)
3. ✅ Kurir **belum check-in** (`first_online_at` masih NULL)

### Timer Display Logic

**Format berdasarkan durasi keterlambatan:**

| Durasi Terlambat | Format Display | Example |
|---|---|---|
| < 1 menit | `Xd` | `45d` |
| 1-59 menit | `Xm Yd` | `15m 23d` |
| >= 1 jam | `Xj Ym` | `1j 15m` |

**Color Scheme:** RED (sesuai late status)

### Update Frequency

- ✅ **Real-time:** Updates every **1 second**
- ✅ **Optimized:** Timer **pauses** when tab not visible (battery saving)
- ✅ **Resume:** Timer **continues** when tab becomes visible again

---

## Implementation Details

### File Modified

**File:** `src/components/courier/ShiftStatusWidget.tsx`

### Code Changes

#### 1. Added State for Late Timer

```typescript
const [lateTimer, setLateTimer] = useState<string>(''); // NEW
```

#### 2. Calculate Late Timer in updateStatus()

```typescript
// Check if currently in shift
if (currentTimeInSeconds >= shiftStartInSeconds && currentTimeInSeconds < shiftEndInSeconds) {
  setIsInShift(true);
  setCountdown('');
  
  // NEW: Calculate late timer if courier hasn't checked in yet
  if (!todayLog?.first_online_at && currentTimeInSeconds > shiftStartInSeconds) {
    const secondsLate = currentTimeInSeconds - shiftStartInSeconds;
    const hours = Math.floor(secondsLate / 3600);
    const minutes = Math.floor((secondsLate % 3600) / 60);
    const seconds = secondsLate % 60;
    
    if (hours > 0) {
      setLateTimer(`${hours}j ${minutes}m`);
    } else if (minutes > 0) {
      setLateTimer(`${minutes}m ${seconds}d`);
    } else {
      setLateTimer(`${seconds}d`);
    }
  } else {
    setLateTimer('');
  }
}
```

#### 3. Display Late Timer in Widget Content

```typescript
case 'late':
  return {
    title: `${todayLog?.shift_name || shiftInfo.name} • Terlambat ${todayLog?.late_minutes || 0} menit`,
    subtitle: `${shiftInfo.start_time} - ${shiftInfo.end_time}`,
    rightContent: lateTimer ? (
      // NEW: Show live late timer
      <div className="text-right">
        <div className="flex items-center gap-1 justify-end mb-0.5">
          <AlertCircle className="h-3 w-3 text-red-500" />
          <p className="text-xs font-black text-red-600 tabular-nums leading-none">
            {lateTimer}
          </p>
        </div>
        <p className="text-[8px] font-bold text-red-400 uppercase tracking-tight leading-none">
          Terlambat
        </p>
      </div>
    ) : (
      <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
    )
  };
```

---

## User Experience Flow

### Scenario: Kurir Terlambat Check-In

**Timeline: Shift B (10:00-11:00)**

```
09:00 - Cron job sends notification "60 menit menuju shift"
      - Tombol auto-OFF (force offline)
      - Dashboard shows: "⏰ 1j 0m MENUJU SHIFT" (countdown, orange)

09:30 - Cron job sends notification "30 menit menuju shift"
      - Dashboard shows: "⏰ 30m 0d MENUJU SHIFT" (countdown, orange)

10:00 - Shift starts
      - Kurir BELUM check-in
      - ✅ Timer switches to COUNT-UP mode
      - Dashboard shows: "🔴 0d TERLAMBAT" (count-up, RED)

10:05 - Kurir masih belum check-in
      - Dashboard shows: "🔴 5m 23d TERLAMBAT" (live update)

10:15 - Kurir AKHIRNYA check-in (tekan ON)
      - first_online_at set to current time
      - ✅ Late timer DISAPPEARS
      - Dashboard shows: "✓ SEDANG SHIFT" (green badge)
      - Attendance log: status='late', late_minutes=15
```

### Scenario: Kurir Check-In Tepat Waktu

```
09:59 - Dashboard shows: "⏰ 1m 0d MENUJU SHIFT" (countdown, orange)

10:00 - Shift starts
      - Kurir LANGSUNG tekan ON (check-in within 1 minute)
      - first_online_at set immediately
      - ✅ No late timer appears
      - Dashboard shows: "✓ SEDANG SHIFT" (green badge)
      - Attendance log: status='on_time', late_minutes=0
```

---

## Technical Notes

### Performance Optimization

**Tab Visibility Detection:**
```typescript
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    updateStatus(); // Update immediately
    startInterval(); // Resume timer
  } else {
    stopInterval(); // Pause timer
  }
};
```

**Why This Matters:**
- Mobile devices: Saves battery when app in background
- PWA: Prevents unnecessary updates when browser tab inactive
- Android APK: Pauses when app minimized

### Dependency on Realtime Subscription

**Key Point:** Late timer depends on `todayLog?.first_online_at` value.

**Flow:**
1. `useAttendanceStore.subscribeAttendance(courierId)` subscribes to `shift_attendance` table
2. When courier checks in → `first_online_at` updated in database
3. Realtime event received → `todayLog` updated in store
4. `ShiftStatusWidget` re-renders with new `todayLog.first_online_at`
5. Timer calculation detects check-in → **late timer disappears**

**This is why realtime subscription is critical!** Without it, timer wouldn't disappear until page refresh.

---

## Edge Cases Handled

### 1. Shift Already Started When Page Loads

**Scenario:** Courier opens app at 10:15, shift started at 10:00

**Expected:**
- Timer immediately shows: "🔴 15m 0d TERLAMBAT"
- Continues counting up from 15 minutes

**Implementation:**
```typescript
// Initial update runs ONCE on mount
updateStatus();

// Then interval updates every second
```

### 2. Courier Checks In During Timer Display

**Scenario:** Timer showing "🔴 12m 45d", courier presses ON

**Expected:**
- `first_online_at` updated via Realtime
- useEffect re-runs (dependency: `todayLog?.first_online_at`)
- `lateTimer` cleared
- Widget shows "✓ SEDANG SHIFT"

**Implementation:**
```typescript
useEffect(() => {
  // ...
}, [shiftInfo, todayLog?.first_online_at]); // Re-run when check-in happens
```

### 3. Multiple Shifts Per Day

**Scenario:** Courier has Shift A (06:00-08:00) and Shift B (10:00-11:00)

**Expected:**
- Timer only shows for **active shift**
- After Shift A ends → countdown to Shift B
- During Shift B (if late) → timer shows late duration for Shift B

**Implementation:**
- Widget fetches `shiftInfo` from courier's **assigned shift_id**
- Uses single shift's start/end times for all calculations
- No multi-shift logic needed (each courier has 1 assigned shift)

### 4. Excused Late Status

**Scenario:** Admin excuses courier's late check-in

**Expected:**
- Widget changes to "DIMAAFKAN" (green)
- Late timer DISAPPEARS
- No longer clickable

**Implementation:**
```typescript
if (isExcused && isInShift) {
  widgetState = 'excused';
}
// excused state doesn't show late timer
```

---

## Testing Recommendations

### Test Case 1: Manual Late Timer Test

**Steps:**
1. Open courier dashboard BEFORE shift start (e.g., 09:55 for 10:00 shift)
2. Verify countdown timer shows: "⏰ 5m 0d MENUJU SHIFT"
3. Wait until 10:00 (shift start)
4. **DO NOT press ON** (don't check in)
5. ✅ Verify timer switches to: "🔴 0d TERLAMBAT"
6. Wait 1 minute
7. ✅ Verify timer updates to: "🔴 1m 0d TERLAMBAT"
8. Press ON (check-in)
9. ✅ Verify timer disappears, shows "SEDANG SHIFT"

### Test Case 2: Background/Foreground Test

**Steps:**
1. Late timer showing: "🔴 5m 30d TERLAMBAT"
2. Switch to another tab/app (minimize)
3. Wait 2 minutes
4. Return to courier dashboard
5. ✅ Verify timer shows: "🔴 7m XXd TERLAMBAT" (updated correctly)

### Test Case 3: On-Time Check-In Test

**Steps:**
1. Countdown showing: "⏰ 2m 0d MENUJU SHIFT"
2. Wait until shift start (10:00)
3. Immediately press ON (within 10 seconds)
4. ✅ Verify NO late timer appears
5. ✅ Verify shows "SEDANG SHIFT" immediately

---

## UI/UX Improvements

### Visual Hierarchy

**Before (No Timer):**
```
Widget Priority: Icon > Title > Subtitle > Chevron
```

**After (With Late Timer):**
```
Widget Priority: Icon > Title > Subtitle > LIVE TIMER (replaces chevron)
                                            ↑
                                        RED, pulsing attention
```

### Color Psychology

| State | Color | Meaning |
|---|---|---|
| Countdown (menuju shift) | 🟠 Orange | Informational, upcoming |
| Late timer | 🔴 Red | Urgent, requires action |
| In shift (on-time) | 🟢 Green | Success, normal |
| Excused | 🔵 Blue | Neutral, resolved |

---

## Commit Details

**Commit:** `1455bc0d`  
**Message:** "feat: add realtime late timer for couriers who haven't checked in"  
**Files Changed:** `src/components/courier/ShiftStatusWidget.tsx`  
**Lines Added:** +37  
**Lines Removed:** -2

---

## Future Enhancements (Optional)

### 1. Pulsing Animation for Critical Late (> 60 min)

```css
@keyframes pulse-red {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.late-critical {
  animation: pulse-red 2s infinite;
}
```

### 2. Sound Alert at Milestones

```typescript
if (secondsLate === 3600) { // 1 hour late
  playSound('alert-critical.mp3');
}
```

### 3. Push Notification at Late Thresholds

```typescript
if (secondsLate === 600 && !notificationSent10min) {
  sendPushNotification('⚠️ Sudah 10 menit terlambat! Segera check-in.');
  setNotificationSent10min(true);
}
```

---

## Conclusion

✅ **Feature deployed successfully!**

**Summary:**
- Kurir yang terlambat sekarang bisa **lihat realtime** berapa lama sudah terlambat
- Timer **count-up** (bukan countdown) dengan format "🔴 Xj Ym" atau "🔴 Xm Yd"
- Updates setiap detik, **pauses when tab not visible** (battery efficient)
- **Automatically disappears** when courier checks in (via Realtime subscription)

**User Benefit:**
- Kurir lebih **aware** tentang keterlambatan mereka
- Visual reminder yang **urgent** (red color) untuk segera check-in
- **Transparent** tentang durasi keterlambatan sebelum denda diterapkan

**Next Step:**
- Monitor production usage
- Collect user feedback
- Consider adding sound/push alerts if needed
