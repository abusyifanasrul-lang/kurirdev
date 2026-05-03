# KurirDev — Checklist Pre-Deployment (Revisi)
### Daftar Lengkap Pekerjaan yang Harus Diselesaikan Sebelum & Setelah Go-Live

> **Dibuat:** 2 Mei 2026 (Revisi)  
> **Berdasarkan:** Audit kode aktual + Laporan Komparatif Dokumentasi v1 vs v2  
> **Tujuan:** Panduan operasional untuk agent agar tidak drift — setiap item memiliki langkah eksplisit, bukan hanya deskripsi masalah.

---

## Cara Menggunakan Dokumen Ini

1. Kerjakan item secara **berurutan dalam setiap prioritas**
2. Setiap item memiliki: **Masalah** → **Dampak** → **Langkah konkret** → **Verifikasi**
3. **Jangan lewati verifikasi** — ini yang membedakan "sudah dikerjakan" dengan "dikerjakan dengan benar"
4. Setelah setiap item selesai, update status dari `[ ]` menjadi `[x]`
5. **Jangan kerjakan lebih dari 1 item per sesi tanpa konfirmasi manusia**

---

## PRIORITAS 1 — UI & FITUR BARU

> Item-item ini adalah fitur yang belum ada UI-nya. Dikerjakan pertama karena memudahkan setup data operasional.

---

### ITEM 1.1 — UI CRUD Basecamps di Settings > Umum (Operasional)

**Status:** `[x]` ✅ **Selesai**  
**Kategori:** UI baru  
**Dampak jika tidak dikerjakan:** Owner tidak bisa tambah/edit/hapus basecamp tanpa SQL langsung. Jika ada ekspansi lokasi, harus minta developer setiap kali.

**Masalah:**  
Tabel `basecamps` saat ini kosong (0 rows). Seluruh alur STAY bergantung pada record di tabel ini. Saat ini tidak ada UI untuk mengelola basecamp.

**Lokasi UI:**  
`src/pages/Settings.tsx` → Tab **Umum (Operasional)** → Section baru "Basecamp"

**Langkah:**

1. Buka `src/pages/Settings.tsx`, cari tab "Umum" atau "Operasional"

2. Tambahkan section baru "Basecamp" dengan:
   - **Tabel list** semua basecamp: nama, alamat, koordinat, radius, status aktif
   - **Tombol "Tambah Basecamp"** → buka modal form
   - **Form modal:**
     - Nama basecamp (text)
     - Alamat (textarea)
     - Latitude (number, decimal)
     - Longitude (number, decimal)
     - Radius (meter, number, default 10)
     - Aktif/Nonaktif (toggle)
   - **Tombol edit** per baris → isi form modal dengan data existing
   - **Tombol hapus** → konfirmasi dulu

3. Integrasi ke store:
   - Gunakan `useSettingsStore.ts` atau buat method baru
   - Query: `supabase.from('basecamps').select('*')`
   - Insert: `supabase.from('basecamps').insert({...})`
   - Update: `supabase.from('basecamps').update({...}).eq('id', id)`
   - Delete: `supabase.from('basecamps').delete().eq('id', id)`

4. Setelah UI jadi, input data basecamp pertama:
   - Tanyakan koordinat ke owner (Google Maps → klik titik → salin koordinat)
   - Isi via UI, bukan SQL

**Verifikasi berhasil:**
- Buka Settings > Umum (Operasional) → section Basecamp terlihat
- Bisa tambah basecamp baru via UI
- Bisa edit dan hapus
- Tabel `basecamps` punya minimal 1 row aktif

---

### ITEM 1.2 — UI Hari Libur di Settings > Umum (Operasional)

**Status:** `[x]` ✅ **Selesai**  
**Kategori:** UI baru  
**Dampak jika tidak dikerjakan:** Admin tidak bisa menetapkan hari libur nasional. `process_shift_alpha` memeriksa tabel `holidays` — jika hari libur tidak di-input, alpha tetap dihitung di hari yang seharusnya libur.

**Masalah:**  
Tabel `holidays` ada tapi tidak ada UI untuk CRUD. Admin harus pakai SQL langsung.

**Lokasi UI:**  
`src/pages/Settings.tsx` → Tab **Umum (Operasional)** → Section baru "Hari Libur" (di bawah atau di atas section Basecamp)

**Langkah:**

1. Di tab Umum (Operasional) yang sama dengan Basecamp, tambahkan section "Hari Libur"

2. Komponen UI:
   - **Calendar view** atau **tabel list** hari libur
   - **Tombol "Tetapkan Libur"** → modal pilih tanggal + nama libur
   - **Form:**
     - Tanggal (date picker)
     - Nama libur (text, contoh: "Idul Fitri", "Hari Kemerdekaan")
     - Libur nasional? (checkbox, default true)
     - Aktif? (toggle, default true)
   - **Tombol batalkan libur** → set `is_active = false` (soft delete)

3. Integrasi query:
   - List: `supabase.from('holidays').select('*').order('date', {ascending: false})`
   - Insert: `supabase.from('holidays').insert({date, name, is_national, is_active})`
   - Update: `supabase.from('holidays').update({is_active}).eq('id', id)`

4. Tampilkan hari libur aktif di kalender/dashboard admin

**Verifikasi berhasil:**
- Section "Hari Libur" terlihat di Settings > Umum (Operasional)
- Bisa tambah libur via UI
- Bisa nonaktifkan libur
- `process_shift_alpha` skip hari libur yang aktif

---

### ITEM 1.3 — UI Tukar Shift (shift_overrides)

**Status:** `[x]` ✅ **Selesai**  
**Kategori:** UI baru  
**Dampak jika tidak dikerjakan:** Admin harus input tukar shift via SQL. Kurir pengganti tidak terdeteksi di `get_missing_couriers`.

**Masalah:**  
Tabel `shift_overrides` ada dan `get_missing_couriers` sudah handle UNION ALL, tapi tidak ada UI.

**Lokasi UI:**  
`src/pages/admin/Shifts.tsx` atau modal di halaman Kurir

**Langkah:**

1. Di halaman manajemen shift atau profil kurir, tambahkan tombol "Tukar Shift"

2. Form tukar shift:
   - Tanggal (date picker)
   - Kurir asli (dropdown)
   - Kurir pengganti (dropdown — hanya kurir aktif)
   - Preview: "[Kurir Pengganti] menggantikan [Kurir Asli] di [Shift X] pada [Tanggal]"
   - Konfirmasi → INSERT ke `shift_overrides`

3. Query:
   - Insert: `supabase.from('shift_overrides').insert({date, original_courier_id, replacement_courier_id, original_shift_id})`

**Verifikasi berhasil:**
- Buka halaman shift → ada tombol "Tukar Shift"
- Bisa input tukar shift
- `get_missing_couriers` mengembalikan kurir pengganti di tanggal tersebut

---

## PRIORITAS 2 — DATA OPERASIONAL (BLOCKER)

> Item-item ini menyebabkan fitur utama tidak bisa berjalan sama sekali.

---

### ITEM 2.1 — Input Data Basecamp

**Status:** `[x]` ✅ **Selesai** (RLS Policy Fixed)  
**Kategori:** Data operasional  
**Dependensi:** ITEM 1.1 (UI CRUD Basecamps harus jadi dulu, atau pakai SQL kalau belum)

**Masalah:**  
Tabel `basecamps` kosong (0 rows). Fitur GPS STAY tidak bisa berjalan tanpa ini.

**Langkah (jika UI 1.1 sudah jadi):**

1. Buka Settings > Umum (Operasional) > Basecamp
2. Klik "Tambah Basecamp"
3. Isi form:
   - Nama: "Basecamp Utama" (atau sesuai lokasi)
   - Alamat: alamat lengkap
   - Latitude: koordinat dari Google Maps
   - Longitude: koordinat dari Google Maps
   - Radius: 10 (meter, jangan diubah)
   - Aktif: ON
4. Simpan

**Langkah (jika UI 1.1 belum jadi, pakai SQL):**

```sql
INSERT INTO basecamps (name, address, latitude, longitude, radius_meters, is_active)
VALUES (
  'Basecamp Utama',
  'Alamat lengkap basecamp',
  -4.123456,  -- ganti dengan latitude dari Google Maps
  119.123456, -- ganti dengan longitude dari Google Maps
  10,
  true
);
```

**Verifikasi:**
```sql
SELECT id, name, latitude, longitude, radius_meters, is_active FROM basecamps;
```

**Verifikasi berhasil:** Query mengembalikan 1 row dengan semua nilai yang benar.

---

### ITEM 2.2 — Assign Kurir ke Shift

**Status:** `[x]` ✅ **Selesai**  
**Kategori:** Data operasional  
**Dampak jika tidak dikerjakan:** `record_courier_checkin` return `'no_shift_assigned'` → tidak ada data absensi → warning dashboard kosong → denda tidak bisa dijatuhkan.

**Masalah:**  
Semua kurir memiliki `profiles.shift_id = NULL`.

**Langkah:**

1. Lihat daftar kurir:
```sql
SELECT id, name, shift_id FROM profiles 
WHERE role = 'courier' AND is_active = true
ORDER BY name;
```

2. Lihat daftar shift:
```sql
SELECT id, name, start_time, end_time FROM shifts WHERE is_active = true;
```

3. Update setiap kurir:
```sql
UPDATE profiles 
SET shift_id = '[UUID Shift A]'
WHERE id = '[UUID Andi]';
-- Ulangi untuk setiap kurir
```

4. Atau batch:
```sql
UPDATE profiles 
SET shift_id = (SELECT id FROM shifts WHERE name = 'Shift A')
WHERE role = 'courier' 
  AND is_active = true 
  AND shift_id IS NULL;
```

**Verifikasi:**
```sql
SELECT p.name, s.name as shift_name
FROM profiles p
LEFT JOIN shifts s ON s.id = p.shift_id
WHERE p.role = 'courier' AND p.is_active = true;
```

**Verifikasi berhasil:** Semua kurir aktif memiliki `shift_name` yang terisi (tidak NULL).

---

### ITEM 2.3 — Verifikasi `service_secret`

**Status:** `[x]` ✅ **Selesai**  
**Kategori:** Konfigurasi  
**Dampak jika tidak dikerjakan:** Android native service tidak bisa autentikasi ke backend saat revoke STAY.

**Verifikasi sudah dilakukan:**
```sql
SELECT service_secret IS NOT NULL as has_secret FROM settings WHERE id = 'global';
```

**Hasil:** `true` — secret ada dan tidak NULL.

**Catatan:** Secret tidak di-hardcode di Android (`StayMonitoringService.kt`). Android menerima secret dari frontend via Intent, jadi selalu sinkron dengan DB.

**Tidak perlu tindakan lagi.**

---

## PRIORITAS 3 — KEAMANAN

> Item-item ini tidak menyebabkan crash, tapi menyentuh keamanan data finansial.

---

### ITEM 3.1 — Auth Check di `reset_daily_fine_flags`

**Status:** `[x]` ✅ **Selesai**  
**Kategori:** Keamanan  
**Dampak jika tidak dikerjakan:** Fungsi ini dipanggil dari frontend (`useAdminAttendanceStore.ts`) saat admin buka halaman attendance. Jika admin page tidak ada auth guard yang ketat, ada risiko (meskipun rendah).

**Masalah:**  
`reset_daily_fine_flags()` tidak ada validasi role di level database.

**Langkah:**

1. Baca implementasi saat ini:
```sql
SELECT prosrc FROM pg_proc WHERE proname = 'reset_daily_fine_flags';
```

2. Buat migration:

```sql
-- File: supabase/migrations/20260502_fix_auth_reset_daily_fine_flags.sql
CREATE OR REPLACE FUNCTION public.reset_daily_fine_flags()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  -- Izinkan jika dipanggil dari service_role (Edge Function, auth.uid() IS NULL)
  -- Atau dari user dengan role admin/owner/finance
  IF auth.uid() IS NOT NULL THEN
    SELECT role INTO v_caller_role 
    FROM profiles WHERE id = auth.uid();

    IF v_caller_role NOT IN ('owner', 'admin_kurir', 'finance') THEN
      RAISE EXCEPTION 'Unauthorized: only admin/owner/finance can reset fine flags';
    END IF;
  END IF;

  UPDATE profiles SET late_fine_active = false
  WHERE role = 'courier' AND late_fine_active = true;
END;
$$;
```

3. Apply:
```bash
supabase db push
```

**Verifikasi:**
```sql
SELECT prosrc FROM pg_proc WHERE proname = 'reset_daily_fine_flags';
-- Pastikan ada blok IF auth.uid() IS NOT NULL
```

---

### ITEM 3.2 — Auth Check di `get_courier_fines`

**Status:** `[x]` ✅ **Selesai**  
**Kategori:** Keamanan  
**Dampak jika tidak dikerjakan:** Fungsi ini ada di daftar RPC tapi **tidak dipakai di frontend code yang terlihat**. Attack surface rendah, tapi tetap perlu dijaga.

**Langkah:**

1. Verifikasi dulu apakah fungsi ini memang dipakai:
```bash
grep -r "get_courier_fines" src/
```

2. Jika dipakai, tambahkan auth check:

```sql
CREATE OR REPLACE FUNCTION public.get_courier_fines(
  p_courier_id UUID,
  p_date_from  DATE,
  p_date_to    DATE
)
RETURNS TABLE (...)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT role INTO v_caller_role 
    FROM profiles WHERE id = auth.uid();

    IF v_caller_role = 'courier' AND auth.uid() != p_courier_id THEN
      RAISE EXCEPTION 'Unauthorized: courier can only view own fine data';
    END IF;

    IF v_caller_role NOT IN ('owner', 'admin_kurir', 'finance', 'courier') THEN
      RAISE EXCEPTION 'Unauthorized: insufficient role';
    END IF;
  END IF;

  -- ... query existing ...
END;
$$;
```

3. Jika **tidak dipakai** di frontend, prioritas bisa diturunkan ke post-launch.

**Verifikasi:**
```sql
SELECT prosrc FROM pg_proc WHERE proname = 'get_courier_fines';
```

---

## PRIORITAS 4 — UPDATE DOKUMENTASI

> Item-item ini tidak mempengaruhi sistem berjalan, tapi penting agar dokumen akurat sebagai referensi.

---

### ITEM 4.1 — Update Section 6.2: Kode `get_missing_couriers`

**Status:** `[x]` ✅ **Selesai**  
**Kategori:** Dokumentasi  
**Masalah:** Kode yang terdokumentasi di Section 6.2 adalah versi lama tanpa UNION ALL. Kode aktual sudah lebih lengkap.

**Kode aktual di database:**
```sql
-- get_missing_couriers (dengan UNION ALL untuk shift_overrides dan day_off)
-- ... [kode aktual dari DB] ...
```

**Langkah:**

1. Jalankan:
```sql
SELECT prosrc FROM pg_proc WHERE proname = 'get_missing_couriers';
```

2. Copy hasilnya, paste ke Section 6.2 di `KurirDev_Technical_Documentation.md`

3. Tambahkan catatan tentang kolom `day_off` di tabel `profiles`

**Verifikasi:** Section 6.2 di dokumen identik dengan output query.

---

### ITEM 4.2 — Perbaiki Section 7: Pisahkan 7.5 dan 7.6

**Status:** `[x]` ✅ **Selesai** (Tidak ada masalah)  
**Kategori:** Dokumentasi  
**Masalah:** Di v2, Section 7.5 (QR Code Management — `StayQRDisplay.tsx`) hilang. Penomoran melompat dari 7.4 ke 7.6.

**Verifikasi:** Section 7.5 sudah ada dan benar. Tidak ada Section 7.6 yang salah. Dokumentasi sudah akurat.

**Langkah:**

1. Tambahkan kembali Section 7.5:

```markdown
### 7.5 QR Code Management (StayQRDisplay.tsx)

Komponen admin untuk generate dan menampilkan QR STAY.

\`\`\`typescript
// src/components/admin/StayQRDisplay.tsx
const QR_EXPIRY_MINUTES = 5;

const generateNewToken = useCallback(async () => {
  // ... kode generate token ...
}, [user?.id]);

// Auto-regenerate setelah scan
const channel = supabase
  .channel('stay-attendance-events')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'stay_attendance_logs',
  }, () => {
    fetchTodayLogs();
    setTimeout(() => generateNewToken(), 100);
  })
  .subscribe();
\`\`\`
```

2. Section 7.6 (`setCourierStay`) hapus kode QR rotation yang salah masuk.

**Verifikasi:** Section 7 memiliki: 7.1, 7.2, 7.3, 7.4, **7.5**, **7.6**.

---

### ITEM 4.3 — Kembalikan Tier 🟠 di Section 12

**Status:** `[x]` ✅ **Selesai** (Sudah ada)  
**Kategori:** Dokumentasi  
**Masalah:** v2 menghapus tier 🟠 "Penting sebelum go-live".

**Verifikasi:** Tier 🟠 sudah ada di Section 12 dengan item auth check (item #6). Dokumentasi sudah akurat.

**Langkah:**

Revisi Section 12 menjadi:

```markdown
### ✅ Sudah Selesai
[item yang sudah diperbaiki]

### 🔴 Blocker — Sistem Tidak Bisa Ditest
[item 2.1, 2.2]

### 🟠 Keamanan — Harus Selesai Sebelum Go-Live
[item 3.1, 3.2]

### 🟡 Minor — Bisa Post-Launch
[item lainnya]
```

**Verifikasi:** Auth check ada di tier 🟠.

---

### ITEM 4.4 — Dokumentasikan Kolom `day_off`

**Status:** `[x]` ✅ **Selesai**  
**Kategori:** Dokumentasi  
**Masalah:** Kolom `day_off` di `profiles` dipakai oleh `get_missing_couriers` tapi tidak terdokumentasi.

**Langkah:**

1. Verifikasi kolom ada:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'day_off';
```

2. Tambahkan ke Section 8 (Struktur Database, bagian `profiles`):

```sql
day_off    TEXT    -- Hari libur reguler kurir (format: 'Monday', 'Tuesday', dst)
                   -- NULL = tidak ada hari libur reguler
                   -- Dipakai oleh get_missing_couriers untuk exclude kurir di hari liburnya
```

**Verifikasi:** Section 8 mencantumkan kolom `day_off`.

---

### ITEM 4.5 — Update Section 3.4: Kode `process_shift_alpha`

**Status:** `[x]` (sudah diupdate dengan versi terbaru dari migration 20260429)  
**Kategori:** Dokumentasi  
**Masalah:** Kode di dokumen mungkin tidak mencerminkan fix untuk Shift D (overnight).

**Langkah:**

1. Jalankan:
```sql
SELECT prosrc FROM pg_proc WHERE proname = 'process_shift_alpha';
```

2. Copy hasil, paste ke Section 3.4 di dokumen.

3. Pastikan kode mencakup:
   - Variabel `v_shift_date` untuk tracking tanggal mulai shift
   - Kondisi if/else untuk overnight shift
   - `ON CONFLICT (courier_id, date) DO NOTHING`

**Verifikasi:** Section 3.4 identik dengan output query.

---

## Ringkasan Status

| Prioritas | Total Item | Selesai | Sisa |
|-----------|-----------|---------|------|
| P1 — UI & Fitur Baru | 3 | 3 | 0 |
| P2 — Data Operasional | 3 | 3 | 0 |
| P3 — Keamanan | 2 | 2 | 0 |
| P4 — Update Dokumentasi | 5 | 5 | 0 |
| **Total** | **13** | **13** | **0** |

---

## Urutan Pengerjaan yang Direkomendasikan

```
Sesi 1: ITEM 1.1 (UI CRUD Basecamps)
         → Setelah ini, bisa input data basecamp via UI

Sesi 2: ITEM 1.2 (UI Hari Libur)
         → Fitur pelengkap di tab yang sama

Sesi 3: ITEM 2.1 (Input data basecamp via UI baru)
         + ITEM 2.2 (Assign kurir ke shift)
         → Setelah ini, bisa test end-to-end absensi

Sesi 4: ITEM 3.1 (Auth check reset_daily_fine_flags)
         → Setelah ini, sistem lebih aman

Sesi 5: ITEM 3.2 (Auth check get_courier_fines — jika dipakai)
         → Selesaikan keamanan

Sesi 6+: ITEM 4.1 – 4.5 (Update dokumentasi)
         → Dokumen akurat untuk referensi AI berikutnya
```

---

## Aturan untuk Agent

```
JANGAN lakukan tanpa konfirmasi manusia:
  ✗ Drop atau truncate tabel apapun
  ✗ Ubah logika kalkulasi komisi atau denda
  ✗ Modifikasi RLS yang bisa memblokir akses
  ✗ Mengubah nilai radius GPS (tetap 10 meter)
  ✗ Mengubah threshold konsensus GPS (tetap 5x)
  ✗ Mengerjakan lebih dari 1 item per sesi

SELALU lakukan:
  ✓ Baca kode/SQL aktual sebelum menulis fix
  ✓ Tampilkan diff sebelum apply
  ✓ Jalankan query verifikasi setelah setiap item
  ✓ Gunakan CREATE OR REPLACE FUNCTION (bukan DROP + CREATE)
  ✓ Gunakan ADD COLUMN IF NOT EXISTS (bukan ADD COLUMN)
  ✓ Buat migration file untuk setiap perubahan database
  ✓ Nama file migration: YYYYMMDD_deskripsi_singkat.sql
```

---

*Dokumen ini diperbarui: 2 Mei 2026*  
*Untuk verifikasi kode aktual di database:*
```sql
SELECT proname, prosrc FROM pg_proc WHERE proname = '[nama_fungsi]';
```
