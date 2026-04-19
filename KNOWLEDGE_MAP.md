
## Session Update: 2026-04-16 22:13:56
- **Type**: auto_harvest
- **Desc**: Changes detected via git diff. Overwritten potential functions: 3
- **Files**: `b/src/stores/useCustomerStore.ts, b/src/stores/useOrderStore.ts, b/src/components/layout/Layout.tsx, b/src/stores/useSettingsStore.ts, b/src/stores/useNotificationStore.ts, b/src/hooks/useRealtimeHealth.ts, b/src/stores/useUserStore.ts`
- **Overwrites**: `const joined = channels.filter((c) => c.status === 'joined').length;, const joining = channels.filter((c) => c.status === 'joining').length;, const errored = channels.filter((c) => c.status === 'errored' || c.status === 'closed').length;`
---
- **Type**: legacy_backfill
- **Desc**: --- WALKTHROUGH ---
# Walkthrough - Enhanced Maintenance Security


## Session Update: 2026-04-20 03:43:36
- **Type**: auto_harvest
- **Desc**: Changes detected via git diff. Overwritten potential functions: 0
- **Files**: `b/KNOWLEDGE_MAP.md`
---
- **Type**: auto_harvest
- **Desc**: Changes detected via git diff. Overwritten potential functions: 16
- **Files**: `b/KNOWLEDGE_MAP.md`
- **Overwrites**: `- **Overwrites**: `const joined = channels.filter((c) => c.status === 'joined').length;, const joining = channels.filter((c) => c.status === 'joining').length;, const errored = channels.filter((c) => c.status === 'errored' || c.status === 'closed').length;`, - **Overwrites**: `const logout = useCallback(async () => {, setTimeout(async () => {, keysToRemove.forEach(key => localStorage.removeItem(key));, supabase.auth.onAuthStateChange((event) => {`, - **Overwrites**: `const logout = useCallback(async () => {, setTimeout(async () => {, keysToRemove.forEach(key => localStorage.removeItem(key));, supabase.auth.onAuthStateChange((event) => {`, - **Overwrites**: `const logout = useCallback(async () => {, setTimeout(async () => {, keysToRemove.forEach(key => localStorage.removeItem(key));, supabase.auth.onAuthStateChange((event) => {`, - **Overwrites**: `const joined = channels.filter((c) => c.status === 'joined').length;, const joining = channels.filter((c) => c.status === 'joining').length;, const errored = channels.filter((c) => c.status === 'errored' || c.status === 'closed').length;`, - **Overwrites**: `const joined = channels.filter((c) => c.status === 'joined').length;, const joining = channels.filter((c) => c.status === 'joining').length;, const errored = channels.filter((c) => c.status === 'errored' || c.status === 'closed').length;`, - **Overwrites**: `const logout = useCallback(async () => {, setTimeout(async () => {, keysToRemove.forEach(key => localStorage.removeItem(key));, supabase.auth.onAuthStateChange((event) => {`, - **Overwrites**: `const logout = useCallback(async () => {, setTimeout(async () => {, keysToRemove.forEach(key => localStorage.removeItem(key));, supabase.auth.onAuthStateChange((event) => {`, - **Overwrites**: `const joined = channels.filter((c) => c.status === 'joined').length;, const joining = channels.filter((c) => c.status === 'joining').length;, const errored = channels.filter((c) => c.status === 'errored' || c.status === 'closed').length;`, - **Overwrites**: `const joined = channels.filter((c) => c.status === 'joined').length;, const joining = channels.filter((c) => c.status === 'joining').length;, const errored = channels.filter((c) => c.status === 'errored' || c.status === 'closed').length;`, - **Overwrites**: `const logout = useCallback(async () => {, setTimeout(async () => {, keysToRemove.forEach(key => localStorage.removeItem(key));, supabase.auth.onAuthStateChange((event) => {`, - **Overwrites**: `const joined = channels.filter((c) => c.status === 'joined').length;, const joining = channels.filter((c) => c.status === 'joining').length;, const errored = channels.filter((c) => c.status === 'errored' || c.status === 'closed').length;`, - **Overwrites**: `const joined = channels.filter((c) => c.status === 'joined').length;, const joining = channels.filter((c) => c.status === 'joining').length;, const errored = channels.filter((c) => c.status === 'errored' || c.status === 'closed').length;`, - **Overwrites**: `const joined = channels.filter((c) => c.status === 'joined').length;, const joining = channels.filter((c) => c.status === 'joining').length;, const errored = channels.filter((c) => c.status === 'errored' || c.status === 'closed').length;`, - **Overwrites**: `const joined = channels.filter((c) => c.status === 'joined').length;, const joining = channels.filter((c) => c.status === 'joining').length;, const errored = channels.filter((c) => c.status === 'errored' || c.status === 'closed').length;`, cursor.execute("SELECT type, description, affected_files, overwritten_functions, timestamp FROM observations ORDER BY id DESC LIMIT 5")`
---
- **Type**: legacy_backfill
- **Desc**: --- WALKTHROUGH ---
# Walkthrough - Enhanced Maintenance Security

I have implemented a robust security layer for administrative maintenance actions in the Storage settings. This update ensures that high-risk operations (like database cleanup) are transparent, safe, and require explicit confirmation.

## Key Changes

### 1. Advanced Maintenance Modal
Implemented a multi-phase workflow for the **"Cleanup Dummy Orders"** action:
- **Phase 1: Analyzing**: The system scans the live database to map the exact impact before any changes occur.
- **Phase 2: Detailed Stats**: Displays a breakdown of exactly how many orders will be "Delivered" (paid) vs "Cancelled" (unpaid).
- **Phase 3: "Double-Lock" Confirmation**: Requires the user to type a specific challenge phrase ("saya mengerti") to proceed.
- **Phase 4: Feedback**: Real-time progress and a final success report.

### 2. Safety Buffer & Logic
Updated `cleanupOrders.ts` to be more conservative:
- **60-Minute Safety Buffer**: Any order created within the last hour is automatically ignored to protect active courier work.
- **Dry-Run Support**: Maintenance tools can now "Preview" impacts without touching the database.

### 3. "Danger Zone" Visuals
Redesigned the **Super Admin Maintenance** section:
- Added high-contrast "Danger Zone" styling with clear "Admin Only" labeling.
- Enhanced descriptors for "Orphaned Orders" scanning to avoid confusion.

### 4. Global Reset Protection
Updated the **"Reset & Sync"** warning in the main settings:
- Replaced the simple prompt with a detailed list of consequences (data erasure and forced logout) to prevent accidental execution.

## Verification Results

### Manual Audit Success
- [x] Cleanup Analyze phase returns correct counts.
- [x] Challenge-phrase lockout works correctly.
- [x] Recent orders ( < 60 mins ) are spared from cleanup.
- [x] Type errors in `ProfileTab` and `Settings.tsx` resolved.

> [!IMPORTANT]
> The **60-minute safety buffer** is now the default for all cleanup oper
---
- **Type**: legacy_backfill
- **Desc**: --- WALKTHROUGH ---
# Sync & UI Consistency Optimization

Berdasarkan analisis mendalam yang Anda berikan, saya telah mengoptimalkan mekanisme sinkronisasi data dan integrasi UI untuk memastikan sistem lebih resilien, efisien, dan semantik.

## Perbaikan yang Dilakukan

### 1. Resiliensi Sinkronisasi (Issue #3)
Mekanisme `fetchInitialOrders` telah direfaktorisasi menggunakan blok `try...catch...finally`. 
- **Keuntungan**: Event `indexeddb-synced` dan pembersihan status `isSyncing`/`isLoading` sekarang dipastikan berjalan meskipun terjadi error di salah satu query Supabase.
- **Dampak**: UI tidak akan menggantung dalam status "Syncing..." jika terjadi gangguan jaringan tengah jalan.

### 2. Harmonisasi Rentang Waktu (Issue #2)
Menyelaraskan kalkulasi `sevenDaysAgo` menjadi `sixDaysAgo` (`getDate() - 6`).
- **Analisis**: `T-6 + Hari Ini = 7 hari`. Ini pas dengan tampilan grafik dan histori di `CourierEarnings.tsx`.
- **Keuntungan**: Menghilangkan redundansi fetch data 1 hari yang tidak ditampilkan di UI, sehingga lebih menghemat *database reads*.

### 3. Renaming Semantik (Issue #1)
Mengganti flag `isFetchingActiveOrders` menjadi `isSyncing`.
- **Analisis**: Flag ini sekarang mencakup seluruh proses sinkronisasi (Active + Finalized), sehingga nama `isSyncing` jauh lebih akurat secara teknis.
- **Perubahan**: Seluruh referensi di `useOrderStore` dan `CourierEarnings` telah diperbarui.

### 4. Optimalisasi Admin Sync (Issue #4)
Memperbarui `needsWeeklySync` dan `saveWeeklySyncTime` di `orderCache.ts` untuk mendukung `userId` opsional.
- **Implementasi**: Jika Admin (tanpa `courierId`) melakukan sinkronisasi, sistem akan menggunakan key `'global_admin_sync'`.
- **Keuntungan**: Admin tidak lagi melakukan full-fetch 7 hari pada setiap kali aplikasi dibuka; sistem sekarang ingat kapan Admin terakhir kali melakukan sinkronisasi mingguan.

## Hasil Verifikasi

### Mekanisme Error-Handling
- [x] Event `indexeddb-synced` ter-dispatch meskipun query gagal.
- [x] Status `isSynci
---
- **Type**: legacy_backfill
- **Desc**: --- WALKTHROUGH ---
# Walkthrough: Courier Real-Time Sync Hardening

I have implemented a robust "Pulse & Re-sync" mechanism to ensure the Admin Dashboard always reflects the correct courier status, even after connection drops or idle periods.

## Changes Made

### 1. Hardened Subscriptions in [useUserStore.ts](file:///c:/Users/K4G3/Documents/GitHub/kurirdev/src/stores/useUserStore.ts)
- **Re-sync on Connect**: Both `subscribeUsers` and `subscribeProfile` now trigger a full data fetch (`fetchUsers`/`fetchProfile`) immediately upon a successful `SUBSCRIBED` event.
    - *Why?* If the connection was temporarily lost, any status changes that happened during that "gap" are now automatically pulled the moment the connection heals.
- **Improved Channel Deduplication**: Instead of just checking if a channel ID exists, we now verify the channel's internal state (`joined`/`joining`). This prevents "deadlocked" states where a dying channel might block a new one from starting.
- **Explicit Cleanup**: Added clearer logging and explicit channel removal during unsubscription.

### 2. Streamlined [AppListeners.tsx](file:///c:/Users/K4G3/Documents/GitHub/kurirdev/src/components/AppListeners.tsx)
- Consolidated the profile sync logic to use the store's primary `subscribeProfile` handler.
- Separated the security-critical "suspension check" into its own lightweight listener to ensure admins can still force-logout suspended users without overlapping with the primary profile sync.

## Verification & Monitoring

### Console Diagnostics
You can now monitor the health of these listeners in your browser's console. Look for:
- `✅ Realtime connection active: users:list. Syncing state...`
- `✅ Realtime profile sync active: <USER_ID>`
- `🧼 Cleaning up channel: ...`

### Testing Success
These changes address the "Dead Listener" symptom by ensuring the application doesn't just wait for events, but actively reconciles its state every time the real-time link is established or restored.

> [!TIP]
>
---

## Session Update: 2026-04-19 09:08:13
- **Type**: auto_harvest
- **Desc**: Changes detected via git diff. Overwritten potential functions: 16
- **Files**: `b/KNOWLEDGE_MAP.md`
- **Overwrites**: `- **Overwrites**: `const joined = channels.filter((c) => c.status === 'joined').length;, const joining = channels.filter((c) => c.status === 'joining').length;, const errored = channels.filter((c) => c.status === 'errored' || c.status === 'closed').length;`, - **Overwrites**: `const logout = useCallback(async () => {, setTimeout(async () => {, keysToRemove.forEach(key => localStorage.removeItem(key));, supabase.auth.onAuthStateChange((event) => {`, - **Overwrites**: `const logout = useCallback(async () => {, setTimeout(async () => {, keysToRemove.forEach(key => localStorage.removeItem(key));, supabase.auth.onAuthStateChange((event) => {`, - **Overwrites**: `const logout = useCallback(async () => {, setTimeout(async () => {, keysToRemove.forEach(key => localStorage.removeItem(key));, supabase.auth.onAuthStateChange((event) => {`, - **Overwrites**: `const joined = channels.filter((c) => c.status === 'joined').length;, const joining = channels.filter((c) => c.status === 'joining').length;, const errored = channels.filter((c) => c.status === 'errored' || c.status === 'closed').length;`, - **Overwrites**: `const joined = channels.filter((c) => c.status === 'joined').length;, const joining = channels.filter((c) => c.status === 'joining').length;, const errored = channels.filter((c) => c.status === 'errored' || c.status === 'closed').length;`, - **Overwrites**: `const logout = useCallback(async () => {, setTimeout(async () => {, keysToRemove.forEach(key => localStorage.removeItem(key));, supabase.auth.onAuthStateChange((event) => {`, - **Overwrites**: `const logout = useCallback(async () => {, setTimeout(async () => {, keysToRemove.forEach(key => localStorage.removeItem(key));, supabase.auth.onAuthStateChange((event) => {`, - **Overwrites**: `const joined = channels.filter((c) => c.status === 'joined').length;, const joining = channels.filter((c) => c.status === 'joining').length;, const errored = channels.filter((c) => c.status === 'errored' || c.status === 'closed').length;`, - **Overwrites**: `const joined = channels.filter((c) => c.status === 'joined').length;, const joining = channels.filter((c) => c.status === 'joining').length;, const errored = channels.filter((c) => c.status === 'errored' || c.status === 'closed').length;`, - **Overwrites**: `const logout = useCallback(async () => {, setTimeout(async () => {, keysToRemove.forEach(key => localStorage.removeItem(key));, supabase.auth.onAuthStateChange((event) => {`, - **Overwrites**: `const joined = channels.filter((c) => c.status === 'joined').length;, const joining = channels.filter((c) => c.status === 'joining').length;, const errored = channels.filter((c) => c.status === 'errored' || c.status === 'closed').length;`, - **Overwrites**: `const joined = channels.filter((c) => c.status === 'joined').length;, const joining = channels.filter((c) => c.status === 'joining').length;, const errored = channels.filter((c) => c.status === 'errored' || c.status === 'closed').length;`, - **Overwrites**: `const joined = channels.filter((c) => c.status === 'joined').length;, const joining = channels.filter((c) => c.status === 'joining').length;, const errored = channels.filter((c) => c.status === 'errored' || c.status === 'closed').length;`, - **Overwrites**: `const joined = channels.filter((c) => c.status === 'joined').length;, const joining = channels.filter((c) => c.status === 'joining').length;, const errored = channels.filter((c) => c.status === 'errored' || c.status === 'closed').length;`, cursor.execute("SELECT type, description, affected_files, overwritten_functions, timestamp FROM observations ORDER BY id DESC LIMIT 5")`
---
- **Type**: legacy_backfill
- **Desc**: --- WALKTHROUGH ---
# Walkthrough - Enhanced Maintenance Security

I have implemented a robust security layer for administrative maintenance actions in the Storage settings. This update ensures that high-risk operations (like database cleanup) are transparent, safe, and require explicit confirmation.

## Key Changes

### 1. Advanced Maintenance Modal
Implemented a multi-phase workflow for the **"Cleanup Dummy Orders"** action:
- **Phase 1: Analyzing**: The system scans the live database to map the exact impact before any changes occur.
- **Phase 2: Detailed Stats**: Displays a breakdown of exactly how many orders will be "Delivered" (paid) vs "Cancelled" (unpaid).
- **Phase 3: "Double-Lock" Confirmation**: Requires the user to type a specific challenge phrase ("saya mengerti") to proceed.
- **Phase 4: Feedback**: Real-time progress and a final success report.

### 2. Safety Buffer & Logic
Updated `cleanupOrders.ts` to be more conservative:
- **60-Minute Safety Buffer**: Any order created within the last hour is automatically ignored to protect active courier work.
- **Dry-Run Support**: Maintenance tools can now "Preview" impacts without touching the database.

### 3. "Danger Zone" Visuals
Redesigned the **Super Admin Maintenance** section:
- Added high-contrast "Danger Zone" styling with clear "Admin Only" labeling.
- Enhanced descriptors for "Orphaned Orders" scanning to avoid confusion.

### 4. Global Reset Protection
Updated the **"Reset & Sync"** warning in the main settings:
- Replaced the simple prompt with a detailed list of consequences (data erasure and forced logout) to prevent accidental execution.

## Verification Results

### Manual Audit Success
- [x] Cleanup Analyze phase returns correct counts.
- [x] Challenge-phrase lockout works correctly.
- [x] Recent orders ( < 60 mins ) are spared from cleanup.
- [x] Type errors in `ProfileTab` and `Settings.tsx` resolved.

> [!IMPORTANT]
> The **60-minute safety buffer** is now the default for all cleanup oper
---
- **Type**: legacy_backfill
- **Desc**: --- WALKTHROUGH ---
# Sync & UI Consistency Optimization

Berdasarkan analisis mendalam yang Anda berikan, saya telah mengoptimalkan mekanisme sinkronisasi data dan integrasi UI untuk memastikan sistem lebih resilien, efisien, dan semantik.

## Perbaikan yang Dilakukan

### 1. Resiliensi Sinkronisasi (Issue #3)
Mekanisme `fetchInitialOrders` telah direfaktorisasi menggunakan blok `try...catch...finally`. 
- **Keuntungan**: Event `indexeddb-synced` dan pembersihan status `isSyncing`/`isLoading` sekarang dipastikan berjalan meskipun terjadi error di salah satu query Supabase.
- **Dampak**: UI tidak akan menggantung dalam status "Syncing..." jika terjadi gangguan jaringan tengah jalan.

### 2. Harmonisasi Rentang Waktu (Issue #2)
Menyelaraskan kalkulasi `sevenDaysAgo` menjadi `sixDaysAgo` (`getDate() - 6`).
- **Analisis**: `T-6 + Hari Ini = 7 hari`. Ini pas dengan tampilan grafik dan histori di `CourierEarnings.tsx`.
- **Keuntungan**: Menghilangkan redundansi fetch data 1 hari yang tidak ditampilkan di UI, sehingga lebih menghemat *database reads*.

### 3. Renaming Semantik (Issue #1)
Mengganti flag `isFetchingActiveOrders` menjadi `isSyncing`.
- **Analisis**: Flag ini sekarang mencakup seluruh proses sinkronisasi (Active + Finalized), sehingga nama `isSyncing` jauh lebih akurat secara teknis.
- **Perubahan**: Seluruh referensi di `useOrderStore` dan `CourierEarnings` telah diperbarui.

### 4. Optimalisasi Admin Sync (Issue #4)
Memperbarui `needsWeeklySync` dan `saveWeeklySyncTime` di `orderCache.ts` untuk mendukung `userId` opsional.
- **Implementasi**: Jika Admin (tanpa `courierId`) melakukan sinkronisasi, sistem akan menggunakan key `'global_admin_sync'`.
- **Keuntungan**: Admin tidak lagi melakukan full-fetch 7 hari pada setiap kali aplikasi dibuka; sistem sekarang ingat kapan Admin terakhir kali melakukan sinkronisasi mingguan.

## Hasil Verifikasi

### Mekanisme Error-Handling
- [x] Event `indexeddb-synced` ter-dispatch meskipun query gagal.
- [x] Status `isSynci
---
- **Type**: legacy_backfill
- **Desc**: --- WALKTHROUGH ---
# Walkthrough: Courier Real-Time Sync Hardening

I have implemented a robust "Pulse & Re-sync" mechanism to ensure the Admin Dashboard always reflects the correct courier status, even after connection drops or idle periods.

## Changes Made

### 1. Hardened Subscriptions in [useUserStore.ts](file:///c:/Users/K4G3/Documents/GitHub/kurirdev/src/stores/useUserStore.ts)
- **Re-sync on Connect**: Both `subscribeUsers` and `subscribeProfile` now trigger a full data fetch (`fetchUsers`/`fetchProfile`) immediately upon a successful `SUBSCRIBED` event.
    - *Why?* If the connection was temporarily lost, any status changes that happened during that "gap" are now automatically pulled the moment the connection heals.
- **Improved Channel Deduplication**: Instead of just checking if a channel ID exists, we now verify the channel's internal state (`joined`/`joining`). This prevents "deadlocked" states where a dying channel might block a new one from starting.
- **Explicit Cleanup**: Added clearer logging and explicit channel removal during unsubscription.

### 2. Streamlined [AppListeners.tsx](file:///c:/Users/K4G3/Documents/GitHub/kurirdev/src/components/AppListeners.tsx)
- Consolidated the profile sync logic to use the store's primary `subscribeProfile` handler.
- Separated the security-critical "suspension check" into its own lightweight listener to ensure admins can still force-logout suspended users without overlapping with the primary profile sync.

## Verification & Monitoring

### Console Diagnostics
You can now monitor the health of these listeners in your browser's console. Look for:
- `✅ Realtime connection active: users:list. Syncing state...`
- `✅ Realtime profile sync active: <USER_ID>`
- `🧼 Cleaning up channel: ...`

### Testing Success
These changes address the "Dead Listener" symptom by ensuring the application doesn't just wait for events, but actively reconciles its state every time the real-time link is established or restored.

> [!TIP]
>
---
- **Type**: legacy_backfill
- **Desc**: --- WALKTHROUGH ---
# Walkthrough - Alignment of Courier Settlement Calculations

Standardized the financial settlement logic across the application to reflect the **COD (Cash on Delivery)** remittance model, where the courier remits the admin's share (20%) of the total fee.

## Changes Made

### 1. Finance Dashboards (Admin Side)
- **FinanceDashboard.tsx**: Updated "Tagihan Belum Lunas" and "Setoran Hari Ini" cards to use the Admin Share (20%) logic.
- **FinancePenagihan.tsx**: 
    - Updated total summaries per courier to show the amount due to admin.
    - Changed UI labels from "Earning" to "Setoran" for better mapping with physical cash flow.
    - Updated the settlement confirmation modal to reflect the correct 20% remittance amount.
- **FinanceAnalisa.tsx**: Aligned revenue analysis to focus on `netRevenue` (Admin share) and corrected calculations for collected/uncollected amounts.

### 2. Courier-Facing View
- **CourierDashboard.tsx**: Updated the "Belum Disetor" warning card. It now correctly calculates 20% of the delivery fee for unpaid orders, matching the admin's expectations.

### 3. Courier Management
- **Couriers.tsx**: 
    - Renamed table columns for better clarity: **Setoran Admin (20%)** and **Hak Kurir (80%)**.
    - Fixed the logic for calculating those columns to ensure they are accurate even for legacy orders.
    - Updated the "Potensi Setoran (7 Hari)" stat card.

### 4. Codebase Refinement
- **Orders.tsx**: Standardized local helpers to use `calcAdminEarning` from the core library.
- **Linting**: Removed unused imports (`calcCourierEarning`, `isToday`) and redundant variables (`courier`) from multiple files.

## Verification Results

| Calculation Component | Status | Logic Used |
| :--- | :---: | :--- |
| Remittance (Tagihan) | ✅ Verified | `calcAdminEarning` (20% or 0 if < threshold) |
| Courier Share (Hak) | ✅ Verified | `calcCourierEarning` (80% or 100% if < threshold) |
| Dashboard Consistency | ✅ Verified | Synced across Admin, Courie
---

## Session Update: 2026-04-18 08:03:34
- **Type**: auto_harvest
- **Desc**: Changes detected via git diff. Overwritten potential functions: 4
- **Files**: `b/vite.config.ts, b/src/lib/supabaseClient.ts, b/scripts/sync_knowledge.py, b/src/context/AuthContext.tsx`
- **Overwrites**: `const logout = useCallback(async () => {, setTimeout(async () => {, keysToRemove.forEach(key => localStorage.removeItem(key));, supabase.auth.onAuthStateChange((event) => {`
---
- **Type**: auto_harvest
- **Desc**: Changes detected via git diff. Overwritten potential functions: 4
- **Files**: `b/src/context/AuthContext.tsx, b/src/lib/supabaseClient.ts, b/vite.config.ts, b/scripts/sync_knowledge.py`
- **Overwrites**: `const logout = useCallback(async () => {, setTimeout(async () => {, keysToRemove.forEach(key => localStorage.removeItem(key));, supabase.auth.onAuthStateChange((event) => {`
---
- **Type**: auto_harvest
- **Desc**: Changes detected via git diff. Overwritten potential functions: 3
- **Files**: `b/src/stores/useUserStore.ts, b/src/stores/useOrderStore.ts, b/src/components/layout/Layout.tsx, b/src/stores/useNotificationStore.ts, b/src/hooks/useRealtimeHealth.ts, b/src/stores/useCustomerStore.ts, b/src/stores/useSettingsStore.ts`
- **Overwrites**: `const joined = channels.filter((c) => c.status === 'joined').length;, const joining = channels.filter((c) => c.status === 'joining').length;, const errored = channels.filter((c) => c.status === 'errored' || c.status === 'closed').length;`
---
- **Type**: auto_harvest
- **Desc**: Changes detected via git diff. Overwritten potential functions: 3
- **Files**: `b/src/stores/useCustomerStore.ts, b/src/stores/useOrderStore.ts, b/src/components/layout/Layout.tsx, b/src/stores/useSettingsStore.ts, b/src/stores/useNotificationStore.ts, b/src/hooks/useRealtimeHealth.ts, b/src/stores/useUserStore.ts`
- **Overwrites**: `const joined = channels.filter((c) => c.status === 'joined').length;, const joining = channels.filter((c) => c.status === 'joining').length;, const errored = channels.filter((c) => c.status === 'errored' || c.status === 'closed').length;`
---
- **Type**: legacy_backfill
- **Desc**: --- WALKTHROUGH ---
# Walkthrough - Enhanced Maintenance Security

I have implemented a robust security layer for administrative maintenance actions in the Storage settings. This update ensures that high-risk operations (like database cleanup) are transparent, safe, and require explicit confirmation.

## Key Changes

### 1. Advanced Maintenance Modal
Implemented a multi-phase workflow for the **"Cleanup Dummy Orders"** action:
- **Phase 1: Analyzing**: The system scans the live database to map the exact impact before any changes occur.
- **Phase 2: Detailed Stats**: Displays a breakdown of exactly how many orders will be "Delivered" (paid) vs "Cancelled" (unpaid).
- **Phase 3: "Double-Lock" Confirmation**: Requires the user to type a specific challenge phrase ("saya mengerti") to proceed.
- **Phase 4: Feedback**: Real-time progress and a final success report.

### 2. Safety Buffer & Logic
Updated `cleanupOrders.ts` to be more conservative:
- **60-Minute Safety Buffer**: Any order created within the last hour is automatically ignored to protect active courier work.
- **Dry-Run Support**: Maintenance tools can now "Preview" impacts without touching the database.

### 3. "Danger Zone" Visuals
Redesigned the **Super Admin Maintenance** section:
- Added high-contrast "Danger Zone" styling with clear "Admin Only" labeling.
- Enhanced descriptors for "Orphaned Orders" scanning to avoid confusion.

### 4. Global Reset Protection
Updated the **"Reset & Sync"** warning in the main settings:
- Replaced the simple prompt with a detailed list of consequences (data erasure and forced logout) to prevent accidental execution.

## Verification Results

### Manual Audit Success
- [x] Cleanup Analyze phase returns correct counts.
- [x] Challenge-phrase lockout works correctly.
- [x] Recent orders ( < 60 mins ) are spared from cleanup.
- [x] Type errors in `ProfileTab` and `Settings.tsx` resolved.

> [!IMPORTANT]
> The **60-minute safety buffer** is now the default for all cleanup oper
---

## Session Update: 2026-04-18 08:03:01
- **Type**: auto_harvest
- **Desc**: Changes detected via git diff. Overwritten potential functions: 4
- **Files**: `b/src/context/AuthContext.tsx, b/src/lib/supabaseClient.ts, b/vite.config.ts, b/scripts/sync_knowledge.py`
- **Overwrites**: `const logout = useCallback(async () => {, setTimeout(async () => {, keysToRemove.forEach(key => localStorage.removeItem(key));, supabase.auth.onAuthStateChange((event) => {`
---
- **Type**: auto_harvest
- **Desc**: Changes detected via git diff. Overwritten potential functions: 3
- **Files**: `b/src/stores/useUserStore.ts, b/src/stores/useOrderStore.ts, b/src/components/layout/Layout.tsx, b/src/stores/useNotificationStore.ts, b/src/hooks/useRealtimeHealth.ts, b/src/stores/useCustomerStore.ts, b/src/stores/useSettingsStore.ts`
- **Overwrites**: `const joined = channels.filter((c) => c.status === 'joined').length;, const joining = channels.filter((c) => c.status === 'joining').length;, const errored = channels.filter((c) => c.status === 'errored' || c.status === 'closed').length;`
---
- **Type**: auto_harvest
- **Desc**: Changes detected via git diff. Overwritten potential functions: 3
- **Files**: `b/src/stores/useCustomerStore.ts, b/src/stores/useOrderStore.ts, b/src/components/layout/Layout.tsx, b/src/stores/useSettingsStore.ts, b/src/stores/useNotificationStore.ts, b/src/hooks/useRealtimeHealth.ts, b/src/stores/useUserStore.ts`
- **Overwrites**: `const joined = channels.filter((c) => c.status === 'joined').length;, const joining = channels.filter((c) => c.status === 'joining').length;, const errored = channels.filter((c) => c.status === 'errored' || c.status === 'closed').length;`
---
- **Type**: legacy_backfill
- **Desc**: --- WALKTHROUGH ---
# Walkthrough - Enhanced Maintenance Security

I have implemented a robust security layer for administrative maintenance actions in the Storage settings. This update ensures that high-risk operations (like database cleanup) are transparent, safe, and require explicit confirmation.

## Key Changes

### 1. Advanced Maintenance Modal
Implemented a multi-phase workflow for the **"Cleanup Dummy Orders"** action:
- **Phase 1: Analyzing**: The system scans the live database to map the exact impact before any changes occur.
- **Phase 2: Detailed Stats**: Displays a breakdown of exactly how many orders will be "Delivered" (paid) vs "Cancelled" (unpaid).
- **Phase 3: "Double-Lock" Confirmation**: Requires the user to type a specific challenge phrase ("saya mengerti") to proceed.
- **Phase 4: Feedback**: Real-time progress and a final success report.

### 2. Safety Buffer & Logic
Updated `cleanupOrders.ts` to be more conservative:
- **60-Minute Safety Buffer**: Any order created within the last hour is automatically ignored to protect active courier work.
- **Dry-Run Support**: Maintenance tools can now "Preview" impacts without touching the database.

### 3. "Danger Zone" Visuals
Redesigned the **Super Admin Maintenance** section:
- Added high-contrast "Danger Zone" styling with clear "Admin Only" labeling.
- Enhanced descriptors for "Orphaned Orders" scanning to avoid confusion.

### 4. Global Reset Protection
Updated the **"Reset & Sync"** warning in the main settings:
- Replaced the simple prompt with a detailed list of consequences (data erasure and forced logout) to prevent accidental execution.

## Verification Results

### Manual Audit Success
- [x] Cleanup Analyze phase returns correct counts.
- [x] Challenge-phrase lockout works correctly.
- [x] Recent orders ( < 60 mins ) are spared from cleanup.
- [x] Type errors in `ProfileTab` and `Settings.tsx` resolved.

> [!IMPORTANT]
> The **60-minute safety buffer** is now the default for all cleanup oper
---
- **Type**: legacy_backfill
- **Desc**: --- WALKTHROUGH ---
# Sync & UI Consistency Optimization

Berdasarkan analisis mendalam yang Anda berikan, saya telah mengoptimalkan mekanisme sinkronisasi data dan integrasi UI untuk memastikan sistem lebih resilien, efisien, dan semantik.

## Perbaikan yang Dilakukan

### 1. Resiliensi Sinkronisasi (Issue #3)
Mekanisme `fetchInitialOrders` telah direfaktorisasi menggunakan blok `try...catch...finally`. 
- **Keuntungan**: Event `indexeddb-synced` dan pembersihan status `isSyncing`/`isLoading` sekarang dipastikan berjalan meskipun terjadi error di salah satu query Supabase.
- **Dampak**: UI tidak akan menggantung dalam status "Syncing..." jika terjadi gangguan jaringan tengah jalan.

### 2. Harmonisasi Rentang Waktu (Issue #2)
Menyelaraskan kalkulasi `sevenDaysAgo` menjadi `sixDaysAgo` (`getDate() - 6`).
- **Analisis**: `T-6 + Hari Ini = 7 hari`. Ini pas dengan tampilan grafik dan histori di `CourierEarnings.tsx`.
- **Keuntungan**: Menghilangkan redundansi fetch data 1 hari yang tidak ditampilkan di UI, sehingga lebih menghemat *database reads*.

### 3. Renaming Semantik (Issue #1)
Mengganti flag `isFetchingActiveOrders` menjadi `isSyncing`.
- **Analisis**: Flag ini sekarang mencakup seluruh proses sinkronisasi (Active + Finalized), sehingga nama `isSyncing` jauh lebih akurat secara teknis.
- **Perubahan**: Seluruh referensi di `useOrderStore` dan `CourierEarnings` telah diperbarui.

### 4. Optimalisasi Admin Sync (Issue #4)
Memperbarui `needsWeeklySync` dan `saveWeeklySyncTime` di `orderCache.ts` untuk mendukung `userId` opsional.
- **Implementasi**: Jika Admin (tanpa `courierId`) melakukan sinkronisasi, sistem akan menggunakan key `'global_admin_sync'`.
- **Keuntungan**: Admin tidak lagi melakukan full-fetch 7 hari pada setiap kali aplikasi dibuka; sistem sekarang ingat kapan Admin terakhir kali melakukan sinkronisasi mingguan.

## Hasil Verifikasi

### Mekanisme Error-Handling
- [x] Event `indexeddb-synced` ter-dispatch meskipun query gagal.
- [x] Status `isSynci
---

## Session Update: 2026-04-17 06:21:36
- **Type**: auto_harvest
- **Desc**: Changes detected via git diff. Overwritten potential functions: 3
- **Files**: `b/src/stores/useUserStore.ts, b/src/stores/useOrderStore.ts, b/src/components/layout/Layout.tsx, b/src/stores/useNotificationStore.ts, b/src/hooks/useRealtimeHealth.ts, b/src/stores/useCustomerStore.ts, b/src/stores/useSettingsStore.ts`
- **Overwrites**: `const joined = channels.filter((c) => c.status === 'joined').length;, const joining = channels.filter((c) => c.status === 'joining').length;, const errored = channels.filter((c) => c.status === 'errored' || c.status === 'closed').length;`
---
- **Type**: auto_harvest
- **Desc**: Changes detected via git diff. Overwritten potential functions: 3
- **Files**: `b/src/stores/useCustomerStore.ts, b/src/stores/useOrderStore.ts, b/src/components/layout/Layout.tsx, b/src/stores/useSettingsStore.ts, b/src/stores/useNotificationStore.ts, b/src/hooks/useRealtimeHealth.ts, b/src/stores/useUserStore.ts`
- **Overwrites**: `const joined = channels.filter((c) => c.status === 'joined').length;, const joining = channels.filter((c) => c.status === 'joining').length;, const errored = channels.filter((c) => c.status === 'errored' || c.status === 'closed').length;`
---
- **Type**: legacy_backfill
- **Desc**: --- WALKTHROUGH ---
# Walkthrough - Enhanced Maintenance Security

I have implemented a robust security layer for administrative maintenance actions in the Storage settings. This update ensures that high-risk operations (like database cleanup) are transparent, safe, and require explicit confirmation.

## Key Changes

### 1. Advanced Maintenance Modal
Implemented a multi-phase workflow for the **"Cleanup Dummy Orders"** action:
- **Phase 1: Analyzing**: The system scans the live database to map the exact impact before any changes occur.
- **Phase 2: Detailed Stats**: Displays a breakdown of exactly how many orders will be "Delivered" (paid) vs "Cancelled" (unpaid).
- **Phase 3: "Double-Lock" Confirmation**: Requires the user to type a specific challenge phrase ("saya mengerti") to proceed.
- **Phase 4: Feedback**: Real-time progress and a final success report.

### 2. Safety Buffer & Logic
Updated `cleanupOrders.ts` to be more conservative:
- **60-Minute Safety Buffer**: Any order created within the last hour is automatically ignored to protect active courier work.
- **Dry-Run Support**: Maintenance tools can now "Preview" impacts without touching the database.

### 3. "Danger Zone" Visuals
Redesigned the **Super Admin Maintenance** section:
- Added high-contrast "Danger Zone" styling with clear "Admin Only" labeling.
- Enhanced descriptors for "Orphaned Orders" scanning to avoid confusion.

### 4. Global Reset Protection
Updated the **"Reset & Sync"** warning in the main settings:
- Replaced the simple prompt with a detailed list of consequences (data erasure and forced logout) to prevent accidental execution.

## Verification Results

### Manual Audit Success
- [x] Cleanup Analyze phase returns correct counts.
- [x] Challenge-phrase lockout works correctly.
- [x] Recent orders ( < 60 mins ) are spared from cleanup.
- [x] Type errors in `ProfileTab` and `Settings.tsx` resolved.

> [!IMPORTANT]
> The **60-minute safety buffer** is now the default for all cleanup oper
---
- **Type**: legacy_backfill
- **Desc**: --- WALKTHROUGH ---
# Sync & UI Consistency Optimization

Berdasarkan analisis mendalam yang Anda berikan, saya telah mengoptimalkan mekanisme sinkronisasi data dan integrasi UI untuk memastikan sistem lebih resilien, efisien, dan semantik.

## Perbaikan yang Dilakukan

### 1. Resiliensi Sinkronisasi (Issue #3)
Mekanisme `fetchInitialOrders` telah direfaktorisasi menggunakan blok `try...catch...finally`. 
- **Keuntungan**: Event `indexeddb-synced` dan pembersihan status `isSyncing`/`isLoading` sekarang dipastikan berjalan meskipun terjadi error di salah satu query Supabase.
- **Dampak**: UI tidak akan menggantung dalam status "Syncing..." jika terjadi gangguan jaringan tengah jalan.

### 2. Harmonisasi Rentang Waktu (Issue #2)
Menyelaraskan kalkulasi `sevenDaysAgo` menjadi `sixDaysAgo` (`getDate() - 6`).
- **Analisis**: `T-6 + Hari Ini = 7 hari`. Ini pas dengan tampilan grafik dan histori di `CourierEarnings.tsx`.
- **Keuntungan**: Menghilangkan redundansi fetch data 1 hari yang tidak ditampilkan di UI, sehingga lebih menghemat *database reads*.

### 3. Renaming Semantik (Issue #1)
Mengganti flag `isFetchingActiveOrders` menjadi `isSyncing`.
- **Analisis**: Flag ini sekarang mencakup seluruh proses sinkronisasi (Active + Finalized), sehingga nama `isSyncing` jauh lebih akurat secara teknis.
- **Perubahan**: Seluruh referensi di `useOrderStore` dan `CourierEarnings` telah diperbarui.

### 4. Optimalisasi Admin Sync (Issue #4)
Memperbarui `needsWeeklySync` dan `saveWeeklySyncTime` di `orderCache.ts` untuk mendukung `userId` opsional.
- **Implementasi**: Jika Admin (tanpa `courierId`) melakukan sinkronisasi, sistem akan menggunakan key `'global_admin_sync'`.
- **Keuntungan**: Admin tidak lagi melakukan full-fetch 7 hari pada setiap kali aplikasi dibuka; sistem sekarang ingat kapan Admin terakhir kali melakukan sinkronisasi mingguan.

## Hasil Verifikasi

### Mekanisme Error-Handling
- [x] Event `indexeddb-synced` ter-dispatch meskipun query gagal.
- [x] Status `isSynci
---
- **Type**: legacy_backfill
- **Desc**: --- WALKTHROUGH ---
# Walkthrough: Courier Real-Time Sync Hardening

I have implemented a robust "Pulse & Re-sync" mechanism to ensure the Admin Dashboard always reflects the correct courier status, even after connection drops or idle periods.

## Changes Made

### 1. Hardened Subscriptions in [useUserStore.ts](file:///c:/Users/K4G3/Documents/GitHub/kurirdev/src/stores/useUserStore.ts)
- **Re-sync on Connect**: Both `subscribeUsers` and `subscribeProfile` now trigger a full data fetch (`fetchUsers`/`fetchProfile`) immediately upon a successful `SUBSCRIBED` event.
    - *Why?* If the connection was temporarily lost, any status changes that happened during that "gap" are now automatically pulled the moment the connection heals.
- **Improved Channel Deduplication**: Instead of just checking if a channel ID exists, we now verify the channel's internal state (`joined`/`joining`). This prevents "deadlocked" states where a dying channel might block a new one from starting.
- **Explicit Cleanup**: Added clearer logging and explicit channel removal during unsubscription.

### 2. Streamlined [AppListeners.tsx](file:///c:/Users/K4G3/Documents/GitHub/kurirdev/src/components/AppListeners.tsx)
- Consolidated the profile sync logic to use the store's primary `subscribeProfile` handler.
- Separated the security-critical "suspension check" into its own lightweight listener to ensure admins can still force-logout suspended users without overlapping with the primary profile sync.

## Verification & Monitoring

### Console Diagnostics
You can now monitor the health of these listeners in your browser's console. Look for:
- `✅ Realtime connection active: users:list. Syncing state...`
- `✅ Realtime profile sync active: <USER_ID>`
- `🧼 Cleaning up channel: ...`

### Testing Success
These changes address the "Dead Listener" symptom by ensuring the application doesn't just wait for events, but actively reconciles its state every time the real-time link is established or restored.

> [!TIP]
>
---
I have implemented a robust security layer for administrative maintenance actions in the Storage settings. This update ensures that high-risk operations (like database cleanup) are transparent, safe, and require explicit confirmation.

## Key Changes

### 1. Advanced Maintenance Modal
Implemented a multi-phase workflow for the **"Cleanup Dummy Orders"** action:
- **Phase 1: Analyzing**: The system scans the live database to map the exact impact before any changes occur.
- **Phase 2: Detailed Stats**: Displays a breakdown of exactly how many orders will be "Delivered" (paid) vs "Cancelled" (unpaid).
- **Phase 3: "Double-Lock" Confirmation**: Requires the user to type a specific challenge phrase ("saya mengerti") to proceed.
- **Phase 4: Feedback**: Real-time progress and a final success report.

### 2. Safety Buffer & Logic
Updated `cleanupOrders.ts` to be more conservative:
- **60-Minute Safety Buffer**: Any order created within the last hour is automatically ignored to protect active courier work.
- **Dry-Run Support**: Maintenance tools can now "Preview" impacts without touching the database.

### 3. "Danger Zone" Visuals
Redesigned the **Super Admin Maintenance** section:
- Added high-contrast "Danger Zone" styling with clear "Admin Only" labeling.
- Enhanced descriptors for "Orphaned Orders" scanning to avoid confusion.

### 4. Global Reset Protection
Updated the **"Reset & Sync"** warning in the main settings:
- Replaced the simple prompt with a detailed list of consequences (data erasure and forced logout) to prevent accidental execution.

## Verification Results

### Manual Audit Success
- [x] Cleanup Analyze phase returns correct counts.
- [x] Challenge-phrase lockout works correctly.
- [x] Recent orders ( < 60 mins ) are spared from cleanup.
- [x] Type errors in `ProfileTab` and `Settings.tsx` resolved.

> [!IMPORTANT]
> The **60-minute safety buffer** is now the default for all cleanup oper
---
- **Type**: legacy_backfill
- **Desc**: --- WALKTHROUGH ---
# Sync & UI Consistency Optimization

Berdasarkan analisis mendalam yang Anda berikan, saya telah mengoptimalkan mekanisme sinkronisasi data dan integrasi UI untuk memastikan sistem lebih resilien, efisien, dan semantik.

## Perbaikan yang Dilakukan

### 1. Resiliensi Sinkronisasi (Issue #3)
Mekanisme `fetchInitialOrders` telah direfaktorisasi menggunakan blok `try...catch...finally`. 
- **Keuntungan**: Event `indexeddb-synced` dan pembersihan status `isSyncing`/`isLoading` sekarang dipastikan berjalan meskipun terjadi error di salah satu query Supabase.
- **Dampak**: UI tidak akan menggantung dalam status "Syncing..." jika terjadi gangguan jaringan tengah jalan.

### 2. Harmonisasi Rentang Waktu (Issue #2)
Menyelaraskan kalkulasi `sevenDaysAgo` menjadi `sixDaysAgo` (`getDate() - 6`).
- **Analisis**: `T-6 + Hari Ini = 7 hari`. Ini pas dengan tampilan grafik dan histori di `CourierEarnings.tsx`.
- **Keuntungan**: Menghilangkan redundansi fetch data 1 hari yang tidak ditampilkan di UI, sehingga lebih menghemat *database reads*.

### 3. Renaming Semantik (Issue #1)
Mengganti flag `isFetchingActiveOrders` menjadi `isSyncing`.
- **Analisis**: Flag ini sekarang mencakup seluruh proses sinkronisasi (Active + Finalized), sehingga nama `isSyncing` jauh lebih akurat secara teknis.
- **Perubahan**: Seluruh referensi di `useOrderStore` dan `CourierEarnings` telah diperbarui.

### 4. Optimalisasi Admin Sync (Issue #4)
Memperbarui `needsWeeklySync` dan `saveWeeklySyncTime` di `orderCache.ts` untuk mendukung `userId` opsional.
- **Implementasi**: Jika Admin (tanpa `courierId`) melakukan sinkronisasi, sistem akan menggunakan key `'global_admin_sync'`.
- **Keuntungan**: Admin tidak lagi melakukan full-fetch 7 hari pada setiap kali aplikasi dibuka; sistem sekarang ingat kapan Admin terakhir kali melakukan sinkronisasi mingguan.

## Hasil Verifikasi

### Mekanisme Error-Handling
- [x] Event `indexeddb-synced` ter-dispatch meskipun query gagal.
- [x] Status `isSynci
---
- **Type**: legacy_backfill
- **Desc**: --- WALKTHROUGH ---
# Walkthrough: Courier Real-Time Sync Hardening

I have implemented a robust "Pulse & Re-sync" mechanism to ensure the Admin Dashboard always reflects the correct courier status, even after connection drops or idle periods.

## Changes Made

### 1. Hardened Subscriptions in [useUserStore.ts](file:///c:/Users/K4G3/Documents/GitHub/kurirdev/src/stores/useUserStore.ts)
- **Re-sync on Connect**: Both `subscribeUsers` and `subscribeProfile` now trigger a full data fetch (`fetchUsers`/`fetchProfile`) immediately upon a successful `SUBSCRIBED` event.
    - *Why?* If the connection was temporarily lost, any status changes that happened during that "gap" are now automatically pulled the moment the connection heals.
- **Improved Channel Deduplication**: Instead of just checking if a channel ID exists, we now verify the channel's internal state (`joined`/`joining`). This prevents "deadlocked" states where a dying channel might block a new one from starting.
- **Explicit Cleanup**: Added clearer logging and explicit channel removal during unsubscription.

### 2. Streamlined [AppListeners.tsx](file:///c:/Users/K4G3/Documents/GitHub/kurirdev/src/components/AppListeners.tsx)
- Consolidated the profile sync logic to use the store's primary `subscribeProfile` handler.
- Separated the security-critical "suspension check" into its own lightweight listener to ensure admins can still force-logout suspended users without overlapping with the primary profile sync.

## Verification & Monitoring

### Console Diagnostics
You can now monitor the health of these listeners in your browser's console. Look for:
- `✅ Realtime connection active: users:list. Syncing state...`
- `✅ Realtime profile sync active: <USER_ID>`
- `🧼 Cleaning up channel: ...`

### Testing Success
These changes address the "Dead Listener" symptom by ensuring the application doesn't just wait for events, but actively reconciles its state every time the real-time link is established or restored.

> [!TIP]
>
---
- **Type**: legacy_backfill
- **Desc**: --- WALKTHROUGH ---
# Walkthrough - Alignment of Courier Settlement Calculations

Standardized the financial settlement logic across the application to reflect the **COD (Cash on Delivery)** remittance model, where the courier remits the admin's share (20%) of the total fee.

## Changes Made

### 1. Finance Dashboards (Admin Side)
- **FinanceDashboard.tsx**: Updated "Tagihan Belum Lunas" and "Setoran Hari Ini" cards to use the Admin Share (20%) logic.
- **FinancePenagihan.tsx**: 
    - Updated total summaries per courier to show the amount due to admin.
    - Changed UI labels from "Earning" to "Setoran" for better mapping with physical cash flow.
    - Updated the settlement confirmation modal to reflect the correct 20% remittance amount.
- **FinanceAnalisa.tsx**: Aligned revenue analysis to focus on `netRevenue` (Admin share) and corrected calculations for collected/uncollected amounts.

### 2. Courier-Facing View
- **CourierDashboard.tsx**: Updated the "Belum Disetor" warning card. It now correctly calculates 20% of the delivery fee for unpaid orders, matching the admin's expectations.

### 3. Courier Management
- **Couriers.tsx**: 
    - Renamed table columns for better clarity: **Setoran Admin (20%)** and **Hak Kurir (80%)**.
    - Fixed the logic for calculating those columns to ensure they are accurate even for legacy orders.
    - Updated the "Potensi Setoran (7 Hari)" stat card.

### 4. Codebase Refinement
- **Orders.tsx**: Standardized local helpers to use `calcAdminEarning` from the core library.
- **Linting**: Removed unused imports (`calcCourierEarning`, `isToday`) and redundant variables (`courier`) from multiple files.

## Verification Results

| Calculation Component | Status | Logic Used |
| :--- | :---: | :--- |
| Remittance (Tagihan) | ✅ Verified | `calcAdminEarning` (20% or 0 if < threshold) |
| Courier Share (Hak) | ✅ Verified | `calcCourierEarning` (80% or 100% if < threshold) |
| Dashboard Consistency | ✅ Verified | Synced across Admin, Courie
---
