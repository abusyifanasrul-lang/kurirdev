# 🚨 FITUR BARU: Auto-OFF saat Reminder 60 Menit

**Date:** June 3, 2026  
**Status:** ✅ DEPLOYED  
**Purpose:** Enforce disiplin check-in kurir

---

## 🎯 Masalah Yang Diselesaikan

**Problem:**  
Kurir sering lupa check-in atau check-in terlambat, menyebabkan:
- Late attendance yang tidak perlu
- Admin harus reminder manual
- Kurir tidak disiplin terhadap jam shift

**Solution:**  
**60 menit sebelum shift dimulai**, semua kurir di shift tersebut **otomatis di-OFF-kan**.

---

## ⚡ Cara Kerja

### Timeline Check-in

```
T-60min          T-30min           T-0min (shift start)
   |                |                     |
   v                v                     v
[AUTO-OFF]      [Reminder]          [Shift starts]
   |                                     |
   +--------- Check-in Window ----------+
         (Allowed: T-60 to T-0)
```

### Step-by-Step:

1. **T-60 menit:** Cron job `send_shift_reminder_60min()` dijalankan
   - ✅ **SEMUA kurir** di shift tersebut di-OFF-kan
   - ✅ `courier_status` = 'off'
   - ✅ `is_online` = false
   - ✅ `queue_joined_at` = NULL
   - ✅ Notifikasi dikirim ke kurir

2. **T-60 sampai T-0:** Check-in window terbuka
   - Kurir HARUS manual check-in (tekan tombol ON)
   - Jika check-in: status jadi ON, masuk queue
   - Jika TIDAK check-in: otomatis late saat shift start

3. **T-30 menit:** Reminder kedua (tanpa auto-OFF)
   - Cron job `send_shift_reminder_30min()` dijalankan
   - Hanya kirim notifikasi
   - Tidak ada perubahan status

4. **T-0 (shift start):** Shift dimulai
   - Attendance record dibuat via `process_shift_start()`
   - Kurir yang belum check-in = status LATE

---

## 🔧 Implementasi Teknis

### Function 1: `send_shift_reminder_60min()` - UPDATED

**Status:** ✅ Function sudah ada sebelumnya, DI-UPDATE dengan fitur auto-OFF

**Logic:**
```sql
-- AUTO-OFF semua kurir di shift
UPDATE profiles
SET 
  courier_status = 'off',
  is_online = false,
  queue_joined_at = NULL,
  updated_at = now()
WHERE role = 'courier'
  AND is_active = true
  AND shift_id = p_shift_id
  AND courier_status IN ('on', 'stay');  -- Hanya yang sedang ON/STAY
```

**Features:**
- ✅ Uses `tz_today()` dan `tz_now()` dari TZ module
- ✅ Force OFF semua kurir di shift
- ✅ Reset `queue_joined_at` (keluar dari queue)
- ✅ Log ke `cron_execution_logs`
- ✅ Skip kurir yang sedang `day_off`

### Function 2: `send_shift_reminder_30min()` - EXISTING

**Status:** ✅ Function sudah ada sebelumnya, tetap notification only

**Logic:**
- Hanya kirim notifikasi
- TIDAK ada auto-OFF
- Reminder terakhir sebelum shift

---

## 📊 Contoh Skenario

### Skenario 1: Kurir Disiplin ✅

**Shift A: 06:05 - 08:05 Makassar**

| Waktu | Event | Status Kurir | Keterangan |
|-------|-------|--------------|------------|
| 05:05 | 60min reminder | **OFF** (forced) | Auto-OFF oleh sistem |
| 05:10 | Kurir check-in | **ON** | Kurir tekan tombol ON |
| 05:35 | 30min reminder | **ON** | Reminder saja, status tidak berubah |
| 06:05 | Shift start | **ON** | Attendance: on_time ✅ |

**Result:** ✅ Kurir tepat waktu, tidak late

---

### Skenario 2: Kurir Lupa Check-in ❌

**Shift A: 06:05 - 08:05 Makassar**

| Waktu | Event | Status Kurir | Keterangan |
|-------|-------|--------------|------------|
| 05:05 | 60min reminder | **OFF** (forced) | Auto-OFF oleh sistem |
| 05:10 | Tidak ada aksi | **OFF** | Kurir lupa check-in |
| 05:35 | 30min reminder | **OFF** | Masih OFF |
| 06:05 | Shift start | **OFF** | Attendance: late ❌ |

**Result:** ❌ Kurir late, `late_fine_active = true`

---

### Skenario 3: Kurir Check-in Terlambat ⚠️

**Shift A: 06:05 - 08:05 Makassar**

| Waktu | Event | Status Kurir | Keterangan |
|-------|-------|--------------|------------|
| 05:05 | 60min reminder | **OFF** (forced) | Auto-OFF oleh sistem |
| 05:10 | Tidak ada aksi | **OFF** | Kurir belum check-in |
| 06:10 | Kurir check-in | **ON** | Check-in 5 menit terlambat |
| | | | Attendance: late_minutes = 5 ⚠️ |

**Result:** ⚠️ Kurir late 5 menit, tapi setidaknya sudah check-in

---

## ✅ Cron Job Schedule

### Shift A (06:05 - 08:05 Makassar)

| Job | Waktu Makassar | Waktu UTC | Cron Schedule | Function |
|-----|----------------|-----------|---------------|----------|
| **60min reminder** | 05:05 | 21:05 | `5 21 * * *` | `send_shift_reminder_60min()` |
| **30min reminder** | 05:35 | 21:35 | `35 21 * * *` | `send_shift_reminder_30min()` |
| **Shift start** | 06:05 | 22:05 | `5 22 * * *` | `process_shift_start()` |
| **Shift end** | 08:05 | 00:05 | `5 0 * * *` | `process_shift_end()` |

**Verifikasi:**
```sql
SELECT jobname, schedule 
FROM cron.job 
WHERE jobname LIKE 'shift-%' 
ORDER BY schedule;
```

---

## 🎓 Keuntungan Fitur Ini

### Untuk Kurir:
- ✅ **Reminder jelas**: Dapat notifikasi 60min dan 30min sebelum shift
- ✅ **Paksa disiplin**: Harus aktif check-in, tidak bisa lupa
- ✅ **Jelas statusnya**: Jika OFF, berarti belum check-in

### Untuk Admin:
- ✅ **Tidak perlu reminder manual**: Sistem otomatis enforce
- ✅ **Data attendance akurat**: Hanya kurir yang aktif check-in yang on_time
- ✅ **Easy monitoring**: Lihat siapa yang belum check-in dari status OFF

### Untuk Sistem:
- ✅ **Konsisten**: Semua kurir diperlakukan sama
- ✅ **Reliable**: Cron job berjalan otomatis
- ✅ **Auditable**: Semua tercatat di `cron_execution_logs`

---

## 📝 Notification Message

### 60min Reminder:
```
Title: Shift [Nama] dimulai dalam 60 menit
Message: Shift Anda dimulai pukul [waktu]. 
         Status Anda telah di-OFF otomatis. 
         Silakan check-in dalam rentang waktu yang diizinkan.
```

### 30min Reminder:
```
Title: Shift [Nama] dimulai dalam 30 menit
Message: Shift Anda dimulai pukul [waktu]. 
         Jangan lupa check-in! 
         Window check-in akan segera ditutup.
```

---

## 🔍 Monitoring & Logging

### Cek Execution Logs:
```sql
SELECT 
  job_type,
  shift_id,
  status,
  records_affected,
  error_message,
  created_at
FROM cron_execution_logs
WHERE job_type IN ('shift_reminder_60min', 'shift_reminder_30min')
ORDER BY created_at DESC
LIMIT 20;
```

### Cek Kurir Status sebelum Shift:
```sql
SELECT 
  p.name,
  p.courier_status,
  p.is_online,
  s.name as shift_name,
  s.start_time
FROM profiles p
JOIN shifts s ON s.id = p.shift_id
WHERE p.role = 'courier'
  AND p.is_active = true
  AND s.is_active = true
ORDER BY s.start_time, p.name;
```

---

## ⚠️ Edge Cases

### Q: Bagaimana jika kurir sudah ON sebelum reminder?
**A:** Tetap di-OFF-kan. Semua kurir diperlakukan sama untuk konsistensi.

### Q: Bagaimana jika kurir day_off?
**A:** Skip. Fungsi check `day_off` field dan tidak OFF-kan kurir yang sedang libur.

### Q: Bagaimana jika cron job gagal?
**A:** Error di-log ke `cron_execution_logs` dengan status 'failed'. Alert admin jika perlu.

### Q: Apakah notifikasi tetap dikirim jika table tidak ada?
**A:** No. Notifikasi akan error tapi auto-OFF tetap berjalan (yang lebih penting).

---

## 🚀 Deployment

### Status:
- ✅ Function `send_shift_reminder_60min()` UPDATED (added auto-OFF logic)
- ✅ Function `send_shift_reminder_30min()` EXISTS (unchanged)
- ✅ Cron jobs already scheduled via `sync_shift_cron_jobs()`
- ✅ Integration with TZ module
- ✅ Tested and verified

### What Changed:
- **Updated existing function** `send_shift_reminder_60min()` to add auto-OFF enforcement
- **No new resources created** - efficient update to existing infrastructure
- **Cron jobs unchanged** - already scheduled correctly

### Files Modified:
- Database: `send_shift_reminder_60min()` function (via execute_sql)
- Documentation: `AUTO_OFF_FEATURE.md` (this document)

### Commit:
```
feat: add auto-OFF enforcement to existing 60min reminder

- Updated send_shift_reminder_60min(): Forces all couriers to OFF
- Reuses existing cron infrastructure (no new resources)
- Uses TZ module (tz_today, tz_now)
- Enforces check-in discipline

Behavior:
- 60min before shift: ALL couriers forced to OFF
- Couriers must manually check-in within allowed window
- Improves attendance accuracy and courier discipline

Note: Updated existing function, no new migrations needed.
```

---

## 🎉 Kesimpulan

**Fitur auto-OFF berhasil diimplementasikan!**

- ✅ Kurir **dipaksa disiplin** check-in
- ✅ **Tidak bisa lupa** check-in karena status OFF
- ✅ **Attendance data lebih akurat**
- ✅ **Admin tidak perlu reminder manual**

**60 menit sebelum shift = AUTO-OFF semua kurir!** 🚨

---

**Created:** June 3, 2026  
**By:** AI Assistant  
**Status:** ✅ PRODUCTION READY

