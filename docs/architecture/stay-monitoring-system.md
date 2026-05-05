# Stay Monitoring System - Architecture Documentation

## Overview

Sistem **STAY Monitoring** adalah mekanisme untuk memastikan kurir tetap berada di area basecamp saat status mereka adalah "STAY". Sistem ini menggunakan **GPS tracking native Android** yang berjalan di background untuk memonitor lokasi kurir secara real-time.

## GPS Monitoring Parameters

**Current Configuration** (Updated: May 2026):
- **Check Interval**: 30 seconds
- **Revocation Threshold**: 5 consecutive out-of-zone readings
- **Detection Window**: 2.5 minutes (30s × 5 = 150s)

**Previous Configuration**:
- Check Interval: 60 seconds
- Detection Window: 5 minutes (60s × 5 = 300s)

**Rationale for Change**:
The 5-minute detection window was too long and created unfairness in the courier queue system. Couriers with STAY status could leave the basecamp to complete orders (typical duration: 3-4 minutes) while maintaining their priority in the queue, which was unfair to other couriers who remained at the basecamp.

By reducing the detection window to 2.5 minutes:
- ✅ Couriers who leave for orders lose STAY priority faster (more fair)
- ✅ Still maintains adequate GPS error tolerance (5 consecutive readings)
- ✅ Prevents abuse while allowing brief GPS inaccuracies
- ⚠️ Slightly higher battery usage (acceptable trade-off)

## Konsep Dasar

### Status Kurir
- **ON**: Kurir siap menerima order, bisa berada di mana saja
- **STAY**: Kurir harus berada di area basecamp tertentu (geofence)
- **OFF**: Kurir tidak aktif

### Geofence
Area circular (lingkaran) di sekitar basecamp yang didefinisikan oleh:
- **Latitude & Longitude**: Koordinat pusat basecamp
- **Radius**: Jarak dalam meter dari pusat (default: 10-50m)

## Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React/Capacitor)                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │ useStayMonitor   │────────▶│ stayNative       │          │
│  │ (React Hook)     │         │ (Bridge)         │          │
│  └──────────────────┘         └──────────────────┘          │
│           │                            │                     │
│           │                            ▼                     │
│           │                   ┌──────────────────┐          │
│           │                   │ StayMonitor      │          │
│           │                   │ (Capacitor       │          │
│           │                   │  Plugin)         │          │
│           │                   └──────────────────┘          │
└───────────┼────────────────────────────┼───────────────────┘
            │                            │
            │                            ▼
            │                   ┌──────────────────┐
            │                   │ ANDROID NATIVE   │
            │                   │ Background       │
            │                   │ Service          │
            │                   └──────────────────┘
            │                            │
            │                            │ GPS Tracking
            │                            │ Every 30 seconds
            │                            │
            │                            ▼
            │                   ┌──────────────────┐
            │                   │ Location Check   │
            │                   │ Inside/Outside?  │
            │                   └──────────────────┘
            │                            │
            │                            │
            │                   ┌────────┴────────┐
            │                   │                 │
            │                   ▼                 ▼
            │            [Inside Zone]     [Outside Zone]
            │                   │                 │
            │                   │                 │
            │                   │          counter++
            │                   │          (max: 5)
            │                   │                 │
            │                   │                 │
            │                   │          counter >= 5?
            │                   │                 │
            │                   │                 ▼
            │                   │          ┌──────────────┐
            │                   │          │ REVOKE STAY  │
            │                   │          │ via RPC      │
            │                   │          └──────────────┘
            │                   │                 │
            │                   │                 │
            ▼                   ▼                 ▼
    ┌─────────────────────────────────────────────────┐
    │              SUPABASE DATABASE                   │
    ├─────────────────────────────────────────────────┤
    │                                                   │
    │  profiles:                                        │
    │    - courier_status: 'stay' → 'on'               │
    │    - stay_basecamp_id: uuid → NULL               │
    │    - gps_consecutive_out: 0-5                    │
    │    - last_stay_check: timestamp                  │
    │                                                   │
    │  RPC: revoke_stay_by_service(courier_id, secret) │
    │                                                   │
    └─────────────────────────────────────────────────┘
```

## Database Schema

### Table: `profiles`

Kolom terkait STAY monitoring:

| Column | Type | Description |
|--------|------|-------------|
| `courier_status` | varchar | Status kurir: 'on', 'stay', 'off' |
| `stay_basecamp_id` | uuid | ID basecamp saat status STAY (NULL jika tidak STAY) |
| `gps_consecutive_out` | integer | Counter GPS readings di luar zone (0-5) |
| `last_stay_check` | timestamptz | Timestamp terakhir GPS check |
| `stay_activated_via_qr` | boolean | Apakah STAY diaktifkan via QR scan |

### Table: `basecamps`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `name` | text | Nama basecamp |
| `lat` | numeric | Latitude pusat |
| `lng` | numeric | Longitude pusat |
| `radius_m` | integer | Radius geofence dalam meter |
| `is_active` | boolean | Apakah basecamp aktif |

### Table: `stay_attendance_logs`

Log setiap kali kurir scan QR untuk aktivasi STAY:

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `courier_id` | uuid | ID kurir |
| `courier_name` | text | Nama kurir (denormalized) |
| `token_id` | uuid | ID QR token yang di-scan |
| `verified_at` | timestamptz | Waktu scan |

### Table: `stay_qr_tokens`

QR tokens yang di-generate admin untuk aktivasi STAY:

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `token` | text | UUID token (QR code value) |
| `created_by` | uuid | Admin yang generate |
| `expires_at` | timestamptz | Waktu kadaluarsa (5 menit) |
| `basecamp_id` | uuid | Basecamp terkait |

### RPC Function: `revoke_stay_by_service`

```sql
CREATE FUNCTION revoke_stay_by_service(
  p_courier_id UUID,
  p_secret TEXT
) RETURNS JSONB
```

**Purpose**: Mencabut status STAY kurir dari Android native service

**Security**: 
- SECURITY DEFINER (runs with elevated privileges)
- Requires `service_secret` from `settings` table
- Only Android native service has this secret

**Actions**:
1. Verify `p_secret` matches `settings.service_secret`
2. Update `profiles`:
   - `courier_status` = 'on'
   - `stay_basecamp_id` = NULL
   - `gps_consecutive_out` = 0

## Flow Diagram

### 1. Aktivasi STAY (QR Scan)

```
┌─────────┐
│ Kurir   │
│ Scan QR │
└────┬────┘
     │
     ▼
┌─────────────────────────────┐
│ Verify QR Token             │
│ - Token valid?              │
│ - Not expired?              │
│ - Basecamp active?          │
└────┬────────────────────────┘
     │
     ▼
┌─────────────────────────────┐
│ Update profiles:            │
│ - courier_status = 'stay'   │
│ - stay_basecamp_id = X      │
│ - gps_consecutive_out = 0   │
└────┬────────────────────────┘
     │
     ▼
┌─────────────────────────────┐
│ Insert stay_attendance_logs │
└────┬────────────────────────┘
     │
     ▼
┌─────────────────────────────┐
│ Start Android Native        │
│ Background Service          │
│ - Pass: lat, lng, radius    │
│ - Pass: basecamp_id         │
│ - Pass: supabase credentials│
│ - Pass: service_secret      │
└─────────────────────────────┘
```

### 2. GPS Monitoring (Background)

```
┌──────────────────────────┐
│ Android Background       │
│ Service Running          │
└────┬─────────────────────┘
     │
     │ Every 30 seconds
     │
     ▼
┌──────────────────────────┐
│ Get Current GPS Location │
└────┬─────────────────────┘
     │
     ▼
┌──────────────────────────┐
│ Calculate Distance       │
│ from Basecamp Center     │
└────┬─────────────────────┘
     │
     ▼
┌──────────────────────────┐
│ Distance <= Radius?      │
└────┬─────────────────────┘
     │
     ├─── YES (Inside) ───┐
     │                    │
     │                    ▼
     │           ┌──────────────────┐
     │           │ Reset Counter    │
     │           │ counter = 0      │
     │           └──────────────────┘
     │                    │
     │                    ▼
     │           ┌──────────────────┐
     │           │ Send Event:      │
     │           │ type: 'update'   │
     │           │ inZone: true     │
     │           │ counter: 0       │
     │           └──────────────────┘
     │
     └─── NO (Outside) ───┐
                          │
                          ▼
                 ┌──────────────────┐
                 │ Increment Counter│
                 │ counter++        │
                 └────┬─────────────┘
                      │
                      ▼
                 ┌──────────────────┐
                 │ counter >= 5?    │
                 └────┬─────────────┘
                      │
                      ├─── NO ───┐
                      │          │
                      │          ▼
                      │  ┌──────────────────┐
                      │  │ Send Event:      │
                      │  │ type: 'update'   │
                      │  │ inZone: false    │
                      │  │ counter: X       │
                      │  └──────────────────┘
                      │
                      └─── YES ───┐
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ Call RPC:        │
                         │ revoke_stay_by_  │
                         │ service()        │
                         └────┬─────────────┘
                              │
                              ▼
                         ┌──────────────────┐
                         │ Update Database: │
                         │ - status = 'on'  │
                         │ - basecamp = NULL│
                         │ - counter = 0    │
                         └────┬─────────────┘
                              │
                              ▼
                         ┌──────────────────┐
                         │ Send Event:      │
                         │ type: 'revoked'  │
                         └────┬─────────────┘
                              │
                              ▼
                         ┌──────────────────┐
                         │ Stop Monitoring  │
                         └──────────────────┘
```

### 3. Frontend Event Handling

```typescript
// useStayMonitor.ts
stayNative.onUpdate((evt: StayNativeEvent) => {
  if (evt.type === 'update') {
    // Update UI: show counter, distance, etc.
    outCounterRef.current = evt.counter;
  }
  
  if (evt.type === 'revoked') {
    // STAY dicabut!
    // 1. Update local state
    // 2. Refresh user data
    // 3. Show toast notification
    // 4. Call onRevoked callback
  }
});
```

## Komponen Kode

### 1. Frontend Bridge: `stayMonitoring.ts`

**Purpose**: Bridge antara React dan Android native plugin

**Key Methods**:
- `start(options)`: Start GPS monitoring
- `stop()`: Stop GPS monitoring
- `isRunning()`: Check if monitoring active
- `onUpdate(callback)`: Listen to events from native

**Options**:
```typescript
{
  lat: number;           // Basecamp latitude
  lng: number;           // Basecamp longitude
  radius: number;        // Geofence radius (meters)
  basecampId: string;    // Basecamp UUID
  supabaseUrl: string;   // Supabase project URL
  supabaseAnonKey: string; // Supabase anon key
  serviceSecret: string; // Secret for RPC auth
  courierId: string;     // Courier UUID
}
```

### 2. React Hook: `useStayMonitor.ts`

**Purpose**: Manage STAY monitoring lifecycle in React components

**Features**:
- Auto-resume monitoring after app restart
- Listen to native events
- Handle STAY revocation
- Update database and UI

**Usage**:
```typescript
useStayMonitor({
  courierId: user.id,
  isStay: user.courier_status === 'stay',
  onRevoked: () => {
    // Handle revocation (e.g., navigate, show modal)
  }
});
```

### 3. Android Native Plugin: `StayMonitor`

**Platform**: Android only (Capacitor plugin)

**Responsibilities**:
- Run background service (survives app close)
- Request location permissions
- Get GPS location every 1 minute
- Calculate distance from basecamp
- Track consecutive out-of-zone counter
- Call Supabase RPC when counter >= 5
- Send events to JavaScript via callback

**Implementation**: (Not in this codebase - separate Android project)

## Mekanisme Deteksi

### 1. GPS Location Tracking

**Frequency**: Every 30 seconds (optimized for queue fairness)

**Detection Window**: 30 seconds × 5 readings = **2.5 minutes**

**Rationale**: 
- Reduced from 60 seconds (5-minute window) to improve queue fairness
- Couriers who leave basecamp to complete orders (typical: 3-4 minutes) will lose STAY priority before order completion
- Maintains adequate GPS error tolerance with 5 consecutive readings
- Slightly higher battery usage (2× GPS checks) is acceptable trade-off for fairness

**Method**: Android `FusedLocationProviderClient`
- High accuracy mode
- Battery-optimized
- Works in background

### 2. Distance Calculation

**Formula**: Haversine formula untuk menghitung jarak antara 2 koordinat GPS

```
distance = haversine(
  lat1: courier_current_lat,
  lng1: courier_current_lng,
  lat2: basecamp_lat,
  lng2: basecamp_lng
)
```

**Result**: Distance in meters

### 3. Zone Detection

```
if (distance <= radius) {
  // Inside zone
  counter = 0;
} else {
  // Outside zone
  counter++;
}
```

### 4. Revocation Logic

```
if (counter >= 5) {
  // Kurir keluar zone 2.5 menit berturut-turut (5 × 30 detik)
  // Revoke STAY status
  revoke_stay_by_service(courier_id, service_secret);
}
```

**Rationale**: 
- 5 consecutive readings = 2.5 minutes outside (30s × 5)
- Tolerates temporary GPS inaccuracy (up to 4 consecutive errors)
- Prevents false positives while ensuring queue fairness
- Faster than previous 5-minute window, preventing abuse

## Security

### 1. Service Secret

**Purpose**: Authenticate Android native service to call RPC

**Storage**:
- Database: `settings.service_secret` (UUID)
- Generated once during migration
- Passed to Android service on STAY activation

**Validation**:
```sql
-- In revoke_stay_by_service RPC
SELECT service_secret INTO v_secret FROM settings WHERE id = 'global';
IF p_secret IS DISTINCT FROM v_secret THEN
  RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
END IF;
```

### 2. RLS Policies

**stay_qr_tokens**:
- INSERT: Only admin, owner, admin_kurir
- SELECT: Authenticated users (for verification)

**profiles**:
- UPDATE: User can update own profile OR admin roles

**stay_attendance_logs**:
- INSERT: Authenticated users (for logging)
- SELECT: Admin roles only

### 3. QR Token Expiry

**Lifetime**: 5 minutes

**Purpose**:
- Prevent token reuse
- Force fresh QR generation
- Security best practice

## Edge Cases & Handling

### 1. App Restart

**Problem**: Monitoring stops when app is closed

**Solution**: Auto-resume in `useStayMonitor`
```typescript
const checkResume = async () => {
  const running = await stayNative.isRunning();
  if (running) return; // Already running
  
  // Fetch basecamp data and restart monitoring
  const profile = await fetchProfile();
  if (profile.courier_status === 'stay') {
    stayNative.start({ ... });
  }
};
```

### 2. GPS Inaccuracy

**Problem**: GPS can be inaccurate (±10-50m)

**Solution**: 
- Use 5 consecutive readings (5 minutes)
- Larger radius (15-50m recommended)
- High accuracy mode

### 3. Battery Optimization

**Problem**: Android kills background services

**Solution**:
- Request battery optimization exemption
- Use foreground service with notification
- Periodic wake-up (WorkManager)

### 4. Network Failure

**Problem**: Cannot call RPC if offline

**Solution**:
- Queue revocation locally
- Retry when online
- Fallback to manual admin intervention

### 5. Multiple Basecamps

**Problem**: Kurir berpindah antar basecamp

**Solution**:
- Each STAY activation tied to specific basecamp
- Must scan new QR at new basecamp
- Old monitoring stops, new monitoring starts

## Performance Considerations

### 1. Battery Usage

**GPS Tracking**: ~3-7% battery per hour (increased from ~2-5%)
- Optimized with 30-second intervals (reduced from 60 seconds)
- Sleep between readings
- Use cached location when possible
- Trade-off: Slightly higher battery usage for significantly better queue fairness

**Impact Analysis**:
- Previous: 60 GPS checks per hour
- Current: 120 GPS checks per hour (2× more)
- Battery impact: ~40-50% increase in GPS-related battery usage
- Overall device battery impact: Minimal (~1-2% additional drain per hour)
- Acceptable for typical 4-8 hour courier shifts

### 2. Network Usage

**Minimal**:
- Only 1 RPC call when revoked
- No continuous polling
- Events sent via local callback

### 3. Database Load

**Low**:
- No continuous writes
- Only updates on revocation
- Indexed queries (courier_id, basecamp_id)

## Testing Checklist

### Functional Tests

- [ ] QR scan activates STAY correctly
- [ ] GPS monitoring starts after activation
- [ ] Counter increments when outside zone
- [ ] Counter resets when inside zone
- [ ] STAY revoked after 5 consecutive out
- [ ] Monitoring stops after revocation
- [ ] Auto-resume works after app restart
- [ ] Multiple kurir can STAY simultaneously

### Edge Case Tests

- [ ] GPS disabled → Show error
- [ ] Location permission denied → Show error
- [ ] Network offline → Queue revocation
- [ ] Battery optimization → Request exemption
- [ ] App force-closed → Auto-resume on restart
- [ ] Invalid QR token → Show error
- [ ] Expired QR token → Show error
- [ ] Basecamp inactive → Show error

### Security Tests

- [ ] Invalid service_secret → RPC fails
- [ ] Non-admin cannot generate QR
- [ ] Expired token cannot be used
- [ ] RLS policies enforced correctly

## Monitoring & Debugging

### Logs

**Frontend**:
```typescript
console.log('[useStayMonitor] auto-resume failed:', err);
console.log('[StayNative] start error:', err);
```

**Android Native**:
```
[StayMonitor] Location update: lat=X, lng=Y, distance=Z
[StayMonitor] Counter: 3/5
[StayMonitor] REVOKED: Calling RPC
```

### Database Queries

**Check active STAY kurir**:
```sql
SELECT id, name, courier_status, stay_basecamp_id, gps_consecutive_out
FROM profiles
WHERE courier_status = 'stay';
```

**Check recent STAY logs**:
```sql
SELECT * FROM stay_attendance_logs
WHERE verified_at >= NOW() - INTERVAL '1 day'
ORDER BY verified_at DESC;
```

**Check QR tokens**:
```sql
SELECT * FROM stay_qr_tokens
WHERE expires_at > NOW()
ORDER BY created_at DESC;
```

## Future Improvements

### 1. Web-based Monitoring

**Current**: Android native only

**Proposal**: Use Web Geolocation API for PWA
- Less accurate but works on all platforms
- Requires app to stay open
- Fallback for non-Android devices

### 2. Configurable Thresholds

**Current**: Hardcoded 5 consecutive readings

**Proposal**: Admin-configurable per basecamp
- Different thresholds for different locations
- Stored in `basecamps.revocation_threshold`

### 3. Geofence Visualization

**Current**: No visual feedback

**Proposal**: Show geofence circle on map
- Help admin set appropriate radius
- Show kurir current position relative to zone

### 4. Historical Tracking

**Current**: Only current status

**Proposal**: Log all GPS readings
- Audit trail for disputes
- Analytics on kurir movement patterns
- Stored in `stay_gps_logs` table

### 5. Multi-zone Support

**Current**: Single circular geofence

**Proposal**: Polygon geofences
- Complex basecamp shapes
- Multiple zones per basecamp
- Stored as GeoJSON in database

## References

- Capacitor Geolocation: https://capacitorjs.com/docs/apis/geolocation
- Android Background Location: https://developer.android.com/training/location/background
- Haversine Formula: https://en.wikipedia.org/wiki/Haversine_formula
- Supabase RPC: https://supabase.com/docs/guides/database/functions
