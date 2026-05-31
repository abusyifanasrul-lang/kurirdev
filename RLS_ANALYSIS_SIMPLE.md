# Analisis RLS Policy - Bahasa Sederhana

Saya akan review setiap tabel dengan melihat:
1. **Apa fungsi tabel ini?**
2. **Siapa yang pakai di kode aplikasi?**
3. **Policy apa yang ada?**
4. **Apakah policy sudah sesuai dengan kebutuhan bisnis?**

---

## 1. ATTENDANCE_LOGS

**Fungsi:**
Tabel untuk mencatat event GPS dan aktivitas kehadiran kurir (misalnya: kurir keluar dari zona STAY, auto-revoke, dll)

**Siapa yang pakai:**
- **INSERT**: Database functions/triggers (otomatis saat GPS event terjadi)
- **SELECT**: Belum ada kode aplikasi yang baca tabel ini (kemungkinan untuk future feature atau debugging)

**Policy yang ada:**
1. `Admins can view all attendance logs` (SELECT) → Admin (`owner`, `admin`, `admin_kurir`) bisa lihat semua
2. `System can insert attendance logs` (INSERT) → Semua bisa insert (no restriction)

**Analisis:**
✅ **SUDAH BENAR** karena:
- INSERT harus no restriction (dipanggil dari database functions yang tidak punya user context)
- SELECT hanya admin (data sensitif untuk monitoring)
- Tidak ada UPDATE/DELETE (immutable logs)

**Kesimpulan:** Policy sudah sesuai kebutuhan, tidak perlu diubah.

---

## 2. BASECAMPS

**Fungsi:**
Tabel untuk menyimpan data basecamp (lokasi pangkalan kurir untuk fitur GPS STAY)

**Siapa yang pakai:**
- **SELECT**: 
  - `GeneralOpsTab.tsx` → Admin view/manage basecamps
  - `useCourierStore.ts` → Kurir fetch basecamp data saat scan QR (untuk start GPS monitoring)
  - `useActiveBasecamp.ts` → Get active basecamp untuk generate QR
- **INSERT/UPDATE/DELETE**: 
  - `GeneralOpsTab.tsx` → Admin manage basecamps (add/edit/delete)
  - Via `useSettingsStore.ts` → `addBasecamp()`, `updateBasecamp()`, `deleteBasecamp()`

**Policy yang ada:**
1. `basecamps_select_auth` (SELECT) → Semua authenticated users bisa lihat
2. `basecamps_write_admin` (ALL = INSERT/UPDATE/DELETE) → Admin (`owner`, `admin_kurir`, `admin`) bisa manage

**Analisis:**
✅ **SUDAH BENAR** karena:
- SELECT untuk semua authenticated → Kurir perlu lihat basecamp data saat scan QR
- INSERT/UPDATE/DELETE hanya admin → Hanya admin yang boleh manage basecamps
- Policy sudah include role `admin` (baru saja kita fix)

**Kesimpulan:** Policy sudah sesuai kebutuhan, tidak perlu diubah.

---

## 3. CUSTOMER_CHANGE_REQUESTS

**Fungsi:**
Tabel untuk approval flow ketika kurir ingin mengubah data customer

**Siapa yang pakai:**
- Belum ada kode aplikasi yang menggunakan tabel ini (future feature)
- Tujuan: Kurir bisa request perubahan data customer, admin approve/reject

**Policy yang ada:**
1. `Everyone can read requests` (SELECT) → Semua authenticated
2. `ccr_select` (SELECT) → Semua authenticated (DUPLICATE)
3. `Only admins can update requests` (UPDATE) → `owner`, `admin_kurir`, `admin`
4. `ccr_update` (UPDATE) → `owner`, `admin_kurir` (TIDAK include `admin`) (DUPLICATE)
5. `ccr_insert` (INSERT) → Semua authenticated

**Analisis:**
⚠️ **ADA MASALAH** - Duplicate policies dengan inconsistent roles:
- Ada 2 policy SELECT (duplicate, tapi sama-sama allow authenticated)
- Ada 2 policy UPDATE dengan role BERBEDA:
  - Policy #3 include `admin`
  - Policy #4 TIDAK include `admin`
- Karena PostgreSQL pakai OR logic, `admin` tetap bisa update (dari policy #3)
- Tapi ini membingungkan dan bisa menyebabkan bug di masa depan

**Rekomendasi:**
🔧 Hapus duplicate policies, keep yang lebih lengkap:
- Hapus `ccr_select` (keep "Everyone can read requests")
- Hapus `ccr_update` (keep "Only admins can update requests")

---

## 4. NOTIFICATIONS

**Fungsi:**
Tabel untuk notifikasi ke user (kurir, admin, dll)

**Siapa yang pakai:**
- **INSERT**: Database triggers (otomatis saat order status berubah)
- **SELECT**: User bisa lihat notifikasi mereka sendiri, admin bisa lihat semua
- **UPDATE**: User bisa update notifikasi mereka (mark as read), admin bisa update semua

**Policy yang ada:**
1. `Only admins can send notifications` (INSERT) → `owner`, `admin_kurir`, `admin`
2. `notifications_insert` (INSERT) → Semua authenticated (CONFLICT!)
3. `notifications_select` (SELECT) → User sendiri OR admin
4. `notifications_update` (UPDATE) → User sendiri OR admin

**Analisis:**
🔴 **MASALAH SERIUS** - Conflict INSERT policies:
- Policy #1: Hanya admin yang boleh insert
- Policy #2: SEMUA authenticated bisa insert
- Karena OR logic, **semua user bisa insert notifications**!
- Ini SECURITY ISSUE karena user biasa bisa spam notifications

**Fakta dari kode:**
- Notifications di-insert dari database triggers (bukan dari aplikasi)
- Triggers tidak punya user context, jadi perlu policy yang permissive
- TAPI policy #2 terlalu permissive (allow semua authenticated)

**Rekomendasi:**
🔧 Hapus `notifications_insert`, ganti dengan policy yang allow triggers:
```sql
DROP POLICY "notifications_insert" ON notifications;
-- Triggers akan tetap bisa insert karena menggunakan SECURITY DEFINER
-- Atau buat policy khusus untuk service_role jika diperlukan
```

---

## 5. PROFILES

**Fungsi:**
Tabel untuk data user (kurir, admin, dll)

**Siapa yang pakai:**
- **SELECT**: Semua authenticated (untuk list kurir, dll)
- **INSERT**: User sendiri (saat signup)
- **UPDATE**: User sendiri (edit profile) OR admin (manage users)

**Policy yang ada:**
1. `Admins can manage all profiles` (ALL) → `admin`, `owner`, `admin_kurir`, `finance`
2. `Users can view and edit their own profile` (ALL) → User sendiri
3. `profiles_insert` (INSERT) → User sendiri (DUPLICATE)
4. `profiles_select` (SELECT) → Semua authenticated (DUPLICATE)
5. `profiles_update` (UPDATE) → User sendiri OR `owner`, `admin_kurir` (TIDAK include `admin` & `finance`) (DUPLICATE)

**Analisis:**
⚠️ **ADA MASALAH** - Duplicate policies dengan inconsistent roles:
- Policy #1 (ALL) sudah cover semua operasi untuk admin
- Policy #2 (ALL) sudah cover semua operasi untuk user sendiri
- Policy #3, #4, #5 adalah DUPLICATE yang tidak perlu
- Policy #5 tidak include `admin` & `finance`, tapi policy #1 sudah include mereka

**Rekomendasi:**
🔧 Hapus duplicate policies #3, #4, #5:
- Policy #1 dan #2 sudah cukup untuk cover semua kebutuhan
- Duplicate policies hanya membingungkan dan bisa menyebabkan bug

---

## KESIMPULAN

**Tabel yang BERMASALAH:**

1. ⚠️ **customer_change_requests** - Duplicate policies dengan inconsistent roles (LOW PRIORITY karena belum dipakai)
2. 🔴 **notifications** - SECURITY ISSUE: Semua user bisa insert notifications (HIGH PRIORITY)
3. ⚠️ **profiles** - Duplicate policies dengan inconsistent roles (MEDIUM PRIORITY)

**Tabel yang SUDAH BENAR:**

1. ✅ **attendance_logs** - Policy sudah sesuai kebutuhan
2. ✅ **basecamps** - Policy sudah sesuai kebutuhan (baru saja di-fix)

---

## REKOMENDASI PERBAIKAN

Apakah Anda ingin saya perbaiki masalah-masalah ini sekarang? Prioritas:

1. **HIGH**: Fix notifications (security issue)
2. **MEDIUM**: Cleanup profiles (duplicate policies)
3. **LOW**: Cleanup customer_change_requests (belum dipakai, tapi sebaiknya di-fix untuk masa depan)
