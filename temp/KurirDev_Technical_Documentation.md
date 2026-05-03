# KurirDev — Dokumentasi Teknis Lengkap
### Sistem Manajemen Kurir: Antrian, Shift, Denda & GPS STAY

> **Versi:** April 2026  
> **Stack:** React + TypeScript + Zustand + Supabase + Capacitor Android

---

## Daftar Isi

1. [Gambaran Arsitektur](#1-gambaran-arsitektur)
2. [Sistem Antrian Kurir (FIFO Multi-Tier)](#2-sistem-antrian-kurir-fifo-multi-tier)
3. [Sistem Shift & Kehadiran](#3-sistem-shift--kehadiran)
4. [Sistem Denda & Penalti](#4-sistem-denda--penalti)
5. [Sistem Settlement (Penagihan)](#5-sistem-settlement-penagihan)
6. [Warning Dashboard Kehadiran](#6-warning-dashboard-kehadiran)
7. [GPS STAY Monitoring](#7-gps-stay-monitoring)
8. [Struktur Database Lengkap](#8-struktur-database-lengkap)
9. [Daftar Semua RPC & Fungsi Database](#9-daftar-semua-rpc--fungsi-database)
10. [Daftar Semua File Frontend](#10-daftar-semua-file-frontend)
11. [Keputusan Desain & Constraint](#11-keputusan-desain--constraint)
12. [Item Pre-Deployment](#12-item-pre-deployment)

---

## 1. Gambaran Arsitektur

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                      │
│  Orders.tsx  │  AttendanceMonitoring.tsx  │  Finance     │
│  Couriers.tsx│  Settings.tsx              │  Penagihan   │
└──────────────────────┬──────────────────────────────────┘
                       │ Supabase Realtime + RPC
┌──────────────────────▼──────────────────────────────────┐
│                 SUPABASE BACKEND                         │
│                                                          │
│  PostgreSQL Database                                     │
│  ├── Triggers (handle_courier_queue_sync)                │
│  ├── RPC Functions (assign_order_and_rotate, dll)        │
│  ├── Row Level Security                                  │
│  └── Realtime Subscriptions                             │
│                                                          │
│  Edge Functions                                          │
│  └── process-alpha (cron: tengah malam)                  │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              ANDROID NATIVE (Capacitor)                  │
│  StayMonitoringService.kt — Foreground Service GPS       │
│  useStayMonitor.ts — Bridge hook ke native               │
│  stayMonitoring.ts — Bridge library                      │
└─────────────────────────────────────────────────────────┘
```

**Prinsip utama:**
- Semua logika bisnis kritis berjalan di **database** (bukan frontend) — tidak bisa dimanipulasi dari aplikasi
- Frontend hanya menampilkan dan menginput — tidak pernah menghitung ulang nilai yang harusnya dari DB
- Setiap operasi kritis bersifat **atomic** — tidak ada state yang setengah jalan

---

## 2. Sistem Antrian Kurir (FIFO Multi-Tier)

### 2.1 Konsep Dasar

Sistem antrian menentukan kurir mana yang diprioritaskan saat admin akan mengassign order. Urutan ditentukan oleh dua faktor:

1. **Tier** — kondisi aktual kurir saat ini
2. **Timestamp** — siapa yang lebih dulu masuk ke kondisi tersebut

```
Prinsip FIFO: Di dalam tier yang sama, siapa yang masuk lebih dulu = lebih depan
```

### 2.2 Lima Tier Prioritas

| Tier | Kondisi | Alasan Bisnis |
|------|---------|---------------|
| **1** | `is_priority_recovery = true` | Order satu-satunya baru di-cancel → kurir dirugikan, harus dilindungi |
| **2** | `courier_status = 'stay'` AND tidak ada order aktif | Hadir fisik di basecamp (verifikasi QR), siap lebih cepat |
| **3** | `courier_status = 'on'` AND `order = 0` | Kurir idle normal |
| **4** | `courier_status = 'on'` AND semua order berstatus `pending` | Punya order tapi sedang nunggu di merchant |
| **5** | `courier_status = 'on'` AND ada order aktif (`picked_up`/`in_transit`) | Sedang sibuk |

**Tier Khusus "Out of Shift":** Kurir yang ON di luar jam shiftnya mendapat flag `out_of_shift`. Tidak masuk antrian normal, hanya bisa di-assign manual oleh admin.

### 2.3 Skema Database Antrian

```sql
-- Kolom kunci di tabel profiles
courier_status    TEXT        -- 'on' | 'stay' | 'off' (SUMBER KEBENARAN)
is_online         BOOLEAN     -- mirror otomatis dari courier_status via trigger
queue_joined_at   TIMESTAMPTZ -- posisi antrian (NULL = tidak dalam antrian)
is_priority_recovery BOOLEAN  -- flag tier 1
cancel_count      INT         -- counter cancel berturut-turut
late_fine_active  BOOLEAN     -- flag denda per-order aktif hari ini
shift_id          UUID        -- FK ke tabel shifts
```

### 2.4 Trigger: `handle_courier_queue_sync`

Trigger ini adalah "otak" antrian. Berjalan setiap kali ada UPDATE di tabel `profiles`.

```sql
CREATE OR REPLACE FUNCTION public.handle_courier_queue_sync()
RETURNS TRIGGER AS $$
DECLARE
  v_old_status TEXT;
  v_new_status TEXT;
  v_reset_needed BOOLEAN := false;
BEGIN
  -- Skip jika bukan kurir
  IF NEW.role != 'courier' THEN
    NEW.queue_joined_at := NULL;
    NEW.is_online := false;
    RETURN NEW;
  END IF;

  v_old_status := COALESCE(OLD.courier_status, 'off');
  v_new_status := COALESCE(NEW.courier_status, 'off');

  -- 1. Mirror is_online dari courier_status (otomatis)
  IF (NEW.is_active = true) AND (v_new_status IN ('on', 'stay')) THEN
    NEW.is_online := true;
  ELSE
    NEW.is_online := false;
  END IF;

  -- 2. Manajemen timestamp antrian — HANYA transisi spesifik yang reset
  IF NEW.is_online = false THEN
    NEW.queue_joined_at := NULL;

  ELSIF (TG_OP = 'INSERT' AND NEW.is_online = true) THEN
    v_reset_needed := true;

  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.is_online = false AND NEW.is_online = true) THEN
      v_reset_needed := true;                    -- off → on/stay
    ELSIF (v_old_status = 'on' AND v_new_status = 'stay') OR
          (v_old_status = 'stay' AND v_new_status = 'on') THEN
      v_reset_needed := true;                    -- perpindahan on ↔ stay
    ELSIF (OLD.is_active = false AND NEW.is_active = true AND NEW.is_online = true) THEN
      v_reset_needed := true;                    -- unsuspend
    ELSIF (NEW.queue_joined_at IS NULL AND NEW.is_online = true) THEN
      v_reset_needed := true;                    -- recovery state
    END IF;
  END IF;

  IF v_reset_needed THEN
    NEW.queue_joined_at := NOW();
  END IF;

  -- 3. Suspend: paksa keluar antrian
  IF NEW.is_active = false AND OLD.is_active = true THEN
    NEW.courier_status       := 'off';
    NEW.is_online            := false;
    NEW.queue_joined_at      := NULL;
    NEW.is_priority_recovery := false;
  END IF;

  -- 4. Audit trail
  IF (TG_OP = 'UPDATE') AND
     (v_old_status != v_new_status OR
      OLD.is_priority_recovery IS DISTINCT FROM NEW.is_priority_recovery) THEN

    INSERT INTO public.tier_change_log (
      courier_id, trigger_source,
      queue_joined_at_before, queue_joined_at_after,
      context, happened_at
    ) VALUES (
      NEW.id,
      'status_' || v_old_status || '_to_' || v_new_status,
      OLD.queue_joined_at, NEW.queue_joined_at,
      jsonb_build_object(
        'old_status', v_old_status,
        'new_status', v_new_status,
        'is_priority_recovery', NEW.is_priority_recovery
      ),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Kapan `queue_joined_at` di-reset ke `NOW()`:**

| Transisi | Reset? | Alasan |
|----------|--------|--------|
| `off → on` | ✅ Ya | Masuk antrian baru |
| `off → stay` | ✅ Ya | Masuk antrian baru |
| `on → stay` | ✅ Ya | Datang ke basecamp, diapresiasi dengan posisi baru |
| `stay → on` | ✅ Ya | Meninggalkan basecamp, mulai fresh |
| `on → off` | ❌ Tidak | Keluar antrian, timestamp di-NULL |
| Suspend (`is_active = false`) | ❌ Tidak | Paksa keluar, timestamp di-NULL |
| Update metadata lain | ❌ Tidak | Tidak mempengaruhi posisi antrian |

### 2.5 Sorting di Frontend (Orders.tsx)

```typescript
// src/pages/Orders.tsx
const availableCouriers = useMemo(() => {
  const courierList = users.filter(u => 
    u.role === 'courier' && u.is_active === true && u.is_online === true
  );

  return courierList.sort((a, b) => {
    const getTier = (u: any) => {
      // Tier 1: Cancel boost
      if (u.is_priority_recovery) return 1;
      
      // Tier 2: STAY (hadir di basecamp)
      if (u.courier_status === 'stay') return 2;
      
      // Hitung komposisi order aktif
      const activeOrders = activeOrdersByCourier.filter(o => 
        o.courier_id === u.id && !['cancelled', 'delivered'].includes(o.status)
      );
      const pendingOnly = activeOrders.every(o => 
        ['pending', 'assigned'].includes(o.status)
      );
      const hasActiveRunning = activeOrders.some(o => 
        ['picked_up', 'in_transit'].includes(o.status)
      );

      if (u.courier_status === 'on' && activeOrders.length === 0) return 3;
      if (u.courier_status === 'on' && pendingOnly) return 4;
      if (u.courier_status === 'on' && hasActiveRunning) return 5;
      
      return 6; // fallback
    };

    const tierA = getTier(a);
    const tierB = getTier(b);
    if (tierA !== tierB) return tierA - tierB;

    // Tiebreaker: queue_joined_at (lebih lama = lebih depan)
    const timeA = a.queue_joined_at ? new Date(a.queue_joined_at).getTime() : Infinity;
    const timeB = b.queue_joined_at ? new Date(b.queue_joined_at).getTime() : Infinity;
    if (timeA !== timeB) return timeA - timeB;

    // Final tiebreaker: UUID (deterministic)
    return a.id.localeCompare(b.id);
  });
}, [users, activeOrdersByCourier]);
```

### 2.6 RPC: `assign_order_and_rotate` (Atomic Assignment)

```sql
CREATE OR REPLACE FUNCTION public.assign_order_and_rotate(
  p_order_id    UUID,
  p_courier_id  UUID,
  p_courier_name TEXT,
  p_admin_id    UUID,
  p_admin_name  TEXT,
  p_notes       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Step 1: Assign order (guard: hanya jika masih pending)
  UPDATE public.orders
  SET courier_id   = p_courier_id,
      courier_name = p_courier_name,
      status       = 'assigned',
      assigned_at  = NOW(),
      assigned_by  = p_admin_id
  WHERE id = p_order_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order tidak tersedia untuk di-assign';
  END IF;

  -- Step 2: Reset priority recovery
  UPDATE public.profiles
  SET is_priority_recovery = false
  WHERE id = p_courier_id;

  -- Step 3: Rotate queue (pindah ke belakang antrian)
  PERFORM rotate_courier_queue(p_courier_id);

  -- Step 4: Log tracking
  INSERT INTO public.tracking_logs (order_id, status, changed_by, changed_by_name, notes, changed_at)
  VALUES (p_order_id, 'assigned', p_admin_id, p_admin_name, p_notes, NOW());

  SELECT jsonb_build_object('success', true, 'order_id', p_order_id) INTO v_result;
  RETURN v_result;
END;
$$;
```

### 2.7 RPC: `rotate_courier_queue`

```sql
CREATE OR REPLACE FUNCTION public.rotate_courier_queue(p_courier_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- O(1): cukup update timestamp ke NOW()
  -- Semua kurir yang queue_joined_at < NOW() otomatis lebih depan
  UPDATE public.profiles
  SET queue_joined_at = NOW()
  WHERE id = p_courier_id;
END;
$$;
```

### 2.8 Trigger: Cancel → Tier 1

```sql
CREATE OR REPLACE FUNCTION public.handle_order_cancellation_priority()
RETURNS TRIGGER AS $$
DECLARE
  v_active_count INT;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    -- Hitung sisa order aktif kurir
    SELECT COUNT(*) INTO v_active_count
    FROM orders
    WHERE courier_id = OLD.courier_id
      AND status NOT IN ('cancelled', 'delivered');

    -- Jika tidak ada sisa order → naik ke Tier 1
    IF v_active_count = 0 THEN
      UPDATE profiles
      SET is_priority_recovery = true,
          cancel_count         = cancel_count + 1
      WHERE id = OLD.courier_id;

      -- Cek apakah sudah cancel 3x berturut-turut
      -- (pengiriman warning ke admin dilakukan di level aplikasi)
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2.9 Skenario Lengkap Antrian

**Skenario 1: Kurir masuk antrian normal**
```
08:00 — Andi klik tombol ON
        → trigger: courier_status='on', is_online=true, queue_joined_at='08:00:00'
        → Andi masuk Tier 3, posisi #1

08:30 — Budi scan QR STAY di basecamp
        → trigger: courier_status='stay', is_online=true, queue_joined_at='08:30:00'
        → Budi masuk Tier 2 (di atas Andi meski Andi lebih dulu online)

09:00 — Cici klik tombol ON
        → queue_joined_at='09:00:00'
        → Cici Tier 3, posisi #2 (di belakang Andi)

Hasil antrian: [Budi T2] → [Andi T3 08:00] → [Cici T3 09:00]
```

**Skenario 2: Order cancel → Tier 1**
```
State awal: Dedi T5 (1 order aktif)

Order Dedi di-cancel:
  → trigger: remaining_orders = 0
  → is_priority_recovery = true
  → cancel_count++

Antrian baru:
  [Dedi T1] → [Budi T2] → [Andi T3] → [Cici T3]

Dedi dapat order baru:
  → assign_order_and_rotate dipanggil
  → is_priority_recovery = false
  → queue_joined_at = NOW() (pindah ke belakang)
  → Dedi masuk Tier 5
```

**Skenario 3: Order campuran pending + aktif**
```
Eko punya: Order A (pending, nunggu di merchant) + Order B (in_transit)
  → active_count = 1 (Order B)
  → Tier 5 (meski Order A pending, ada yang aktif)

Order B selesai:
  → active_count = 0, pending_count = 1 (Order A)
  → Tier 4

Order A juga selesai:
  → order_count = 0
  → complete_order dipanggil → cancel_count = 0, is_priority_recovery = false
  → queue_joined_at = NOW() (kembali ke antrian dari belakang)
  → Tier 3
```

### 2.10 Tabel Audit: `tier_change_log`

```sql
CREATE TABLE tier_change_log (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id              UUID NOT NULL REFERENCES profiles(id),
  tier_before             INT,
  tier_after              INT,
  queue_joined_at_before  TIMESTAMPTZ,
  queue_joined_at_after   TIMESTAMPTZ,
  trigger_source          TEXT NOT NULL,
  source_id               UUID,
  context                 JSONB,
  happened_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tierlog_courier ON tier_change_log(courier_id, happened_at DESC);
```

**Query debug:**
```sql
-- "Kenapa kurir X tiba-tiba di tier 5 jam 14:00 tadi?"
SELECT tier_before, tier_after, trigger_source, context, happened_at
FROM tier_change_log
WHERE courier_id = 'uuid-kurir-X'
  AND happened_at BETWEEN '2026-04-25 13:00' AND '2026-04-25 15:00'
ORDER BY happened_at DESC;
```

---

## 3. Sistem Shift & Kehadiran

### 3.1 Empat Kelompok Shift

| Shift | Jam Mulai | Jam Selesai | Overnight? |
|-------|-----------|-------------|------------|
| Shift A | 06:00 | 17:00 | Tidak |
| Shift B | 07:00 | 17:30 | Tidak |
| Shift C | 10:00 | 22:00 | Tidak |
| Shift D | 18:45 | 06:00 | **Ya** (melintas tengah malam) |

**Aturan referensi tanggal untuk Shift D:** Selalu gunakan tanggal mulai shift sebagai referensi. Kurir Shift D yang mulai Senin malam dianggap bertugas di "Senin", meski selesainya Selasa pagi.

### 3.2 Struktur Tabel Shift

```sql
-- Master data shift
CREATE TABLE shifts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  is_overnight BOOLEAN DEFAULT false,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Seed data
INSERT INTO shifts (name, start_time, end_time, is_overnight) VALUES
  ('Shift A', '06:00', '17:00', false),
  ('Shift B', '07:00', '17:30', false),
  ('Shift C', '10:00', '22:00', false),
  ('Shift D', '18:45', '06:00', true);

-- Assignment kurir ke shift (permanen)
CREATE TABLE courier_shifts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shift_id       UUID NOT NULL REFERENCES shifts(id),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to   DATE,
  UNIQUE(courier_id, effective_from)
);

-- Override tukar shift per tanggal (tidak permanen)
CREATE TABLE shift_overrides (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                   DATE NOT NULL,
  original_courier_id    UUID NOT NULL REFERENCES profiles(id),
  replacement_courier_id UUID NOT NULL REFERENCES profiles(id),
  original_shift_id      UUID NOT NULL REFERENCES shifts(id),
  created_by             UUID REFERENCES profiles(id),
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- Log kehadiran harian
CREATE TABLE shift_attendance (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id        UUID NOT NULL REFERENCES profiles(id),
  shift_id          UUID NOT NULL REFERENCES shifts(id),
  date              DATE NOT NULL,
  first_online_at   TIMESTAMPTZ,
  late_minutes      INT DEFAULT 0,
  status            TEXT DEFAULT 'on_time',
    -- 'on_time' | 'late' | 'late_minor' | 'late_major' | 'alpha' | 'excused'
  fine_type         TEXT,
    -- 'per_order' | 'flat_major' | 'flat_alpha' | NULL
  fine_per_order    INT DEFAULT 0,
  flat_fine         INT DEFAULT 0,
  flat_fine_status  TEXT DEFAULT 'active',
    -- 'active' | 'paid' | 'cancelled'
  cancelled_by      UUID REFERENCES profiles(id),
  cancelled_at      TIMESTAMPTZ,
  cancel_reason     TEXT,
  resolved_by       UUID REFERENCES profiles(id),
  resolved_at       TIMESTAMPTZ,
  notes             TEXT,
  UNIQUE(courier_id, date)
);

-- Hari libur
CREATE TABLE holidays (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  is_national BOOLEAN DEFAULT true,
  is_active   BOOLEAN DEFAULT false,
  set_by      UUID REFERENCES profiles(id),
  set_at      TIMESTAMPTZ
);
```

### 3.3 RPC: `record_courier_checkin`

Dipanggil dari frontend saat kurir pertama kali ON hari itu. Berjalan secara **eksplisit**, bukan dari trigger antrian.

```sql
CREATE OR REPLACE FUNCTION public.record_courier_checkin(p_courier_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_shift       RECORD;
  v_settings    RECORD;
  v_shift_start TIMESTAMPTZ;
  v_late_minutes INT := 0;
  v_already_exists BOOLEAN;
  v_timezone    TEXT;
  v_now_local   TIMESTAMPTZ;
BEGIN
  -- Ambil timezone dari settings
  SELECT operational_timezone INTO v_timezone FROM settings WHERE id = 'global';
  v_timezone := COALESCE(v_timezone, 'Asia/Makassar');
  v_now_local := NOW() AT TIME ZONE v_timezone;

  -- Cek sudah check-in hari ini belum
  SELECT EXISTS(
    SELECT 1 FROM public.shift_attendance
    WHERE courier_id = p_courier_id
    AND date = v_now_local::DATE
  ) INTO v_already_exists;

  IF v_already_exists THEN
    RETURN jsonb_build_object('status', 'already_checked_in');
  END IF;

  -- Ambil shift kurir
  SELECT s.* INTO v_shift
  FROM public.shifts s
  JOIN public.profiles p ON p.shift_id = s.id
  WHERE p.id = p_courier_id;

  IF v_shift IS NULL THEN
    RETURN jsonb_build_object('status', 'no_shift_assigned');
  END IF;

  -- Hitung jam mulai shift dalam waktu lokal
  v_shift_start := (v_now_local::DATE + v_shift.start_time);

  -- Handle overnight shift
  IF v_shift.is_overnight AND v_now_local < (v_shift_start - INTERVAL '6 hours') THEN
    v_shift_start := v_shift_start - INTERVAL '1 day';
  END IF;

  v_late_minutes := GREATEST(0, EXTRACT(EPOCH FROM (v_now_local - v_shift_start)) / 60);

  -- Insert attendance — admin yang tentukan denda, bukan otomatis
  INSERT INTO public.shift_attendance (
    courier_id, shift_id, date,
    first_online_at, late_minutes, status,
    fine_type, fine_per_order, flat_fine
  ) VALUES (
    p_courier_id, v_shift.id, v_now_local::DATE,
    NOW(), v_late_minutes,
    CASE WHEN v_late_minutes = 0 THEN 'on_time' ELSE 'late' END,
    NULL, 0, 0
  );

  RETURN jsonb_build_object(
    'status', 'checked_in',
    'late_minutes', v_late_minutes,
    'needs_admin_review', v_late_minutes > 0
  );
END;
$$;
```

**Dipanggil dari:**
```typescript
// src/stores/useCourierStore.ts
setCourierOnline: async (courierId, status) => {
  await userStore.updateUser(courierId, {
    is_online: true,
    courier_status: status,
    off_reason: '',
  });

  // Record attendance (silent fail — tidak blocking)
  if (status === 'on' || status === 'stay') {
    await supabase.rpc('record_courier_checkin', { p_courier_id: courierId });
  }
},
```

### 3.4 Deteksi Alpha (Kurir Tidak Hadir)

Dijalankan via **Edge Function cron** setiap tengah malam:

```typescript
// supabase/functions/process-alpha/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (_req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // 1. Reset late_fine_active semua kurir
    const { error: resetError } = await supabaseClient.rpc('reset_daily_fine_flags')
    if (resetError) throw new Error(`reset_daily_fine_flags failed: ${resetError.message}`)

    // 2. Proses deteksi alpha
    const { data: alphaData, error: alphaError } = await supabaseClient.rpc('process_shift_alpha')
    if (alphaError) throw new Error(`process_shift_alpha failed: ${alphaError.message}`)

    return new Response(
      JSON.stringify({
        message: 'Nightly processing completed',
        reset_fine_flags: 'ok',
        alpha_result: alphaData,
      }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }
})
```

```sql
-- RPC yang dipanggil oleh Edge Function
-- Perubahan terbaru (20260429):
-- 1. CURRENT_DATE -> v_today (from v_now_local::DATE)
-- 2. Add v_shift_date for overnight shifts processed after midnight
-- 3. Holiday check uses v_shift_date
-- 4. NOT EXISTS and INSERT use v_shift_date
-- 5. ON CONFLICT (courier_id, date) DO NOTHING untuk prevent duplicates

CREATE OR REPLACE FUNCTION process_shift_alpha()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift        RECORD;
  v_courier      RECORD;
  v_shift_end    TIMESTAMPTZ;
  v_shift_date   DATE;
  v_settings     RECORD;
  v_alpha_count  INT := 0;
  v_timezone     TEXT;
  v_now_local    TIMESTAMPTZ;
  v_today        DATE;
BEGIN
  SELECT * INTO v_settings FROM settings WHERE id = 'global';
  v_timezone  := COALESCE(v_settings.operational_timezone, 'Asia/Makassar');
  v_now_local := NOW() AT TIME ZONE v_timezone;
  v_today     := v_now_local::DATE;

  FOR v_shift IN
    SELECT * FROM shifts WHERE is_active = true
  LOOP
    -- Hitung shift_date dan shift_end berdasarkan overnight atau tidak
    IF v_shift.is_overnight THEN
      IF v_now_local::TIME < v_shift.start_time THEN
        -- Jika sekarang sebelum jam mulai shift, berarti shift kemarin
        v_shift_date := v_today - INTERVAL '1 day';
        v_shift_end  := v_today::DATE + v_shift.end_time;
      ELSE
        -- Jika sekarang setelah jam mulai shift, berarti shift hari ini
        v_shift_date := v_today;
        v_shift_end  := (v_today + INTERVAL '1 day')::DATE + v_shift.end_time;
      END IF;
    ELSE
      v_shift_date := v_today;
      v_shift_end  := v_today::DATE + v_shift.end_time;
    END IF;

    -- Skip jika shift belum selesai
    IF v_now_local < v_shift_end THEN
      CONTINUE;
    END IF;

    -- Skip jika hari libur (cek berdasarkan shift_date, bukan today)
    IF EXISTS (
      SELECT 1 FROM holidays
      WHERE date = v_shift_date AND is_active = true
    ) THEN
      CONTINUE;
    END IF;

    -- Cari kurir yang tidak punya attendance untuk shift_date ini
    FOR v_courier IN
      SELECT p.id
      FROM profiles p
      WHERE p.role = 'courier'
        AND p.is_active = true
        AND p.shift_id = v_shift.id
        AND NOT EXISTS (
          SELECT 1 FROM shift_attendance sa
          WHERE sa.courier_id = p.id
            AND sa.date = v_shift_date
        )
    LOOP
      INSERT INTO shift_attendance (
        courier_id, shift_id, date,
        first_online_at, status,
        fine_type, flat_fine,
        flat_fine_status
      ) VALUES (
        v_courier.id, v_shift.id, v_shift_date,
        NULL, 'alpha',
        'flat_alpha',
        COALESCE(v_settings.fine_alpha_amount, 50000),
        'active'
      )
      ON CONFLICT (courier_id, date) DO NOTHING;

      v_alpha_count := v_alpha_count + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'alpha_count', v_alpha_count,
    'processed_at', NOW()
  );
END;
$$;
```

### 3.5 Flow Lengkap Kehadiran

```
Jam 06:00 — Shift A dimulai
│
├─ 06:01 — Andi ON → record_courier_checkin dipanggil
│          late_minutes = 1, status = 'late'
│          Dashboard admin: warning kuning muncul "Andi terlambat 1 menit"
│
├─ 07:05 — Budi belum ON (65 menit setelah shift mulai)
│          get_missing_couriers() mengembalikan Budi
│          Dashboard admin: warning merah "Budi belum check-in >60 menit"
│
│  Admin menghubungi Budi, lalu memutuskan:
│  ├─ Opsi A: Klik "Apply Denda" → apply_attendance_fine(id, 'flat_major', admin_id)
│  │          → late_fine_active TIDAK diubah (denda flat, bukan per-order)
│  │          → flat_fine = 30000, status = 'late_major'
│  │
│  └─ Opsi B: Klik "Maafkan" → excuse_attendance(id, admin_id)
│             → status = 'excused', fine = 0
│
├─ 17:00 — Shift A selesai
│
└─ 00:00 — Edge Function jalan:
           1. reset_daily_fine_flags() → late_fine_active semua kurir = false
           2. process_shift_alpha() → cek siapa yang tidak pernah hadir
              → Jika ada: INSERT shift_attendance dengan status='alpha', flat_fine=50000
```

---

## 4. Sistem Denda & Penalti

### 4.1 Tiga Jenis Denda

| Jenis | Kondisi | Besaran Default | Cara Potong |
|-------|---------|----------------|-------------|
| **Denda minor (per-order)** | Terlambat 1-59 menit | Rp 1.000/order | Dipotong dari setiap order saat selesai via `complete_order` |
| **Denda major (flat)** | Terlambat ≥60 menit | Rp 30.000 | Dipotong saat settlement |
| **Denda alpha (flat)** | Tidak hadir sama sekali | Rp 50.000 | Dipotong saat settlement |

**Prinsip penting:** Semua denda dijatuhkan oleh **admin**, bukan otomatis oleh sistem. Sistem hanya mendeteksi dan menampilkan warning.

### 4.2 Parameter Denda (Konfigurasi Owner)

Semua nilai disimpan di tabel `settings` (id='global') dan bisa diubah owner melalui UI Settings → Komisi & Biaya:

```sql
fine_late_minor_amount   INT DEFAULT 1000   -- Rp 1.000/order
fine_late_major_minutes  INT DEFAULT 60     -- threshold menit
fine_late_major_amount   INT DEFAULT 30000  -- Rp 30.000
fine_alpha_amount        INT DEFAULT 50000  -- Rp 50.000
billing_start_day        INT DEFAULT 1      -- 1=Senin
operational_timezone     TEXT DEFAULT 'Asia/Jakarta'
```

### 4.3 RPC: `apply_attendance_fine`

```sql
CREATE OR REPLACE FUNCTION public.apply_attendance_fine(
  p_attendance_id UUID,
  p_fine_type     TEXT,   -- 'per_order' atau 'flat_major'
  p_admin_id      UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_attendance RECORD;
  v_settings   RECORD;
  v_fine_amount INT;
BEGIN
  SELECT * INTO v_attendance FROM shift_attendance WHERE id = p_attendance_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Record tidak ditemukan');
  END IF;

  SELECT * INTO v_settings FROM settings WHERE id = 'global';

  IF p_fine_type = 'per_order' THEN
    v_fine_amount := COALESCE(v_settings.fine_late_minor_amount, 1000);
    UPDATE shift_attendance SET
      fine_type      = 'per_order',
      fine_per_order = v_fine_amount,
      status         = 'late_minor',
      resolved_by    = p_admin_id,
      resolved_at    = NOW()
    WHERE id = p_attendance_id;

    -- Aktifkan flag denda per-order di profil kurir
    UPDATE profiles SET late_fine_active = true WHERE id = v_attendance.courier_id;

  ELSIF p_fine_type = 'flat_major' THEN
    v_fine_amount := COALESCE(v_settings.fine_late_major_amount, 30000);
    UPDATE shift_attendance SET
      fine_type   = 'flat_major',
      flat_fine   = v_fine_amount,
      status      = 'late_major',
      resolved_by = p_admin_id,
      resolved_at = NOW()
    WHERE id = p_attendance_id;
    -- Tidak set late_fine_active — denda flat tidak dipotong per order
  END IF;

  RETURN jsonb_build_object('success', true, 'fine_amount', v_fine_amount);
END;
$$;
```

### 4.4 Denda Per-Order di `complete_order`

```sql
-- Bagian relevan di dalam complete_order
DECLARE
  v_fine_deducted BIGINT := 0;
BEGIN
  -- ... kalkulasi v_courier_earning ...

  -- Cek denda per-order aktif
  IF v_order.courier_id IS NOT NULL AND
     (SELECT late_fine_active FROM profiles WHERE id = v_order.courier_id) THEN
    v_fine_deducted := (
      SELECT COALESCE(fine_late_minor_amount, 1000)
      FROM settings WHERE id = 'global'
    );
    -- Pastikan tidak negatif
    v_courier_earning := GREATEST(0, v_courier_earning - v_fine_deducted);
  END IF;

  -- ... tambah biaya titik/beban ...

  UPDATE public.orders SET
    -- ... kolom lain ...
    fine_deducted = v_fine_deducted    -- snapshot untuk laporan
  WHERE id = p_order_id;

  UPDATE public.profiles SET
    unpaid_amount = COALESCE(unpaid_amount, 0) + v_courier_earning,
    cancel_count  = 0,
    is_priority_recovery = false
    -- late_fine_active TIDAK di-reset di sini (tetap aktif sepanjang hari)
  WHERE id = v_order.courier_id;
END;
```

**Penting:** `late_fine_active` hanya di-reset oleh Edge Function cron tengah malam (`reset_daily_fine_flags`), bukan saat order selesai.

### 4.5 Reverse Denda

```sql
CREATE OR REPLACE FUNCTION public.cancel_attendance_fine(
  p_attendance_id UUID,
  p_admin_id      UUID,
  p_reason        TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_courier_id UUID;
  v_fine_type  TEXT;
BEGIN
  SELECT courier_id, fine_type INTO v_courier_id, v_fine_type
  FROM shift_attendance WHERE id = p_attendance_id;

  UPDATE shift_attendance SET
    flat_fine_status = 'cancelled',
    cancelled_by     = p_admin_id,
    cancelled_at     = NOW(),
    cancel_reason    = p_reason
  WHERE id = p_attendance_id;

  -- Jika per_order, matikan flag
  IF v_fine_type = 'per_order' THEN
    UPDATE profiles SET late_fine_active = false WHERE id = v_courier_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;
```

### 4.6 Skenario Denda Lengkap

```
Skenario: Andi terlambat 30 menit (Shift A, mulai 06:00, Andi ON jam 06:30)

1. record_courier_checkin() dipanggil:
   → late_minutes = 30, status = 'late', fine_type = NULL

2. Dashboard admin: "Andi terlambat 30 menit — WAITING REVIEW"
   Admin menelepon Andi, ternyata ban bocor → pilih "Maafkan"
   → excuse_attendance() dipanggil
   → status = 'excused', late_fine_active tetap false
   → Tidak ada denda

---

Skenario: Budi terlambat 90 menit (Shift A, ON jam 07:30)

1. record_courier_checkin(): late_minutes = 90, status = 'late'
2. Admin klik "Apply Denda" (sistem otomatis pilih flat_major karena >60 menit)
   → apply_attendance_fine(id, 'flat_major', admin_id)
   → flat_fine = 30000, status = 'late_major'
   → late_fine_active TIDAK diubah (denda flat, bukan per-order)
3. Budi mengantar 5 order hari itu → komisi normal, tidak ada potongan per-order
4. Saat settlement: Rp 30.000 dipotong dari total setoran Budi

---

Skenario: Cici terlambat 45 menit, admin apply denda per-order

1. record_courier_checkin(): late_minutes = 45, status = 'late'
2. Admin klik "Apply Denda" → per_order (karena <60 menit)
   → apply_attendance_fine(id, 'per_order', admin_id)
   → fine_per_order = 1000, status = 'late_minor'
   → late_fine_active = TRUE di profil Cici
3. Setiap order Cici selesai:
   → complete_order cek late_fine_active = true
   → potong Rp 1.000 dari komisi
   → fine_deducted = 1000 tersimpan di tabel orders
4. Tengah malam: reset_daily_fine_flags() → late_fine_active Cici = false
5. Saat settlement: denda per-order sudah terpotong dari unpaid_amount
   → tidak perlu dipotong lagi
```

---

## 5. Sistem Settlement (Penagihan)

### 5.1 Alur Settlement

```
Admin Finance buka FinancePenagihan.tsx
│
├─ Sistem tampilkan semua kurir dengan:
│  ├─ Total order delivered (unpaid)
│  ├─ Komisi per order (dari applied_admin_fee — SNAPSHOT, bukan kalkulasi ulang)
│  └─ Denda flat yang belum dibayar (dari shift_attendance)
│
├─ Admin pilih kurir dan order yang akan diselesaikan
│
├─ Modal konfirmasi menampilkan:
│  ├─ Total komisi order
│  ├─ Total denda flat (alpha + late_major)
│  └─ Grand total yang harus disetor kurir
│
└─ Admin konfirmasi:
   ├─ settleOrder(orderId) → UPDATE orders SET payment_status='paid'
   └─ settle_attendance_fine(attendanceId) → UPDATE flat_fine_status='paid'
```

### 5.2 Helper `getAdminEarning` (Anti-Drift)

```typescript
// src/pages/finance/FinancePenagihan.tsx
const getAdminEarning = (order: Order) => {
  // Prioritaskan snapshot yang disimpan saat order selesai
  // Ini mencegah drift jika commission_rate diubah setelah order selesai
  if (order.applied_admin_fee !== undefined && order.applied_admin_fee !== null) {
    return order.applied_admin_fee;
  }
  // Fallback ke kalkulasi live (untuk order lama sebelum kolom ada)
  return calcAdminEarning(order, earningSettings);
};
```

### 5.3 Kolom `fine_deducted` di Tabel Orders

```sql
-- Snapshot denda per-order yang sudah dipotong
-- Diisi saat complete_order dipanggil
fine_deducted INT DEFAULT 0
```

**Penting untuk settlement:** Denda per-order (`fine_deducted`) **sudah** dipotong dari `unpaid_amount`. Jangan dipotong lagi saat settlement. Hanya tampilkan sebagai informasi rincian.

---

## 6. Warning Dashboard Kehadiran

### 6.1 Store: `useAdminAttendanceStore`

```typescript
// src/stores/useAdminAttendanceStore.ts
interface MissingCourier {
  courier_id: string;
  courier_name: string;
  shift_id: string;
  shift_name: string;
  shift_start_time: string;
  minutes_late: number;
}

// fetchTodayLogs — ambil yang sudah check-in
fetchTodayLogs: async () => {
  // Reset harian (fallback jika Edge Function belum jalan)
  const lastReset = localStorage.getItem('last_fine_reset');
  const todayStr = new Date().toISOString().split('T')[0];
  if (lastReset !== todayStr) {
    await supabase.rpc('reset_daily_fine_flags');
    localStorage.setItem('last_fine_reset', todayStr);
  }
  // ... fetch dari shift_attendance ...
},

// fetchMissingCouriers — ambil yang belum check-in
fetchMissingCouriers: async () => {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase.rpc('get_missing_couriers', { p_date: today });
  if (data) set({ missingCouriers: data });
},

// Realtime subscription
subscribeToday: () => {
  const channel = supabase
    .channel('attendance-today')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'shift_attendance',
      filter: `date=eq.${new Date().toISOString().split('T')[0]}`, // filter tanggal!
    }, () => {
      get().fetchTodayLogs();
      get().fetchMissingCouriers();
    })
    .subscribe();
  return () => supabase.removeChannel(channel);
},
```

### 6.2 RPC: `get_missing_couriers`

**Fungsi ini mengembalikan daftar kurir yang belum check-in dan sudah terlambat.**

**Fitur:**
- ✅ Support shift permanen (dari `profiles.shift_id`)
- ✅ Support shift override/tukar shift (dari `shift_overrides`)
- ✅ Exclude kurir yang hari libur reguler (`profiles.day_off`)
- ✅ Exclude kurir yang di-override (diganti/diliburkan)
- ✅ Include kurir pengganti yang belum hadir

```sql
CREATE OR REPLACE FUNCTION get_missing_couriers(p_date DATE)
RETURNS TABLE (
  courier_id   UUID,
  courier_name TEXT,
  shift_id     UUID,
  shift_name   TEXT,
  shift_start  TIME,
  late_minutes INT
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timezone  TEXT;
  v_now_local TIMESTAMPTZ;
BEGIN
  SELECT operational_timezone INTO v_timezone FROM settings WHERE id = 'global';
  v_timezone  := COALESCE(v_timezone, 'Asia/Makassar');
  v_now_local := NOW() AT TIME ZONE v_timezone;

  RETURN QUERY

  -- Kurir dengan shift PERMANEN yang belum hadir
  SELECT
    p.id,
    p.name,
    s.id,
    s.name,
    s.start_time,
    GREATEST(0, EXTRACT(EPOCH FROM (
      v_now_local - (p_date + s.start_time)::TIMESTAMPTZ
    )) / 60)::INT
  FROM profiles p
  JOIN shifts s ON s.id = p.shift_id
  WHERE p.role = 'courier'
    AND p.is_active = true
    AND s.is_active = true
    AND v_now_local > (p_date + s.start_time)::TIMESTAMPTZ
    AND NOT EXISTS (
      SELECT 1 FROM shift_attendance sa
      WHERE sa.courier_id = p.id
        AND sa.date = p_date
    )
    AND NOT (p.day_off = TRIM(TO_CHAR(p_date, 'Day')))
    -- Exclude kurir yang di-override (diganti/diliburkan) di tanggal ini
    AND NOT EXISTS (
      SELECT 1 FROM shift_overrides so
      WHERE so.original_courier_id = p.id
        AND so.date = p_date
    )

  UNION ALL

  -- Kurir PENGGANTI (replacement) yang belum hadir di shift override-nya
  SELECT
    p.id,
    p.name,
    s.id,
    s.name,
    s.start_time,
    GREATEST(0, EXTRACT(EPOCH FROM (
      v_now_local - (p_date + s.start_time)::TIMESTAMPTZ
    )) / 60)::INT
  FROM shift_overrides so
  JOIN profiles p ON p.id = so.replacement_courier_id
  JOIN shifts s ON s.id = so.original_shift_id
  WHERE so.date = p_date
    AND p.is_active = true
    AND s.is_active = true
    AND v_now_local > (p_date + s.start_time)::TIMESTAMPTZ
    AND NOT EXISTS (
      SELECT 1 FROM shift_attendance sa
      WHERE sa.courier_id = p.id
        AND sa.date = p_date
    );
END;
$$;
```

**Catatan Penting:**
- Kolom `profiles.day_off` menyimpan hari libur reguler kurir (format: 'Monday', 'Tuesday', dst)
- Tabel `shift_overrides` menyimpan tukar shift antar kurir
- Fungsi ini dipanggil oleh `AttendanceMonitoring.tsx` untuk menampilkan warning kurir terlambat

### 6.3 UI Warning (AttendanceMonitoring.tsx)

```
Komponen warning menampilkan dua level:

🔴 KRITIS — Belum check-in >60 menit
   → Background merah, badge "X kurir"
   → Kartu per kurir: nama, shift, menit terlambat

🟡 WARNING — Belum check-in 1-60 menit
   → Background amber, badge "X kurir"
   → Kartu per kurir: nama, shift, menit terlambat

Di tabel bawah (yang sudah check-in):
   Tombol "APPLY DENDA" → hanya muncul jika status='late' AND fine_type=NULL
   Tombol "MAAFKAN"     → hanya muncul jika status='late' AND fine_type=NULL
   
   Tombol auto-pilih jenis denda:
   minutes_late >= 60 → flat_major
   minutes_late < 60  → per_order
```

---

## 7. GPS STAY Monitoring

### 7.1 Arsitektur

```
Kurir buka aplikasi Android
│
├─ Scan QR Code di basecamp
│  → StayQRDisplay.tsx (admin) generate QR rotating 5 menit, single-use
│  → QRScannerModal.tsx (kurir) scan QR
│  → supabase.rpc('verify_stay_qr', {p_token, p_courier_id})
│  → Jika valid: courier_status = 'stay', stay_basecamp_id = basecamp_id
│
└─ Android Foreground Service aktif (StayMonitoringService.kt)
   ├─ Interval: 1 menit sekali
   ├─ Panggil Geolocation.getCurrentPosition()
   ├─ Bandingkan dengan koordinat basecamp
   ├─ Jika di luar radius + accuracy > 50m → buang pembacaan
   ├─ Counter konsensus: 5x berturut-turut di luar radius
   └─ Setelah 5x → revoke_stay_by_service() → courier_status = 'on'
```

### 7.2 Parameter GPS

| Parameter | Nilai | Alasan |
|-----------|-------|--------|
| Interval cek | 1 menit | Efisien, cukup responsif |
| Radius efektif | 10 meter | Sesuai akurasi GPS di basecamp |
| Max accuracy diterima | 50 meter | Tolerance untuk HP low-end |
| Konsensus sebelum cabut STAY | 5x berturut-turut | ~5 menit, prevent false positive |
| QR expire | 5 menit | Anti-screenshot |
| QR single-use | Ya | Setelah scan, token `is_used=true` |

### 7.3 Struktur Tabel GPS STAY

```sql
-- Master data basecamp (multi-basecamp ready)
CREATE TABLE basecamps (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT,
  address      TEXT,
  lat          NUMERIC,    -- ✅ VERIFIED: nama kolom 'lat' (bukan 'latitude')
  lng          NUMERIC,    -- ✅ VERIFIED: nama kolom 'lng' (bukan 'longitude')
  radius_m     INTEGER,    -- ✅ VERIFIED: nama kolom 'radius_m' (bukan 'radius_meters')
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ✅ STATUS (2026-05-03): 1 basecamp exists in production database

-- Token QR untuk verifikasi STAY
CREATE TABLE stay_qr_tokens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  basecamp_id       UUID REFERENCES basecamps(id),
  token             TEXT UNIQUE NOT NULL,
  created_by        UUID REFERENCES profiles(id),
  expires_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  is_used           BOOLEAN DEFAULT false,
  used_by_courier_id UUID REFERENCES profiles(id),
  used_at           TIMESTAMPTZ
);

-- Log scan STAY
CREATE TABLE stay_attendance_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id    UUID REFERENCES profiles(id),
  courier_name  TEXT,
  token_id      UUID REFERENCES stay_qr_tokens(id),
  verified_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Log event GPS (auto-revoke, dll)
CREATE TABLE attendance_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id  UUID NOT NULL REFERENCES profiles(id),
  event_type  TEXT NOT NULL,    -- 'stay_auto_revoked', 'check_in', 'check_out'
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**Kolom GPS STAY di tabel `profiles`:**
```sql
stay_basecamp_id    UUID REFERENCES basecamps(id)  -- basecamp aktif saat STAY
gps_consecutive_out INT DEFAULT 0                  -- counter keluar berturut-turut
```

### 7.4 RPC: `verify_stay_qr`

```sql
-- Signature yang benar:
verify_stay_qr(p_token TEXT, p_courier_id UUID)

-- Implementasi:
CREATE OR REPLACE FUNCTION public.verify_stay_qr(p_token TEXT, p_courier_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_token_row stay_qr_tokens%ROWTYPE;
BEGIN
  SELECT * INTO v_token_row
  FROM stay_qr_tokens
  WHERE token = p_token AND is_used = false AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Token tidak valid atau sudah kadaluarsa');
  END IF;

  -- Mark token sebagai used (single-use)
  UPDATE stay_qr_tokens
  SET is_used = true, used_by_courier_id = p_courier_id, used_at = NOW()
  WHERE token = p_token;

  -- Update status kurir ke STAY
  UPDATE profiles
  SET courier_status   = 'stay',
      stay_basecamp_id = v_token_row.basecamp_id,
      gps_consecutive_out = 0
  WHERE id = p_courier_id;

  INSERT INTO stay_attendance_logs (courier_id, basecamp_id, qr_token_used)
  VALUES (p_courier_id, v_token_row.basecamp_id, p_token);

  RETURN jsonb_build_object('success', true, 'basecamp_id', v_token_row.basecamp_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 7.5 QR Code Management (StayQRDisplay.tsx)

```typescript
// Auto-generate QR baru setiap 5 menit
const QR_EXPIRY_MINUTES = 5;

// Setelah kurir scan → realtime event → generate QR baru otomatis
const channel = supabase
  .channel('stay-attendance-events')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'stay_attendance_logs',
  }, () => {
    fetchTodayLogs();
    setTimeout(() => generateNewToken(), 100); // delay kecil untuk pastikan token sudah diproses
  })
  .subscribe();
```

---

## 8. Struktur Database Lengkap

### 8.1 Tabel `profiles` (kolom kritis)

```sql
-- Antrian
queue_joined_at      TIMESTAMPTZ    -- posisi FIFO (NULL = tidak dalam antrian)
is_priority_recovery BOOLEAN        -- tier 1 flag
cancel_count         INT DEFAULT 0  -- counter cancel berturut

-- Status
courier_status       TEXT           -- 'on' | 'stay' | 'off' (SUMBER KEBENARAN)
is_online            BOOLEAN        -- mirror dari courier_status (auto via trigger)
is_active            BOOLEAN        -- suspend/aktif

-- Shift & Denda
shift_id             UUID           -- FK ke shifts
day_off              TEXT           -- Hari libur reguler kurir (format: 'Monday', 'Tuesday', dst)
                                    -- NULL = tidak ada hari libur reguler
                                    -- Dipakai oleh get_missing_couriers untuk exclude kurir di hari liburnya
late_fine_active     BOOLEAN        -- denda per-order aktif hari ini
permit_count_no_swap INT DEFAULT 0  -- counter izin tanpa pengganti

-- GPS STAY
stay_basecamp_id     UUID           -- ✅ RENAMED from current_basecamp_id (2026-05-03)
gps_consecutive_out  INT DEFAULT 0  -- ✅ RENAMED from stay_zone_counter (2026-05-03)
                                    -- CHECK constraint: (gps_consecutive_out >= 0 AND gps_consecutive_out <= 5)

-- Keuangan
unpaid_amount        BIGINT         -- saldo belum disetor
unpaid_count         INT            -- jumlah order belum disetor
total_deliveries_alltime INT
total_earnings_alltime   BIGINT
```

### 8.2 Tabel `orders` (kolom kritis)

```sql
status               TEXT           -- 'pending'|'assigned'|'picked_up'|'in_transit'|'delivered'|'cancelled'
courier_id           UUID
assigned_at          TIMESTAMPTZ
assigned_by          UUID
payment_status       TEXT           -- 'unpaid' | 'paid'

-- Snapshot komisi (anti-drift)
applied_commission_rate      INT
applied_commission_threshold INT
applied_commission_type      TEXT
applied_admin_fee            INT    -- SNAPSHOT — jangan hitung ulang dari settings

-- Denda
fine_deducted        INT DEFAULT 0  -- denda per-order yang sudah dipotong
queue_position_at_assign INT        -- posisi tier kurir saat di-assign (audit)
```

### 8.3 Tabel `settings` (id='global')

```sql
commission_rate          INT     DEFAULT 80
commission_threshold     INT     DEFAULT 5000
commission_type          VARCHAR DEFAULT 'percentage'
operational_area         TEXT    DEFAULT 'Sengkang, Wajo'
operational_timezone     TEXT    DEFAULT 'Asia/Jakarta'  -- ✅ ADDED 2026-05-03
courier_instructions     JSONB   DEFAULT '[]'

-- Parameter denda (ditambahkan sesi ini)
fine_late_minor_amount   INT     DEFAULT 1000
fine_late_major_minutes  INT     DEFAULT 60
fine_late_major_amount   INT     DEFAULT 30000
fine_alpha_amount        INT     DEFAULT 50000
billing_start_day        INT     DEFAULT 1
radius_m                 INT     DEFAULT 10  -- ✅ RENAMED from stay_radius_meters (2026-05-03)
```

---

## 9. Daftar Semua RPC & Fungsi Database

| Nama Fungsi | Tujuan | Dipanggil Dari |
|-------------|--------|----------------|
| `handle_courier_queue_sync` | Trigger: antrian + mirror is_online | DB trigger otomatis |
| `handle_order_cancellation_priority` | Trigger: set tier 1 saat cancel | DB trigger otomatis |
| `check_profile_update_permission` | Trigger: blokir kurir ubah kolom sensitif | DB trigger otomatis |
| `rotate_courier_queue` | Pindahkan kurir ke belakang antrian | `assign_order_and_rotate` |
| `assign_order_and_rotate` | Atomic: assign + rotate | `Orders.tsx` |
| `complete_order` | Selesaikan order + kalkulasi komisi + potong denda | `useOrderStore.ts` |
| `record_courier_checkin` | Catat kehadiran kurir | `useCourierStore.ts` |
| `apply_attendance_fine` | Admin apply denda | `useAdminAttendanceStore.ts` |
| `excuse_attendance` | Admin maafkan keterlambatan | `useAdminAttendanceStore.ts` |
| `reset_daily_fine_flags` | Reset late_fine_active semua kurir | Edge Function cron |
| `process_shift_alpha` | Deteksi dan catat kurir alpha | Edge Function cron |
| `get_missing_couriers` | Ambil kurir belum check-in | `useAdminAttendanceStore.ts` |
| `get_courier_fines` | Ambil denda flat per kurir per periode | `FinancePenagihan.tsx` |
| `cancel_attendance_fine` | Reverse denda | Admin UI |
| `settle_attendance_fine` | Mark denda sebagai paid | `FinancePenagihan.tsx` |
| `verify_stay_qr` | Validasi QR STAY | `useCourierStore.ts` |
| `revoke_stay_by_service` | Cabut STAY dari Android service | Native Android |
| `update_stay_counter` | Update counter GPS (2 overloads) | Android native |

---

## 10. Daftar Semua File Frontend

| File | Perubahan di Sesi Ini |
|------|----------------------|
| `src/pages/Orders.tsx` | Sorting 5-tier + tiebreaker timestamp + panggil `assign_order_and_rotate` |
| `src/pages/Couriers.tsx` | Tambah dropdown shift di form add kurir |
| `src/pages/admin/AttendanceMonitoring.tsx` | Warning dashboard baru (missing + late) |
| `src/pages/admin/Shifts.tsx` | UI CRUD shift (baru) |
| `src/pages/finance/FinancePenagihan.tsx` | `getAdminEarning`, denda flat di settlement |
| `src/components/settings/BusinessTab.tsx` | UI parameter denda |
| `src/components/settings/GeneralOpsTab.tsx` | ✅ UPDATED: Basecamp CRUD + Holiday management (2026-05-03) |
| `src/pages/Settings.tsx` | Sync fine fields ke DB |
| `src/stores/useCourierStore.ts` | Hapus `rotateQueue`, tambah `record_courier_checkin` |
| `src/stores/useOrderStore.ts` | Hapus `assignCourier` (diganti RPC atomic) |
| `src/stores/useSettingsStore.ts` | Tambah fine fields + `billing_start_day` |
| `src/stores/useShiftStore.ts` | Store baru untuk CRUD shift |
| `src/stores/useAdminAttendanceStore.ts` | Store baru: logs, missing, subscribe, apply/excuse |
| `src/stores/useAttendanceStore.ts` | Store kurir untuk history kehadiran sendiri |
| `src/hooks/useStayMonitor.ts` | Hook GPS STAY (dibangun sesi lain, terverifikasi) |
| `src/lib/stayMonitoring.ts` | Bridge ke Android native service |
| `src/components/admin/StayQRDisplay.tsx` | QR rotating + realtime log scan |
| `src/types/index.ts` | Tambah `fine_deducted`, `queue_joined_at`, dll + ✅ UPDATED: Basecamp interface (2026-05-03) |
| `src/types/supabase.ts` | ✅ UPDATED: basecamps & settings table types (2026-05-03) |
| `src/stores/useCourierStore.ts` | ✅ UPDATED: BasecampRow interface + queries (2026-05-03) |
| `src/stores/useSettingsStore.ts` | ✅ UPDATED: Basecamp interface (2026-05-03) |
| `src/hooks/useStayMonitor.ts` | ✅ UPDATED: BasecampRow interface + queries (2026-05-03) |
| `supabase/functions/process-alpha/index.ts` | Edge Function cron: reset flags + deteksi alpha |

---

## 11. Keputusan Desain & Constraint

### Yang Sudah Final — JANGAN Diubah Tanpa Diskusi

```
1. FIFO berbasis timestamp (queue_joined_at), BUKAN integer queue_position
   Alasan: O(1) vs O(n), tidak ada shifting massal saat kurir keluar

2. Tier 2 (STAY): reset queue_joined_at saat transisi ON↔STAY
   Alasan: datang ke basecamp harus diapresiasi dengan posisi baru

3. Denda TIDAK otomatis — admin yang memutuskan apply atau maafkan
   Alasan: memberi ruang pertimbangan manusiawi, mencegah ketidakadilan

4. late_fine_active TIDAK di-reset saat order selesai
   Alasan: denda berlaku sepanjang hari shift, bukan hanya per order

5. GPS accuracy threshold: 50 meter (BUKAN 15)
   Alasan: 15 meter terlalu ketat untuk HP low-end, banyak pembacaan terbuang

6. GPS konsensus: 5x berturut-turut (~5 menit) sebelum cabut STAY
   Alasan: prevent false positive dari noise GPS sementara

7. Timezone semua RPC dari settings.operational_timezone
   Alasan: fleksibel untuk bisnis di timezone berbeda

8. assign_order_and_rotate adalah ATOMIC dalam 1 RPC
   Alasan: mencegah state setengah jalan (order assigned tapi kurir tidak dirotasi)

9. Kolom basecamps: lat, lng, radius_m (BUKAN latitude/longitude/radius_meters)
   Alasan: sudah ada data dan kode yang menggunakan nama ini
   Status: ✅ VERIFIED database + frontend (2026-05-03)

10. verify_stay_qr signature: (p_token TEXT, p_courier_id UUID)
    Alasan: versi final setelah QA audit, parameter lat/lng dihapus
    Status: ✅ VERIFIED only correct signature exists (2026-05-03)
```

### Yang Ditolak — Alasan

| Proposal | Ditolak Karena |
|----------|----------------|
| Denda dijatuhkan otomatis oleh sistem | Tidak memberi ruang keputusan admin |
| GPS threshold 15 meter | Terlalu ketat, banyak HP low-end tidak memenuhi |
| Queue berbasis integer | O(n) — tidak skalabel untuk ratusan kurir |
| Deteksi keterlambatan dari trigger antrian | Trigger harus ringan; logika absensi kompleks harus terpisah |
| `late_fine_active` di-reset tiap order selesai | Denda per-order harusnya aktif sepanjang hari |

---

## 12. Item Pre-Deployment

### ✅ Kritis — SUDAH DIFIX (2026-05-03)

| # | Issue | Status | Tanggal Fix |
|---|-------|--------|-------------|
| 1 | `complete_order` tidak validasi `late_fine_active` relevan untuk hari ini | ✅ FIXED | 2026-05-03 |
| 2 | `process_shift_alpha` tidak handle Shift D (overnight) dengan benar | ✅ FIXED | 2026-04-29 |
| 3 | Tabel `basecamps` kosong | ✅ FIXED | 2026-05-03 (1 basecamp exists) |
| 4 | Kolom database tidak sesuai dokumentasi | ✅ FIXED | 2026-05-03 (migration applied) |
| 5 | Frontend menggunakan nama kolom lama | ✅ FIXED | 2026-05-03 (46 changes applied) |

### 🟠 Penting — SUDAH DIFIX (2026-05-03)

| # | Issue | Status | Tanggal Fix |
|---|-------|--------|-------------|
| 6 | `get_missing_couriers` tidak cek `shift_overrides` | ✅ FIXED | 2026-05-03 |
| 7 | `get_missing_couriers` tidak cek `day_off` | ✅ FIXED | 2026-05-03 |
| 8 | `record_courier_checkin` INSERT pakai `CURRENT_DATE` bukan tanggal lokal | ✅ FIXED | 2026-05-03 |
| 9 | `settings.operational_timezone` column missing | ✅ FIXED | 2026-05-03 |
| 10 | `profiles.day_off` column missing | ✅ FIXED | 2026-05-03 |
| 11 | Old `verify_stay_qr` function signature exists | ✅ FIXED | 2026-05-03 |

### 🟢 Minor — Status Update (2026-05-03)

| # | Item | Status |
|---|------|--------|
| 12 | UI untuk CRUD basecamps | ✅ DONE (GeneralOpsTab.tsx) |
| 13 | UI untuk menetapkan hari libur | ✅ DONE (GeneralOpsTab.tsx) |
| 14 | UI untuk tukar shift (shift_overrides) | ⏳ TODO |
| 15 | Notifikasi ke kurir saat STAY dicabut otomatis | ⏳ TODO |
| 16 | Pagination di semua halaman list | ⏳ TODO |
| 17 | Retry mechanism di Edge Function process-alpha | ⏳ TODO |
| 18 | UI untuk melihat tier_change_log (debug antrian) | ⏳ TODO |

---

## 13. Changelog & Verification History

### 2026-05-03: Database Schema Verification & Frontend Sync

**Database Changes Applied:**
- ✅ Migration: `20260503_fix_column_names_and_add_missing_columns.sql`
- ✅ Renamed: `basecamps.stay_radius_meters` → `basecamps.radius_m`
- ✅ Renamed: `profiles.current_basecamp_id` → `profiles.stay_basecamp_id`
- ✅ Renamed: `profiles.stay_zone_counter` → `profiles.gps_consecutive_out`
- ✅ Added: `settings.operational_timezone` (value: 'Asia/Makassar')
- ✅ Added: `profiles.day_off` (for regular day off tracking)
- ✅ Dropped: Old `verify_stay_qr(uuid, text, numeric, numeric)` signature

**Frontend Changes Applied:**
- ✅ Updated 6 files, 46 replacements total
- ✅ All TypeScript types synchronized with database schema
- ✅ Build verification: PASSED (no compilation errors)
- ✅ Verification: No old column names remain (excluding external APIs)

**Documentation:**
- ✅ `temp/Database_Verification_Checklist.md` - Complete verification with before/after tables
- ✅ `temp/Database_Verification_Report.md` - Detailed comparison results
- ✅ `temp/Function_Comparison_Report.md` - RPC function verification
- ✅ `temp/Frontend_Column_Rename_Diff.md` - Complete diff of all changes
- ✅ `temp/Frontend_Column_Rename_Applied.md` - Application summary

**Status:** Database and frontend are now 100% synchronized and match technical documentation.

---

*Dokumen ini merepresentasikan state sistem pada 3 Mei 2026.*  
*Terakhir diverifikasi: 2026-05-03*  
*Database: bunycotovavltxmutier (Supabase)*  

*Untuk pertanyaan teknis, rujuk ke masing-masing RPC source di database dengan query:*  
```sql
SELECT proname, prosrc FROM pg_proc WHERE proname = '[nama_fungsi]';
```
