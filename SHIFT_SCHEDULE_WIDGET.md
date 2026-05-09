# Shift Schedule Widget - Documentation

## Overview

Panel minimalis di dashboard kurir yang menampilkan jadwal shift dengan countdown timer menuju waktu shift berikutnya.

---

## ✨ Features

### 1. **Tampilan Jadwal Shift**
- Nama shift (e.g., "Shift A", "Shift B")
- Waktu shift (e.g., "07:00 - 10:00")
- Icon calendar untuk visual clarity

### 2. **Status Dinamis**

#### Saat Sedang Shift (In-Shift)
- Badge hijau "Sedang Shift"
- Background gradient emerald
- Border emerald

#### Saat Di Luar Shift (Out-of-Shift)
- Countdown timer menuju shift berikutnya
- Format: "Xj Ym" (jam dan menit) atau "Ym" (hanya menit)
- Icon clock dengan warna orange
- Label "Menuju Shift"

### 3. **Auto-Update**
- Timer update setiap 1 menit
- Status in-shift/out-of-shift update otomatis
- Tidak perlu refresh manual

---

## 🎨 Design

### Minimalis & Clean
- Compact layout
- Responsive design (mobile-first)
- Consistent dengan design system yang ada
- Menggunakan Tailwind utility classes

### Color Scheme

**In-Shift (Sedang Shift)**:
- Background: `emerald-50` gradient
- Border: `emerald-200`
- Icon background: `emerald-100`
- Icon color: `emerald-600`
- Badge: `emerald-100` background, `emerald-700` text

**Out-of-Shift (Di Luar Shift)**:
- Background: `white`
- Border: `gray-100`
- Icon background: `gray-50`
- Icon color: `gray-400`
- Countdown: `orange-600` text
- Clock icon: `orange-500`

---

## 📐 Layout

```
┌─────────────────────────────────────────────────┐
│  📅  Jadwal Shift              [Sedang Shift]   │
│      Shift A                                    │
│      07:00 - 10:00                              │
└─────────────────────────────────────────────────┘
```

**Saat di luar shift:**
```
┌─────────────────────────────────────────────────┐
│  📅  Jadwal Shift              🕐 2j 30m        │
│      Shift A                   Menuju Shift     │
│      07:00 - 10:00                              │
└─────────────────────────────────────────────────┘
```

---

## 🔧 Technical Implementation

### Component: `ShiftScheduleWidget.tsx`

**Location**: `src/components/courier/ShiftScheduleWidget.tsx`

**Props**:
```typescript
interface ShiftScheduleWidgetProps {
  courierId: string;
}
```

**State**:
- `shiftInfo`: Shift data (name, start_time, end_time)
- `countdown`: Countdown string (e.g., "2j 30m")
- `isInShift`: Boolean flag for current status
- `isLoading`: Loading state

**Data Source**:
- Fetches from `profiles` table joined with `shifts` table
- Query: `profiles.select('shifts(name, start_time, end_time)')`

**Logic**:

1. **Fetch Shift Info** (on mount):
   - Query database for courier's assigned shift
   - Store shift name and times

2. **Calculate Status** (every minute):
   - Get current time in minutes since midnight
   - Parse shift start/end times
   - Compare to determine if in-shift or out-of-shift

3. **Calculate Countdown** (when out-of-shift):
   - If current time < shift start → countdown to today's shift
   - If current time > shift end → countdown to tomorrow's shift
   - Format: hours and minutes (e.g., "2j 30m" or "45m")

4. **Update Timer**:
   - `setInterval` runs every 60 seconds
   - Recalculates status and countdown
   - Updates UI automatically

---

## 📍 Integration

### Added to `CourierDashboard.tsx`

**Position**: After `AttendanceWidget`, before `Unpaid Warning Card`

```tsx
{/* Shift Schedule Widget */}
{user?.id && (
  <ShiftScheduleWidget courierId={user.id} />
)}
```

**Conditional Rendering**:
- Only shows when `user.id` exists
- Hides if no shift assigned (returns `null`)
- Hides during loading state

---

## 🎯 User Experience

### Scenario 1: Kurir Sedang Shift
**Time**: 08:30 (Shift: 07:00-10:00)

**Display**:
```
📅 Jadwal Shift              [Sedang Shift]
   Shift A
   07:00 - 10:00
```

**Visual**: Green gradient background, emerald border

---

### Scenario 2: Kurir Menunggu Shift (Hari Ini)
**Time**: 05:30 (Shift: 07:00-10:00)

**Display**:
```
📅 Jadwal Shift              🕐 1j 30m
   Shift A                   Menuju Shift
   07:00 - 10:00
```

**Visual**: White background, gray border, orange countdown

---

### Scenario 3: Kurir Setelah Shift (Menunggu Besok)
**Time**: 11:00 (Shift: 07:00-10:00)

**Display**:
```
📅 Jadwal Shift              🕐 20j 0m
   Shift A                   Menuju Shift
   07:00 - 10:00
```

**Visual**: White background, gray border, orange countdown

---

## 🔄 Auto-Update Behavior

### Timer Update Frequency
- **Interval**: Every 60 seconds (1 minute)
- **Reason**: Balance between accuracy and performance
- **Impact**: Minimal battery/CPU usage

### Status Transition
- **In-Shift → Out-of-Shift**: Automatic at shift end time
- **Out-of-Shift → In-Shift**: Automatic at shift start time
- **No manual refresh needed**: Component handles all updates

### Cleanup
- `clearInterval` on component unmount
- Prevents memory leaks
- No lingering timers

---

## 📱 Responsive Design

### Mobile (Default)
- Compact padding: `p-4`
- Small text sizes: `text-xs`, `text-sm`
- Icon size: `h-5 w-5`

### Mini Devices
- Slightly larger padding: `mini:p-5`
- Maintains readability on small screens

### Extra Small (xs)
- Larger border radius: `xs:rounded-3xl`
- Enhanced visual appeal

---

## 🎨 Styling Details

### Border Radius
- Base: `rounded-2xl`
- XS breakpoint: `xs:rounded-3xl`

### Shadows
- Base: `shadow-sm`
- Subtle elevation

### Transitions
- `transition-all` for smooth state changes
- Border color transitions
- Background color transitions

### Typography
- Shift name: `text-sm font-black`
- Time: `text-xs font-bold`
- Countdown: `text-xs font-black tabular-nums`
- Label: `text-[9px] font-bold uppercase`

---

## 🧪 Testing

### Manual Testing Scenarios

1. **Test In-Shift Status**:
   - Set current time within shift hours
   - Verify green badge shows "Sedang Shift"
   - Verify emerald styling applied

2. **Test Out-of-Shift Countdown**:
   - Set current time before shift start
   - Verify countdown shows correct time
   - Verify orange clock icon visible

3. **Test Countdown Accuracy**:
   - Wait 1 minute
   - Verify countdown decrements correctly

4. **Test Shift Transition**:
   - Wait for shift start time
   - Verify automatic transition to "Sedang Shift"

5. **Test No Shift Assigned**:
   - Use courier without shift
   - Verify widget doesn't render

---

## 🐛 Edge Cases Handled

### 1. **No Shift Assigned**
- Widget returns `null`
- No error thrown
- Dashboard layout unaffected

### 2. **Loading State**
- Shows nothing during fetch
- Prevents flash of incorrect data
- Smooth appearance when loaded

### 3. **Shift Crossing Midnight**
- Handles 24-hour time correctly
- Calculates next-day shifts properly

### 4. **Component Unmount**
- Clears interval timer
- Prevents memory leaks
- No console errors

---

## 📊 Performance

### Database Queries
- **Frequency**: Once on mount
- **Complexity**: Simple join query
- **Impact**: Minimal

### Re-renders
- **Frequency**: Every 60 seconds
- **Trigger**: State update (countdown/status)
- **Impact**: Negligible (small component)

### Memory Usage
- **Timer**: Single `setInterval`
- **State**: 4 small state variables
- **Impact**: < 1KB

---

## 🔮 Future Enhancements

### Potential Improvements

1. **Click to View Details**:
   - Navigate to shift schedule page
   - Show full week schedule
   - View shift history

2. **Multiple Shifts**:
   - Support couriers with multiple shifts per day
   - Show next shift if multiple

3. **Shift Swap Indicator**:
   - Show if shift was swapped
   - Display original vs current shift

4. **Overtime Indicator**:
   - Show if currently working overtime
   - Display overtime duration

5. **Break Time Indicator**:
   - Show scheduled break times
   - Countdown to break

6. **Notification Integration**:
   - Alert 30 minutes before shift
   - Reminder to check in

---

## 📁 Files

### Created
- `src/components/courier/ShiftScheduleWidget.tsx` (new component)

### Modified
- `src/pages/courier/CourierDashboard.tsx` (added widget)

---

## ✅ Completion Checklist

- ✅ Component created
- ✅ Shift data fetching implemented
- ✅ In-shift detection logic
- ✅ Countdown calculation
- ✅ Auto-update timer
- ✅ Responsive design
- ✅ Integrated to dashboard
- ✅ TypeScript types defined
- ✅ No diagnostics errors
- ✅ Committed and pushed
- ✅ Documentation complete

---

## 🚀 Deployment Status

**Status**: ✅ LIVE

**Commit**: `93930727` - "Add shift schedule widget with countdown timer to courier dashboard"

**Ready for user verification!**
