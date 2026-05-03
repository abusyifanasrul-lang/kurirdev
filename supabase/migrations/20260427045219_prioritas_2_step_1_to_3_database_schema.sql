-- STEP 1: Tabel Shift & Kehadiran

-- Tabel kelompok shift
CREATE TABLE IF NOT EXISTS shifts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,        -- 'Shift A', 'Shift B', dll
  start_time   TIME NOT NULL,        -- '06:00'
  end_time     TIME NOT NULL,        -- '17:00'
  is_overnight BOOLEAN DEFAULT false, -- true untuk shift yang melintas tengah malam
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Seed 4 shift awal
INSERT INTO shifts (name, start_time, end_time, is_overnight) 
SELECT * FROM (VALUES
  ('Shift A', '06:00'::TIME, '17:00'::TIME, false),
  ('Shift B', '07:00'::TIME, '17:30'::TIME, false),
  ('Shift C', '10:00'::TIME, '22:00'::TIME, false),
  ('Shift D', '18:45'::TIME, '06:00'::TIME, true)
) AS t(name, start_time, end_time, is_overnight)
WHERE NOT EXISTS (SELECT 1 FROM shifts WHERE name = t.name);

-- Assignment kurir ke shift (permanen, jarang berubah)
CREATE TABLE IF NOT EXISTS courier_shifts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shift_id       UUID NOT NULL REFERENCES shifts(id),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to   DATE,               -- NULL = berlaku selamanya
  UNIQUE(courier_id, effective_from)
);

-- Override tukar shift per tanggal (tidak permanen)
CREATE TABLE IF NOT EXISTS shift_overrides (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                   DATE NOT NULL,
  original_courier_id    UUID NOT NULL REFERENCES profiles(id),
  replacement_courier_id UUID NOT NULL REFERENCES profiles(id),
  original_shift_id      UUID NOT NULL REFERENCES shifts(id),
  created_by             UUID REFERENCES profiles(id),
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- Catatan kehadiran & denda harian
CREATE TABLE IF NOT EXISTS shift_attendance (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id        UUID NOT NULL REFERENCES profiles(id),
  shift_id          UUID NOT NULL REFERENCES shifts(id),
  date              DATE NOT NULL,           -- tanggal mulai shift (referensi)
  first_online_at   TIMESTAMPTZ,             -- kapan pertama kali ON
  late_minutes      INT DEFAULT 0,
  status            TEXT DEFAULT 'on_time',  
    -- 'on_time' | 'late_minor' | 'late_major' | 'alpha' | 'excused'
  fine_type         TEXT,                    
    -- 'per_order' | 'flat_major' | 'flat_alpha' | NULL
  fine_per_order    INT DEFAULT 0,           -- snapshot besaran denda/order saat itu
  flat_fine         INT DEFAULT 0,           -- denda flat jika berlaku
  flat_fine_status  TEXT DEFAULT 'active',   -- 'active' | 'cancelled'
  cancelled_by      UUID REFERENCES profiles(id),
  cancelled_at      TIMESTAMPTZ,
  cancel_reason     TEXT,
  resolved_by       UUID REFERENCES profiles(id),
  resolved_at       TIMESTAMPTZ,
  notes             TEXT,
  UNIQUE(courier_id, date)
);

-- Hari libur
CREATE TABLE IF NOT EXISTS holidays (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  is_national BOOLEAN DEFAULT true,  -- rekomendasi dari sistem
  is_active   BOOLEAN DEFAULT false, -- ditetapkan aktif oleh owner
  set_by      UUID REFERENCES profiles(id),
  set_at      TIMESTAMPTZ
);

-- STEP 2: Tambah Kolom ke Tabel settings

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS fine_late_minor_amount   INT DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS fine_late_major_minutes  INT DEFAULT 60,
  ADD COLUMN IF NOT EXISTS fine_late_major_amount   INT DEFAULT 30000,
  ADD COLUMN IF NOT EXISTS fine_alpha_amount        INT DEFAULT 50000,
  ADD COLUMN IF NOT EXISTS billing_start_day        INT DEFAULT 1;

-- Update row global dengan nilai default
UPDATE settings SET
  fine_late_minor_amount  = 1000,
  fine_late_major_minutes = 60,
  fine_late_major_amount  = 30000,
  fine_alpha_amount       = 50000,
  billing_start_day       = 1
WHERE id = 'global';

-- STEP 3: Tambah Kolom ke profiles

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES shifts(id),
  ADD COLUMN IF NOT EXISTS late_fine_active BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS permit_count_no_swap INT DEFAULT 0;

-- Tambah kolom fine_deducted ke orders (diperlukan untuk Step 4)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fine_deducted INT DEFAULT 0;;
