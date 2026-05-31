# Panduan Debug Sistem Notifikasi Kurir

## Masalah
Kurir tidak menerima notifikasi saat order di-assign oleh admin.

## Arsitektur Sistem Notifikasi

```
Admin Assign Order
       ↓
assign_order_and_rotate() RPC
       ↓
UPDATE orders SET status='assigned'
       ↓
trigger_handle_order_notification (AFTER UPDATE)
       ↓
INSERT INTO notifications
       ↓
trigger_notify_courier_on_insert (AFTER INSERT)
       ↓
pg_net.http_post() → Edge Function
       ↓
notify-courier Edge Function
       ↓
Fetch fcm_token from profiles
       ↓
Send to FCM v1 API
       ↓
Update notifications.fcm_status
       ↓
Push to Courier Device
```

## Langkah Debugging

### 1. Cek Database Triggers

Jalankan di Supabase SQL Editor:

```sql
-- Cek status triggers
SELECT 
    tgname as trigger_name,
    tgenabled as is_enabled,
    tgrelid::regclass as table_name
FROM pg_trigger 
WHERE tgname IN (
    'trigger_handle_order_notification', 
    'trigger_notify_courier_on_insert'
);
```

**Expected Result**: Kedua trigger harus `is_enabled = true`

**Jika disabled**, enable dengan:
```sql
ALTER TABLE public.orders ENABLE TRIGGER trigger_handle_order_notification;
ALTER TABLE public.notifications ENABLE TRIGGER trigger_notify_courier_on_insert;
```

---

### 2. Cek FCM Token Kurir

```sql
-- Cek token kurir tertentu
SELECT 
    id,
    name,
    fcm_token IS NOT NULL as has_token,
    fcm_token_updated_at,
    platform,
    is_active,
    is_online
FROM public.profiles
WHERE role = 'courier'
    AND id = 'COURIER_ID_HERE';
```

**Expected Result**: 
- `has_token = true`
- `fcm_token_updated_at` tidak lebih dari 7 hari
- `is_active = true`

**Jika tidak ada token**:
1. Buka aplikasi kurir
2. Login sebagai kurir tersebut
3. Pastikan permission notifikasi granted
4. Check browser console untuk error FCM

---

### 3. Cek Notification Records

```sql
-- Cek notifikasi untuk order tertentu
SELECT 
    n.id,
    n.title,
    n.message,
    n.sent_at,
    n.fcm_status,
    n.fcm_error,
    n.user_id,
    p.name as courier_name,
    p.fcm_token IS NOT NULL as courier_has_token
FROM public.notifications n
LEFT JOIN public.profiles p ON p.id = n.user_id
WHERE n.data->>'order_number' = 'ORDER_NUMBER_HERE'
ORDER BY n.sent_at DESC;
```

**Expected Result**: 
- Ada record notification dengan `type = 'order_assigned'`
- `fcm_status = 'sent'`
- `fcm_error = NULL`

**Jika tidak ada record**:
- Trigger `handle_order_notification` tidak jalan
- Cek apakah order benar-benar di-update ke status 'assigned'

**Jika `fcm_status = 'failed'`**:
- Lihat `fcm_error` untuk detail error
- Kemungkinan: invalid token, FCM service down, Edge Function error

**Jika `fcm_status = 'skipped'`**:
- Kurir tidak punya FCM token
- Perlu re-register token di aplikasi kurir

---

### 4. Cek Edge Function Logs

1. Buka Supabase Dashboard
2. Edge Functions → `notify-courier` → Logs
3. Filter by timestamp saat order di-assign
4. Cari error messages

**Common Errors**:
- `WEBHOOK_SECRET mismatch` → Environment variable salah
- `No FCM token found` → Kurir belum register token
- `UNREGISTERED` / `NOT_FOUND` → Token expired/invalid
- `FIREBASE_SERVICE_ACCOUNT not set` → Missing env variable

---

### 5. Test Manual Notification

```sql
-- Insert test notification untuk kurir
INSERT INTO public.notifications (user_id, title, message, type, data)
VALUES (
    'COURIER_ID_HERE',
    '🧪 Test Notification',
    'Manual test dari SQL',
    'test',
    jsonb_build_object('test', true)
);
```

Tunggu 5-10 detik, lalu cek:

```sql
SELECT fcm_status, fcm_error 
FROM public.notifications 
WHERE title = '🧪 Test Notification' 
ORDER BY sent_at DESC 
LIMIT 1;
```

**Jika berhasil**: Sistem notifikasi berfungsi, masalah di trigger order assignment
**Jika gagal**: Masalah di Edge Function atau FCM token

---

### 6. Cek pg_net Extension

```sql
-- Cek extension installed
SELECT extname, extversion 
FROM pg_extension 
WHERE extname = 'pg_net';
```

**Expected Result**: Extension harus ada

**Jika tidak ada**:
```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

---

### 7. Debug di Browser Console

Buka aplikasi kurir di browser, lalu di console:

```javascript
// Import debug utility
import { debugNotifications } from './utils/debugNotifications';

// Cek token kurir saat ini
await debugNotifications.checkCourierToken('COURIER_ID');

// Cek status delivery 24 jam terakhir
await debugNotifications.checkRecentDeliveryStatus();

// Test kirim notifikasi
await debugNotifications.sendTestNotification('COURIER_ID');

// Monitor real-time
const stopMonitor = debugNotifications.monitorNotifications('COURIER_ID');
// Untuk stop: stopMonitor();
```

---

## Checklist Debugging

- [ ] Database triggers enabled
- [ ] pg_net extension installed
- [ ] Kurir punya FCM token valid
- [ ] Token tidak expired (< 7 hari)
- [ ] Notification record dibuat saat assign
- [ ] Edge Function dipanggil (cek logs)
- [ ] Edge Function berhasil kirim ke FCM
- [ ] fcm_status = 'sent'
- [ ] Kurir punya permission notifikasi
- [ ] Service worker registered (PWA)
- [ ] Notification channel created (Android)

---

## Solusi Common Issues

### Issue 1: Trigger Tidak Jalan
**Symptom**: Tidak ada record di `notifications` table setelah assign

**Solution**:
```sql
-- Re-create trigger
DROP TRIGGER IF EXISTS trigger_handle_order_notification ON public.orders;
CREATE TRIGGER trigger_handle_order_notification
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION handle_order_notification();
```

### Issue 2: FCM Token Tidak Ada
**Symptom**: `fcm_status = 'skipped'`, error "No FCM token"

**Solution**:
1. Logout dari aplikasi kurir
2. Clear browser cache / app data
3. Login kembali
4. Grant notification permission
5. Verify token tersimpan:
```sql
SELECT fcm_token FROM profiles WHERE id = 'COURIER_ID';
```

### Issue 3: Edge Function Error
**Symptom**: `fcm_status = 'failed'`, error di Edge Function logs

**Solution**:
1. Cek environment variables di Supabase Dashboard:
   - `WEBHOOK_SECRET`
   - `FIREBASE_SERVICE_ACCOUNT`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. Redeploy Edge Function jika perlu

### Issue 4: Token Expired
**Symptom**: FCM error "UNREGISTERED" atau "NOT_FOUND"

**Solution**:
```sql
-- Clear expired token
UPDATE profiles 
SET fcm_token = NULL, fcm_token_updated_at = NULL 
WHERE id = 'COURIER_ID';
```
Lalu minta kurir login ulang untuk generate token baru.

### Issue 5: Permission Denied
**Symptom**: Notifikasi tidak muncul di device meski `fcm_status = 'sent'`

**Solution**:
- **Android**: Settings → Apps → KurirDev → Notifications → Enable
- **Web**: Browser settings → Site settings → Notifications → Allow
- **iOS**: Settings → Notifications → KurirDev → Allow

---

## Quick Diagnostic Script

Jalankan script lengkap di Supabase SQL Editor:

```bash
# File: debug-notification-system.sql
# Lokasi: root project
```

Script ini akan mengecek:
1. ✅ Trigger status
2. ✅ pg_net extension
3. ✅ Recent assignments
4. ✅ Courier tokens
5. ✅ Notification delivery status
6. ✅ Failed notifications
7. ✅ Function definitions

---

## Monitoring Dashboard (Future Enhancement)

Untuk monitoring jangka panjang, buat admin dashboard dengan:

1. **Notification Health Panel**
   - Success rate (24h, 7d, 30d)
   - Failed notification list
   - Average delivery time

2. **Courier Token Status**
   - List kurir dengan token expired
   - Last token update timestamp
   - Platform distribution

3. **Manual Retry Button**
   - Resend failed notifications
   - Bulk resend untuk kurir tertentu

4. **Real-time Monitor**
   - Live notification stream
   - FCM status updates
   - Error alerts

---

## Kontak Support

Jika masalah masih berlanjut setelah semua langkah di atas:

1. Export hasil diagnostic script
2. Screenshot Edge Function logs
3. Screenshot browser console errors
4. Kirim ke tim development

---

**Last Updated**: 2026-05-23
**Version**: 1.0
