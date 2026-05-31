# KurirMe — Master PRD & Multi-Tenant SaaS Specification

**Document version:** 2.0  
**Source:** `src/`, `supabase/migrations/`, `src/types/supabase.ts`, route map `src/App.tsx`.  
**Note:** This document replaces the previous PRD version. Section 0 is now at the top. Appendix A has been completely rewritten for fresh install.

---

## Table of contents

0. [AI Agent Build Instructions](#section-0--ai-agent-build-instructions)  
1. [Project overview](#1-project-overview)  
2. [Architecture overview](#2-architecture-overview)  
3. [Multi-tenant transformation](#3-multi-tenant-saas-transformation)  
4. [Database schema from actual database](#4-database-schema--expanded)  
5. [Authentication & authorization](#5-authentication--authorization-summary)  
6. [Billing, plans & entitlements](#6-billing--plans--entitlements-kurirme-saas)  
7. [Firebase / push (summary)](#7-firebase--push-summary)  
8. [Section 8 — Page-by-page (expanded)](#8-section-8--page-by-page-expanded)  
9. [User flows & integrations](#9-user-flows--integrations-summary)  
10. [Appendix A — Full Fresh Install SQL (Single Paste, Zero Errors)](#appendix-a--full-fresh-install-sql-single-paste-zero-errors)  
11. [Appendix B — First User Setup](#appendix-b--first-user-setup)

---

## Section 0 — AI Agent Build Instructions

**Target audience:** AI agent (Claude, GPT, etc.) rebuilding KurirMe from this PRD.

### 0.1 — Tech stack with pinned versions

| Technology | Version |
|------------|---------|
| Node.js | 18+ LTS |
| React | 19.x |
| Vite | 7.x |
| Tailwind CSS | 4.x |
| Zustand | 5.x |
| Supabase JS | 2.x |
| React Router | 7.x |
| lucide-react | 0.383.0 |
| Capacitor | 8.x |
| Firebase JS SDK | 10.x |
| Deno (Edge Functions) | 1.40+ |

### 0.2 — Build order for AI agents

Execute in this exact sequence:

1. **Appendix A SQL** → Apply to Supabase via SQL Editor
2. **Appendix B user setup** → Create owner user and seed data
3. `npm create vite@latest kurirdev -- --template react-ts` (jika fresh start)
4. Install dependencies: `npm install`
5. Create `src/types/supabase.ts` from generated types
6. Create `src/lib/supabaseClient.ts` with Supabase client
7. Create `src/context/AuthContext.tsx` → with `isLoading` in finally block
8. Create `src/components/ui/` → Button, Modal, Card, Input, etc.
9. Create `src/stores/` → useSessionStore, useSettingsStore, useUserStore, useOrderStore, useCustomerStore, useNotificationStore, useShiftStore, useAdminAttendanceStore, useAttendanceStore, useCourierStore
10. Create `src/pages/` per Section 8
11. Create `src/App.tsx` → HashRouter (not BrowserRouter for iframe preview)
12. `npm run dev` → localhost:5173

### 0.3 — Known pitfalls (CRITICAL — do not skip)

| # | Pitfall | Fix |
|---|---------|-----|
| 1 | HashRouter required for iframe/static preview (arena.ai) | Replace BrowserRouter with HashRouter in App.tsx |
| 2 | viteSingleFile required for arena.ai preview | Add to vite.config.ts: `viteSingleFile()`, `assetsInlineLimit: 100000000` |
| 3 | lucide-react must be pinned to ^0.383.0 | Version ^1.x does not exist on npm |
| 4 | Supabase SQL Editor does not support BEGIN/COMMIT | Remove transaction wrappers, run statements directly |
| 5 | profiles RLS causes infinite recursion | Use `get_my_org_id()` SECURITY DEFINER function instead of inline SELECT FROM profiles in any policy on profiles table |
| 6 | organization_id must be passed explicitly | Until JWT Custom Access Token Hook is configured, use `.eq('organization_id', user.organization_id)` on every query |
| 7 | AuthContext must always call setIsLoading(false) in finally block | Prevents infinite loading state on uncaught errors |
| 8 | Supabase anon key is safe to expose in .env frontend | service_role key must NEVER appear in frontend code |

### 0.4 — Design system

- **Primary color:** emerald (emerald-600 buttons, emerald-50 active state)
- **Radius:** rounded-xl for cards/modals, rounded-lg for buttons/inputs
- **Shadow:** shadow-sm on cards
- **Language:** All user-facing text in Indonesian
- **Responsive:** Mobile-first, Tailwind utility classes only
- **Icons:** lucide-react only (pinned to 0.383.0)

### 0.5 — Stack prerequisites

- Node.js 18+ LTS, npm 9+
- Supabase CLI (`npm i -g supabase`)
- Deno 1.40+ (for Edge Functions)
- Android Studio / Xcode (optional, for native builds)

### 0.6 — Bootstrap sequence

1. `npm create vite@latest kurirdev -- --template react-ts` (if fresh start)
2. Install dependencies per package.json
3. `supabase init` → link project (`supabase link --project-ref bunycotovavltxmutier`)
4. Apply Appendix A SQL (via Supabase SQL editor or `supabase db push`)
5. `supabase gen types --lang=typescript > src/types/supabase.ts`
6. Create Edge Functions from `supabase/functions/_shared/` patterns

### 0.7 — Environment variables

```bash
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
WEBHOOK_SECRET=<for notify-courier>
FIREBASE_SERVICE_ACCOUNT=<base64_json>
```

Frontend uses `import.meta.env.VITE_*`. Edge uses `Deno.env.get()`.

### 0.8 — First build command

```bash
npm run dev        # localhost:5173
npm run build      # static assets in dist/
npm run preview    # test built output
```

### 0.9 — Verification checklist

- [ ] Login with seeded user → redirect to `/admin/dashboard`
- [ ] Create order → visible in `/admin/orders`
- [ ] Assign courier → `tracking_logs` INSERT triggers notification
- [ ] Courier app → order appears via Realtime
- [ ] Stay QR verification → `stay_attendance_logs` row

---

## 1. Project overview

**Product:** KurirMe — logistics / courier dispatch, orders, customers, finance views, shift attendance & fines, stay monitoring (basecamp + QR), PWA + Capacitor Android.

**Stack (key):** React 19, Vite 7, Tailwind 4, Zustand, Supabase JS, Firebase FCM, Capacitor 8, react-router-dom 7.

**Product:** KurirMe — logistics / courier dispatch, orders, customers, finance views, shift attendance & fines, stay monitoring (basecamp + QR), PWA + Capacitor Android.

**Stack (key):** React 19, Vite 7, Tailwind 4, Zustand, Supabase JS, Firebase FCM, Capacitor 8, react-router-dom 7.

---

## 2. Architecture overview

**Client:** Vite SPA; lazy routes; Zustand stores; `AuthContext`; `AppListeners` serializes Realtime subscriptions (orders → notifications → profile → settings → users → customers).

**Backend:** Supabase (Postgres, Auth, Realtime, RPC). Edge Functions: `notify-courier`, `create-staff-user`, `process-shift-attendance`, `process-alpha`, `process-auto-shift-end`, `process-scheduled-notifications`.

### 2.1 Supabase Edge Functions — implementation reference

Each function lives under `supabase/functions/<name>/index.ts` (Deno `serve` or `Deno.serve`). Shared time helpers: `supabase/functions/_shared/timezone.ts` (`getCurrentTime(supabase)` reads `settings` and uses RPC `execute_sql` for “now” in operational timezone).

#### `notify-courier` (`notify-courier/index.ts`)

- **Entry:** `serve(async (req) => { ... })` from `std@0.168.0/http/server.ts`.  
- **Auth:** Requires `WEBHOOK_SECRET` env; caller must send `X-Webhook-Secret` or `Authorization: Bearer <secret>` matching that value. Missing or wrong secret → `401` / `500` (if secret unset).  
- **Body:** JSON from **Database Webhooks** (or equivalent): expects `payload.type === 'INSERT'` and `payload.table === 'notifications'`; otherwise returns `200` with “ignoring”. Uses `payload.record` as the new notification row (`id`, `user_id`, `title`, `message`, `data`).  
- **FCM token:** Loads `profiles.fcm_token` for `notification.user_id` via service-role client. If missing → updates `notifications` row `fcm_status = 'skipped'`, `fcm_error` message, returns `200`.  
- **FCM send:** Parses `FIREBASE_SERVICE_ACCOUNT` JSON; `google-auth-library` OAuth scope `https://www.googleapis.com/auth/firebase.messaging`; `POST https://fcm.googleapis.com/v1/projects/{project_id}/messages:send` with body including `message.token`, `notification` title/body, `data`, Android TTL `7200s` + channel `orders`, APNS expiration header, WebPush urgency + icon.  
- **Outcome:** On HTTP OK → `notifications.fcm_status = 'sent'`. On failure → `fcm_status = 'failed'`, `fcm_error`; if FCM status `UNREGISTERED` / `NOT_FOUND` or message contains `unregistered` → clears `profiles.fcm_token` and `fcm_token_updated_at` for that user.  
- **Errors:** `500` JSON with `error`, `message`, `hint` on thrown exceptions (e.g. bad Firebase JSON).

#### `create-staff-user` (`create-staff-user/index.ts`)

- **CORS:** `OPTIONS` returns `ok` with `Access-Control-Allow-Origin: *` and allow-headers list.  
- **Env:** Requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; else `500` JSON `step: 'init_env'`.  
- **Caller auth:** `Authorization` Bearer JWT → `supabaseAdmin.auth.getUser(token)`; failure → `401` with debug fields.  
- **RBAC:** Loads `profiles.role` for caller; hard-coded bypass for UUID `2b3cb9f5-924f-4627-9877-1f7e1e16a401` as `admin` without profile. Allowed roles: `admin`, `admin_kurir`, `owner`; else `403`.  
- **Body JSON:** `{ email, password, name?, phone?, role }` — `email`, `password`, `role` required.  
- **Flow:** `auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name, role, phone }})`; then `profiles.upsert({ id, role, name, email, phone, updated_at, is_active: true, queue_position: 0 }, { onConflict: 'id' })` with `updated_at` from `getCurrentTime(supabaseAdmin)`.  
- **Responses:** `200` `{ message, user: { id, email } }`; `400`/`500` with `step` (`auth_create`, `profile_upsert`, `global`) on failures.

#### `process-shift-attendance` (`process-shift-attendance/index.ts`)

- **Role:** Cron-friendly worker (service role). Uses `settings.operational_timezone` (fallback `Asia/Makassar`); legacy path selects `settings` with `.eq('id', 'global')`.  
- **Time:** RPC `execute_sql` with interpolated timezone for `current_date`, `current_time`, `day_name`.  
- **Holiday skip:** If `holidays` row for `currentDate` with `is_active` → `200` `{ success, skipped: true, message }`.  
- **Per active shift:** If `|now - shift.start_time| <= 1` minute: loads couriers `profiles` where `role=courier`, `is_active`, `shift_id=shift.id`; skips `day_off` matching `day_name`; inserts `shift_attendance` if none exists (`status` `on_time` or `late` from `is_online`, `late_minutes` 0); sets `profiles.late_fine_active` when late.  
- **Late updates:** For `shift_attendance` same date/shift `status=late` and `first_online_at` null, recomputes `late_minutes` via `execute_sql` epoch diff vs shift start; updates row and `late_fine_active` on profile.  
- **Alpha at shift end:** When end time within 1 minute (handles `is_overnight`), bulk-updates matching attendance rows to `status: 'alpha'` with computed `late_minutes`.  
- **Response:** `200` JSON `records_created`, `records_updated`, `timezone`, `timestamp`.

#### `process-alpha` (`process-alpha/index.ts`)

- **Runtime:** `Deno.serve` (no CORS branch). Service-role Supabase client.  
- **Steps:** (1) `rpc('reset_daily_fine_flags')`; (2) `rpc('process_shift_alpha')`.  
- **Response:** `200` `{ message, reset_fine_flags, alpha_result }` or `500` `{ error }`.

#### `process-auto-shift-end` (`process-auto-shift-end/index.ts`)

- **Pattern:** Same CORS + service client as shift-attendance. `getCurrentTime(supabase)` for `current_time` / timezone.  
- **Logic:** For each active `shifts` row, if current time within 1 minute of `end_time`, loads couriers on that shift; for each calls `rpc('auto_shift_end_if_ready', { p_courier_id })`.  
- **Response:** `200` JSON with `processed`, `success`, `skipped` counts (implementation uses duplicate `success` key in object literal — last value wins in JS).

#### `process-scheduled-notifications` (`process-scheduled-notifications/index.ts`)

- **Time:** `getCurrentTime(supabase)`; `now = current_timestamp.toISOString()`.  
- **Query:** `scheduled_notifications` where `scheduled_at <= now`, `sent = false`, ordered ascending, `limit(100)`.  
- **Per row:** Inserts into `notifications` (`user_id`, `title`, `message`, `type`, `data`, `is_read: false`, `fcm_status: 'pending'`, `user_name: ''`); on success updates `scheduled_notifications` `sent=true`, `sent_at`. Collects `results[]`.  
- **Response:** `200` with `processed`, `sent`, `failed`, `results`.

**Client contract (`src/stores/useUserStore.ts` — `updateUser`):** If `email` or `password` is present in the update payload, the client calls `supabase.functions.invoke('update-user-management', { body: { userId, email, password, name, phone, role, vehicle_type, plate_number } })` and expects `{ success: true }` or throws on `fnError` / missing success. Otherwise it performs a direct `supabase.from('profiles').update({ ...restData, updated_at })` for profile-only fields. The Edge Function source may live outside this workspace snapshot; implement it mirroring `create-staff-user` (service role, JWT `getUser`, admin-only roles).

### 2.2 Zustand application stores — state, actions, Supabase, Realtime

Stores use `create` from `zustand`; `useSettingsStore` and `useSessionStore` use `persist` middleware. Realtime-heavy stores expose **`realtimeStatus: Record<string, string>`** (channel id → `joining` | `joined` | `errored` | `closed`) consumed by `src/hooks/useRealtimeHealth.ts`.

| Store file | State shape (fields) | Key actions & Supabase | Realtime |
|------------|----------------------|-------------------------|----------|
| `useOrderStore.ts` | `orders`, `courierOrders`, `historicalOrders`, `statusHistory`, `activeOrdersByCourier`, `currentOrder`, loading/sync flags, `isSyncingOrders`, `realtimeStatus`, `_resyncLock` | `from('orders').select(...)` with embeds; `generate_order_number` RPC before insert; `complete_order`, `mark_order_paid`, `settle_order` RPCs; `tracking_logs` insert; `withRetry` on some paths | `subscribeOrders(filter)` → `orders:courier:{id}` or `orders:global`; `postgres_changes` on `orders`; ref-count + stale guard; `subscribeOrderById`; `unsubscribe*` → `supabase.removeChannel` when ref zero |
| `useUserStore.ts` | `users`, `isLoading`, `isLoaded`, `error`, `realtimeStatus`, `_resyncLock` | `profiles` select/upsert; `addUser` → `functions.invoke('create-staff-user')`; `updateUser`/`removeUser` → `update-user-management`; `cacheProfiles` / IndexedDB | `subscribeUsers` (`users:list`), `subscribeProfile(id)` (`profile:single:{id}`); broadcast `ping`; `mapProfileToUser` recomputes courier `is_online` from `courier_status` when trigger-only columns missing from payload |
| `useCustomerStore.ts` | `customers`, `changeRequests`, `isLoaded`, `realtimeStatus`, `_resyncLock` | `customers` CRUD; `customer_change_requests`; IndexedDB helpers in `orderCache` | `subscribeToCustomers`, `subscribeToRequests` (same ref-count pattern as orders) |
| `useNotificationStore.ts` | `notifications`, `isLoading`, `realtimeStatus`, `_resyncLock` | `select`/`insert`/`update` on `notifications`; `cacheNotifications` | `notifications:user:{userId}` channel; merge INSERT/UPDATE/DELETE in handler |
| `useSettingsStore.ts` | `BusinessSettings` (commission, fines, timezone, basecamps, holidays, instructions) + `realtimeStatus` | `fetchSettings` from `settings`; persist middleware holds defaults until hydrated | Channel id `public:settings`; `settingsRefs` ref-count; stale guard; `removeChannel` on last unsubscribe |
| `useCourierStore.ts` | **Getter** `couriers` from `useUserStore` | Wraps `useUserStore` for courier CRUD; `setCourierOffline`/`Online` + `stayNative`; `record_courier_checkin`, `verify_stay_qr` RPCs | None |
| `useShiftStore.ts` | `shifts`, `isLoading` | `shifts` select/insert/update | None |
| `useSessionStore.ts` | `user`, `isAuthenticated` | Persisted session mirror; no direct Supabase | None |
| `useToastStore.ts` | `toasts[]` | `addToast` / `removeToast` / `updateToast`; auto-dismiss via `setTimeout` | None |
| `useAdminAttendanceStore.ts` | `logs`, `missingCouriers`, `isLoading` | `shift_attendance` joins; daily `reset_daily_fine_flags` via localStorage gate; `get_missing_couriers`, `apply_attendance_fine`, `excuse_attendance` | `subscribeToday` → `attendance-today` + postgres_changes |
| `useAttendanceStore.ts` | `todayLog`, `unpaidAttendance`, `isLoading` | `shift_attendance` queries; `settle_attendance_fine` RPC | `subscribeAttendance(courierId)` → channel `attendance_{courierId}` |

**Legacy / unused in UI:** `src/services/api.ts` (axios REST) is not imported by pages.

---

## 3. Multi-tenant SaaS transformation

- **Model:** Shared DB, `organization_id` on tenant-owned rows + `organization_members` for RBAC.  
- **JWT:** Custom Access Token Hook (or equivalent) must set `org_id` and org-scoped `role` for RLS helpers.  
- **Migration:** See [Appendix A](#appendix-a--full-multi-tenant-sql-migration).

---

## 4. Database schema — expanded

**Legend**

| Column | Meaning |
|--------|---------|
| **Row (TS)** | TypeScript `Row` = read shape from client types |
| **Null** | ` \| null` in Row ⇒ column nullable in DB (typical) |
| **Insert req** | Field required on insert if **not** optional in `Insert` type |
| **FK** | From `Relationships` in `supabase.ts` |

**Important:** `scheduled_notifications` exists in migrations but is **not** listed in `src/types/supabase.ts` — regenerate types after schema sync.

---

### 4.1 `attendance_logs`

| Column | Row (TS) | Null | Insert req | Notes / FK |
|--------|----------|------|-------------|--------------|
| `id` | `string` | no | optional (has default gen_random_uuid()) | PK |
| `courier_id` | `string \| null` | yes | optional | FK → `profiles.id` |
| `created_at` | `string \| null` | yes | optional | timestamptz |
| `event_type` | `string` | no | **required** | app-defined string |
| `metadata` | `Json \| null` | yes | optional | JSONB |

**Defaults (typical DB):** `id`, `created_at` server-generated per migrations.

---

### 4.2 `basecamps`

| Column | Row (TS) | Null | Insert req | FK |
|--------|----------|------|-------------|-----|
| `id` | `string` | no | optional | PK |
| `name` | `string` | no | **required** | |
| `description` | `string \| null` | yes | optional | |
| `lat` | `number` | no | **required** | |
| `lng` | `number` | no | **required** | |
| `radius_m` | `number` | no | **required** (Insert allows optional — DB may default) | |
| `is_active` | `boolean \| null` | yes | optional | |
| `created_at` | `string \| null` | yes | optional | |
| `updated_at` | `string \| null` | yes | optional | |
| `created_by` | `string \| null` | yes | optional | |

---

### 4.3 `client_logs`

| Column | Row (TS) | Null | Insert req |
|--------|----------|------|-------------|
| `id` | `string` | no | optional |
| `created_at` | `string` | no | optional (Insert) — often default now() |
| `level` | `string` | no | **required** |
| `message` | `string` | no | **required** |
| `stack_trace` | `string \| null` | yes | optional |
| `url` | `string \| null` | yes | optional |
| `user_id` | `string \| null` | yes | optional |
| `context` | `Json \| null` | yes | optional |

---

### 4.4 `courier_shifts`

| Column | Row (TS) | Null | Insert req | FK |
|--------|----------|------|-------------|-----|
| `id` | `string` | no | optional | PK |
| `courier_id` | `string` | no | **required** | → `profiles.id` |
| `shift_id` | `string` | no | **required** | → `shifts.id` |
| `effective_from` | `string` | no | optional (default) | date |
| `effective_to` | `string \| null` | yes | optional | |

---

### 4.5 `courier_warnings`

| Column | Row (TS) | Null | Insert req | FK |
|--------|----------|------|-------------|-----|
| `id` | `string` | no | optional | PK |
| `courier_id` | `string \| null` | yes | optional | → `profiles.id` |
| `created_by` | `string \| null` | yes | optional | → `profiles.id` |
| `warning_type` | `string \| null` | yes | optional | |
| `message` | `string \| null` | yes | optional | |
| `resolved` | `boolean \| null` | yes | optional | |
| `created_at` | `string \| null` | yes | optional | |

---

### 4.6 `customer_change_requests`

| Column | Row (TS) | Null | Insert req | FK |
|--------|----------|------|-------------|-----|
| `id` | `string` | no | optional | PK |
| `customer_id` | `string \| null` | yes | optional | → `customers.id` |
| `customer_name` | `string \| null` | yes | optional | |
| `requester_id` | `string \| null` | yes | optional | → `profiles.id` |
| `requester_name` | `string \| null` | yes | optional | |
| `change_type` | `string \| null` | yes | optional | |
| `old_data` | `Json` | no | **required** | |
| `requested_data` | `Json` | no | **required** | |
| `new_address` | `Json \| null` | yes | optional | |
| `affected_address_id` | `string \| null` | yes | optional | |
| `order_id` | `string \| null` | yes | optional | → `orders.id` |
| `status` | `string \| null` | yes | optional | DB CHECK: pending/approved/rejected |
| `admin_id` | `string \| null` | yes | optional | → `profiles.id` |
| `admin_notes` | `string \| null` | yes | optional | |
| `reviewed_by` | `string \| null` | yes | optional | → `profiles.id` |
| `reviewed_at` | `string \| null` | yes | optional | |
| `created_at` | `string \| null` | yes | optional | |
| `updated_at` | `string \| null` | yes | optional | |

---

### 4.7 `customers`

| Column | Row (TS) | Null | Insert req |
|--------|----------|------|-------------|
| `id` | `string` | no | optional |
| `name` | `string` | no | **required** |
| `phone` | `string \| null` | yes | optional |
| `addresses` | `Json \| null` | yes | optional |
| `order_count` | `number \| null` | yes | optional |
| `last_order_at` | `string \| null` | yes | optional |
| `created_at` | `string \| null` | yes | optional |
| `updated_at` | `string \| null` | yes | optional |

**DB:** Unique phone constraint may exist (see migrations).

---

### 4.8 `holidays`

| Column | Row (TS) | Null | Insert req | FK |
|--------|----------|------|-------------|-----|
| `id` | `string` | no | optional | PK |
| `date` | `string` | no | **required** | unique date |
| `name` | `string` | no | **required** | |
| `is_national` | `boolean \| null` | yes | optional | |
| `is_active` | `boolean \| null` | yes | optional | |
| `set_by` | `string \| null` | yes | optional | → `profiles.id` |
| `set_at` | `string \| null` | yes | optional | |

---

### 4.9 `notifications`

| Column | Row (TS) | Null | Insert req | FK |
|--------|----------|------|-------------|-----|
| `id` | `string` | no | optional | PK |
| `user_id` | `string \| null` | yes | optional | → `profiles.id` |
| `user_name` | `string \| null` | yes | optional | |
| `title` | `string` | no | **required** | |
| `message` | `string` | no | **required** | |
| `type` | `string \| null` | yes | optional | |
| `data` | `Json \| null` | yes | optional | |
| `is_read` | `boolean \| null` | yes | optional | |
| `sent_at` | `string \| null` | yes | optional | |
| `fcm_status` | `string \| null` | yes | optional | pending/sent/failed/skipped |
| `fcm_error` | `string \| null` | yes | optional | |
| `idempotency_key` | `string \| null` | yes | optional | |

---

### 4.10 `orders`

| Column | Row (TS) | Null | Insert req | FK |
|--------|----------|------|-------------|-----|
| `id` | `string` | no | optional | PK |
| `order_number` | `string` | no | **required** | UNIQUE |
| `customer_id` | `string \| null` | yes | optional | → `customers.id` |
| `customer_name` | `string` | no | **required** | |
| `customer_phone` | `string` | no | **required** | |
| `customer_address` | `string` | no | **required** | |
| `customer_address_id` | `string \| null` | yes | optional | |
| `items` | `Json \| null` | yes | optional | |
| `item_name` | `string \| null` | yes | optional | |
| `item_price` | `number \| null` | yes | optional | |
| `titik` | `number \| null` | yes | optional | |
| `total_biaya_titik` | `number \| null` | yes | optional | |
| `beban` | `Json \| null` | yes | optional | |
| `total_biaya_beban` | `number \| null` | yes | optional | |
| `total_fee` | `number \| null` | yes | optional | |
| `status` | `string \| null` | yes | optional | CHECK: order statuses |
| `payment_status` | `string \| null` | yes | optional | unpaid/paid |
| `courier_id` | `string \| null` | yes | optional | → `profiles.id` |
| `courier_name` | `string \| null` | yes | optional | denormalized |
| `created_by` | `string \| null` | yes | optional | → `profiles.id` |
| `creator_name` | `string \| null` | yes | optional | |
| `assigned_by` | `string \| null` | yes | optional | → `profiles.id` |
| `assigner_name` | `string \| null` | yes | optional | |
| `assignment_instruction` | `string \| null` | yes | optional | |
| `is_waiting` | `boolean \| null` | yes | optional | |
| `notes` | `string \| null` | yes | optional | |
| `estimated_delivery_time` | `string \| null` | yes | optional | |
| `actual_pickup_time` | `string \| null` | yes | optional | |
| `actual_delivery_time` | `string \| null` | yes | optional | |
| `assigned_at` | `string \| null` | yes | optional | |
| `cancelled_at` | `string \| null` | yes | optional | |
| `cancellation_reason` | `string \| null` | yes | optional | |
| `cancel_reason_type` | `string \| null` | yes | optional | |
| `cancelled_by` | `string \| null` | yes | optional | → `profiles.id` |
| `canceller_name` | `string \| null` | yes | optional | |
| `payment_confirmed_by` | `string \| null` | yes | optional | → `profiles.id` |
| `payment_confirmed_by_name` | `string \| null` | yes | optional | |
| `applied_commission_rate` | `number \| null` | yes | optional | |
| `applied_commission_threshold` | `number \| null` | yes | optional | |
| `applied_commission_type` | `string \| null` | yes | optional | |
| `applied_admin_fee` | `number \| null` | yes | optional | |
| `fine_deducted` | `number \| null` | yes | optional | |
| `queue_position_at_assign` | `number \| null` | yes | optional | |
| `created_at` | `string \| null` | yes | optional | |
| `updated_at` | `string \| null` | yes | optional | |

---

### 4.11 `profiles`

| Column | Row (TS) | Null | Insert req | FK |
|--------|----------|------|-------------|-----|
| `id` | `string` | no | **required** | PK, `auth.users` |
| `name` | `string` | no | **required** | |
| `email` | `string \| null` | yes | optional | |
| `phone` | `string \| null` | yes | optional | |
| `role` | `string` | no | **required** (Insert optional — default in DB) | CHECK app roles |
| `is_online` | `boolean \| null` | yes | optional | |
| `is_active` | `boolean \| null` | yes | optional | |
| `courier_status` | `string \| null` | yes | optional | on/stay/off |
| `off_reason` | `string \| null` | yes | optional | |
| `vehicle_type` | `string \| null` | yes | optional | |
| `plate_number` | `string \| null` | yes | optional | |
| `queue_position` | `number \| null` | yes | optional | |
| `queue_joined_at` | `string \| null` | yes | optional | |
| `cancel_count` | `number \| null` | yes | optional | |
| `fcm_token` | `string \| null` | yes | optional | |
| `fcm_token_updated_at` | `string \| null` | yes | optional | |
| `platform` | `string \| null` | yes | optional | |
| `last_active` | `string \| null` | yes | optional | |
| `shift_id` | `string \| null` | yes | optional | → `shifts.id` |
| `stay_basecamp_id` | `string \| null` | yes | optional | → `basecamps.id` |
| `late_fine_active` | `boolean \| null` | yes | optional | |
| `permit_count_no_swap` | `number \| null` | yes | optional | |
| `is_priority_recovery` | `boolean \| null` | yes | optional | |
| `gps_consecutive_out` | `number \| null` | yes | optional | |
| `total_deliveries_alltime` | `number \| null` | yes | optional | |
| `total_earnings_alltime` | `number \| null` | yes | optional | |
| `unpaid_count` | `number \| null` | yes | optional | |
| `unpaid_amount` | `number \| null` | yes | optional | |
| `day_off` | `string \| null` | yes | optional | JSON array of day names |
| `stay_activated_via_qr` | `boolean \| null` | yes | optional | |
| `stay_zone_counter` | `number \| null` | yes | optional | |
| `current_basecamp_id` | `string \| null` | yes | optional | → `basecamps.id` |
| `last_stay_check` | `string \| null` | yes | optional | |
| `created_at` | `string \| null` | yes | optional | |
| `updated_at` | `string \| null` | yes | optional | |
| `organization_id` | `string \| null` | yes | optional | → `organizations.id` (added by multi-tenant migration)

---

### 4.12 `settings`

| Column | Row (TS) | Null | Insert req |
|--------|----------|------|-------------|
| `id` | `string` | no | **required** (legacy `'global'`) | PK |
| `commission_rate` | `number` | no | **required** | |
| `commission_threshold` | `number` | no | **required** | |
| `commission_type` | `string \| null` | yes | optional | |
| `courier_instructions` | `Json \| null` | yes | optional | |
| `operational_area` | `string \| null` | yes | optional | |
| `operational_timezone` | `string \| null` | yes | optional | |
| `billing_start_day` | `number \| null` | yes | optional | ops billing day |
| `fine_late_minor_amount` | `number \| null` | yes | optional | |
| `fine_late_major_minutes` | `number \| null` | yes | optional | |
| `fine_late_major_amount` | `number \| null` | yes | optional | |
| `fine_alpha_amount` | `number \| null` | yes | optional | |
| `service_secret` | `string \| null` | yes | optional | native stay service |
| `radius_m` | `number \| null` | yes | optional | |
| `updated_at` | `string \| null` | yes | optional | |

---

### 4.13 `shift_attendance`

(All columns from `Row` — FKs to `profiles`, `shifts` on `courier_id`, `shift_id`, `cancelled_by`, `resolved_by`, `payment_confirmed_by`.)

| Column | Row (TS) | Null | Insert req |
|--------|----------|------|-------------|
| `id` | `string` | no | optional |
| `courier_id` | `string` | no | **required** |
| `shift_id` | `string` | no | **required** |
| `date` | `string` | no | **required** |
| `first_online_at` | `string \| null` | yes | optional |
| `last_online_at` | `string \| null` | yes | optional |
| `late_minutes` | `number \| null` | yes | optional |
| `status` | `string \| null` | yes | optional |
| `fine_type` | `string \| null` | yes | optional |
| `fine_per_order` | `number \| null` | yes | optional |
| `flat_fine` | `number \| null` | yes | optional |
| `flat_fine_status` | `string \| null` | yes | optional |
| `cancelled_by` | `string \| null` | yes | optional |
| `cancelled_at` | `string \| null` | yes | optional |
| `cancel_reason` | `string \| null` | yes | optional |
| `resolved_by` | `string \| null` | yes | optional |
| `resolved_at` | `string \| null` | yes | optional |
| `notes` | `string \| null` | yes | optional |
| `payment_status` | `string \| null` | yes | optional |
| `payment_confirmed_by` | `string \| null` | yes | optional |
| `payment_confirmed_at` | `string \| null` | yes | optional |

---

### 4.14 `shift_overrides`

| Column | Row (TS) | Null | Insert req | FK |
|--------|----------|------|-------------|-----|
| `id` | `string` | no | optional | PK |
| `date` | `string` | no | **required** | |
| `original_courier_id` | `string` | no | **required** | → `profiles` |
| `replacement_courier_id` | `string` | no | **required** | → `profiles` |
| `original_shift_id` | `string` | no | **required** | → `shifts` |
| `created_by` | `string \| null` | yes | optional | → `profiles` |
| `created_at` | `string \| null` | yes | optional | |

---

### 4.15 `shifts`

| Column | Row (TS) | Null | Insert req |
|--------|----------|------|-------------|
| `id` | `string` | no | optional |
| `name` | `string` | no | **required** |
| `start_time` | `string` | no | **required** |
| `end_time` | `string` | no | **required** |
| `is_overnight` | `boolean \| null` | yes | optional |
| `is_active` | `boolean \| null` | yes | optional |
| `created_at` | `string \| null` | yes | optional |

---

### 4.16 `stay_attendance_logs`

| Column | Row (TS) | Null | Insert req | FK |
|--------|----------|------|-------------|-----|
| `id` | `string` | no | optional | PK |
| `courier_id` | `string` | no | **required** | → `profiles.id` |
| `courier_name` | `string \| null` | yes | optional | |
| `token_id` | `string` | no | **required** | |
| `verified_at` | `string \| null` | yes | optional | |
| `created_at` | `string \| null` | yes | optional | |

---

### 4.17 `stay_qr_tokens`

| Column | Row (TS) | Null | Insert req | FK |
|--------|----------|------|-------------|-----|
| `id` | `string` | no | optional | PK |
| `token` | `string` | no | **required** | |
| `basecamp_id` | `string \| null` | yes | optional | → `basecamps.id` |
| `expires_at` | `string \| null` | yes | optional | |
| `created_by` | `string \| null` | yes | optional | |
| `created_at` | `string \| null` | yes | optional | |

---

### 4.18 `tier_change_log`

| Column | Row (TS) | Null | Insert req | FK |
|--------|----------|------|-------------|-----|
| `id` | `string` | no | optional | PK |
| `courier_id` | `string \| null` | yes | optional | → `profiles.id` |
| `old_status` / `new_status` | `string \| null` | yes | optional | |
| `old_is_priority` / `new_is_priority` | `boolean \| null` | yes | optional | |
| `tier_before` / `tier_after` | `number \| null` | yes | optional | |
| `queue_joined_at_before` / `queue_joined_at_after` | `string \| null` | yes | optional | |
| `reason` | `string \| null` | yes | optional | |
| `trigger_source` | `string \| null` | yes | optional | |
| `source_id` | `string \| null` | yes | optional | |
| `context` | `Json \| null` | yes | optional | |
| `created_at` | `string \| null` | yes | optional | |

---

### 4.19 `tracking_logs`

| Column | Row (TS) | Null | Insert req | FK |
|--------|----------|------|-------------|-----|
| `id` | `string` | no | optional | PK |
| `order_id` | `string \| null` | yes | optional | → `orders.id` |
| `status` | `string` | no | **required** | |
| `changed_by` | `string \| null` | yes | optional | → `profiles.id` |
| `changed_by_name` | `string \| null` | yes | optional | |
| `notes` | `string \| null` | yes | optional | |
| `changed_at` | `string \| null` | yes | optional | |

---

### 4.20 RPC functions (typed in `supabase.ts`)

`apply_attendance_fine`, `assign_order_and_rotate`, `cancel_attendance_fine`, `check_alpha_attendance`, `complete_order`, `excuse_attendance`, `generate_order_number`, `get_auth_user_role`, `get_courier_fines`, `get_missing_couriers`, `get_courier_fines_complete` (used in app; may need regen in types), `mark_order_paid`, `process_shift_alpha`, `record_courier_checkin`, `reset_daily_fine_flags`, `revoke_stay_by_service`, `rotate_courier_queue`, `settle_attendance_fine`, `update_stay_counter`, `verify_stay_qr`.

---

## 5. Authentication & authorization (summary)

- **Login:** `supabase.auth.signInWithPassword`; profile in `profiles`; inactive users signed out in `AuthContext`.  
- **Routes:** `ProtectedRoute` / `AuthRoute` in `App.tsx` by `UserRole`.  
- **Staff creation:** Edge Function `create-staff-user` with JWT + role gate.  
- **Staff updates / deletes:** Edge Function `update-user-management` from `useUserStore.ts` (`updateUser`, `removeUser`).

### 5.1 Supabase Custom Access Token Hook (JWT claims)

This hook is **not** a repo file — it is configured in **Supabase Dashboard → Authentication → Hooks → Customize Access Token (JWT)** as a **HTTPS endpoint** or **Supabase-hosted Deno hook** that Supabase invokes on each token issuance/refresh.

**Input payload (Supabase contract):** JSON body includes at least `user_id` (UUID), `claims` (existing JWT claims object), `authentication_method`, and metadata. The handler must return **`claims`** (modified object) that will be merged into the final JWT.

**KurirMe required additions**

| Claim key | Type | Source in DB | Purpose |
|-----------|------|----------------|----------|
| `org_id` | `string` (UUID) | `organization_members.organization_id` for the user’s **active** org (e.g. first membership, or `user.app_metadata.active_org_id` if you add org switcher) | `request_org_id()` in Postgres (Appendix A) |
| `org_role` | `string` | `organization_members.role` for that row | Optional; `request_org_role()` |

**Example handler logic (pseudocode)**

1. Parse `user_id` from input.  
2. `SELECT organization_id, role FROM organization_members WHERE user_id = $1 ORDER BY joined_at ASC LIMIT 1` (or join `subscriptions` to prefer paying org).  
3. Set `claims.org_id = organization_id::text`, `claims.org_role = lower(role)`.  
4. Return `{ claims }`. Never trust client-supplied org id.

**Client:** After org switch (future), call `supabase.auth.refreshSession()` so the hook re-runs.

### 5.2 Password change — admin Settings vs courier profile

- **`src/pages/courier/CourierProfile.tsx`** — `handleChangePassword` already calls `supabase.auth.updateUser({ password: passwordForm.newPassword })` after validating match and min length 8.  
- **`src/pages/Settings.tsx`** — `PasswordTab` calls parent `handleChangePassword`; that parent handler **still uses `setTimeout` simulation** and does **not** call Supabase. **Required fix:** reimplement like `CourierProfile`: optional `supabase.auth.signInWithPassword({ email: user.email, password: data.currentPassword })` to verify current password (or use `reauthenticate` pattern per Supabase docs), then `supabase.auth.updateUser({ password: data.newPassword })`, then clear form / toast.

---

## 6. Billing, plans & entitlements (KurirMe SaaS)

This section defines commercial packaging for **multi-tenant organizations**. Numeric limits and feature keys are **normative** for product and billing implementation. Enforcement is **defense in depth**: UX gates in the React app (Section 6.5), authoritative checks in Postgres RPCs and Edge Functions (Section 6.6), plus RLS for tenant isolation (Appendix A). The **codebase file names** below are the actual surfaces where gates must be wired once `subscriptions` / `plan_entitlements` exist.

---

### 6.1 Plan definitions

Plans are identified by immutable **`slug`** values: `starter`, `basic`, `pro`, `enterprise`. Display names and prices are shown to customers; **limits** are enforced against `plans` columns (and optionally mirrored in `plan_entitlements` for feature rows of type `limit`).

| Plan slug | Display name | Price (IDR / month) | max_couriers | max_staff | max_orders_per_month | max_customers | max_basecamps | data_retention_days |
|-----------|--------------|---------------------|--------------|-----------|------------------------|---------------|---------------|---------------------|
| `starter` | STARTER (Free) | Rp 0 | 5 | 1 | 200 | 50 | 0 | 30 |
| `basic` | BASIC | Rp 299.000 | 15 | 3 | 1.000 | unlimited (`NULL` in DB) | 0 | 90 |
| `pro` | PRO (most popular) | Rp 699.000 | 50 | 10 | unlimited (`NULL`) | unlimited (`NULL`) | 3 | 365 |
| `enterprise` | ENTERPRISE | Custom (contract) | unlimited (`NULL`) | unlimited (`NULL`) | unlimited (`NULL`) | unlimited (`NULL`) | unlimited (`NULL`) | custom (`NULL` = per contract; store in `subscriptions.metadata` or `organizations.settings`) |

**Notes**

- **Unlimited** numeric caps are represented as **`NULL`** on `plans` (interpreted as “no cap” in application logic).  
- **`max_staff`** counts organization **non-courier staff seats** (roles such as `owner`, `admin`, `admin_kurir`, `finance` as defined in `src/types` / `AuthContext`); **couriers** are capped separately by **`max_couriers`**. The exact counting query must match how `src/components/settings/UsersTab.tsx` and `src/stores/useUserStore.ts` create users via `create-staff-user`.  
- **`max_orders_per_month`** is evaluated in the **organization’s billing timezone** (default Asia/Jakarta unless stored per org in `settings`).  
- **`data_retention_days`** drives scheduled purge jobs for operational history (orders, logs, notifications) — implementation is backend-only until jobs exist; Starter/Basic/Pro use fixed day counts above.

---

### 6.2 Feature key enum & `plan_entitlements` seed

The canonical entitlements table name in the database is **`plan_entitlements`** (one row per `(plan_id, feature_key)`). This is the **entitlements** catalog referenced throughout the PRD.

**Conventions**

- **`feature_key`**: `text`, snake_case, stable forever once shipped (never rename; deprecate by adding a new key).  
- **Boolean features**: row **present** for a plan means **allowed**. Optional: set `limit_value = 1` for clarity; gates treat “row exists” as true.  
- **Limit features**: `limit_value` is the cap for that plan. **`NULL`** means **unlimited** for that limit key on that plan. If a boolean plan does **not** include a feature, **omit** the row (UI + RPC treat as denied).

#### 6.2.1 Enum reference (every key)

| feature_key | Type | Description | Plans that include it |
|-------------|------|-------------|------------------------|
| `order_management` | boolean | Create, list, assign, and complete orders; core order pipeline (`Orders.tsx`, `useOrderStore.ts`, courier order pages). | All (`starter`, `basic`, `pro`, `enterprise`) |
| `customer_directory` | limit | Customer CRUD and address book; **limit** = max active customers (`Customers.tsx`, `useCustomerStore.ts`, `AddOrderModal.tsx` customer picker). | All; **Starter cap 50**; Basic/Pro/Enterprise **unlimited** (`limit_value` NULL) |
| `courier_queue_rotation` | boolean | Queue position and assign/rotate behavior (`assign_order_and_rotate` from `src/pages/Orders.tsx`). | All |
| `customer_change_requests` | boolean | Courier-initiated address/customer change requests and admin approval (`useCustomerStore.ts`, `CustomerApprovalTab.tsx`, `OrderCustomerInfo.tsx`). | `basic`, `pro`, `enterprise` only |
| `shift_management` | boolean | Master shifts, courier shifts, templates (`src/pages/admin/Shifts.tsx`, `src/stores/useShiftStore.ts`). | `basic`, `pro`, `enterprise` |
| `shift_swap` | boolean | Pair swap via `shift_overrides` + paired notifications in `Shifts.tsx`. | `pro`, `enterprise` |
| `attendance_monitoring` | boolean | Live missing/late monitoring UI (`AttendanceMonitoring.tsx`, `useAdminAttendanceStore.ts`). | `basic`, `pro`, `enterprise` |
| `attendance_fines` | boolean | Apply/settle attendance fines (`apply_attendance_fine`, `settle_attendance_fine`, `excuse_attendance` via stores). | `pro`, `enterprise` |
| `holiday_management` | boolean | Holidays CRUD in settings ops (`useSettingsStore.ts`, `GeneralOpsTab.tsx`). | `basic`, `pro`, `enterprise` |
| `basecamp_management` | limit | Basecamp CRUD and selection UX (`GeneralOpsTab.tsx`, `BasecampSelectionModal.tsx`, `BasecampIndicator.tsx`); limit = max basecamps. | **Pro: 3**; **Enterprise: unlimited** (`NULL`); Starter/Basic: **0** (no rows or explicit 0 — treat as no basecamps) |
| `stay_qr_checkin` | boolean | Stay QR scan and verify (`QRScannerModal.tsx`, `verify_stay_qr` in `useCourierStore.ts`, `StayQRDisplay.tsx`). | `pro`, `enterprise` |
| `courier_gps_monitoring` | boolean | Stay/native GPS monitoring hooks (`useStayMonitor.ts`, `stayMonitoring.ts`, `CourierLayout.tsx` / profile flows). | `pro`, `enterprise` |
| `finance_dashboard` | boolean | Finance home KPIs (`FinanceDashboard.tsx`). | `basic`, `pro`, `enterprise` |
| `penagihan_fines` | boolean | Penagihan + courier fines RPC (`FinancePenagihan.tsx`, `get_courier_fines_complete`). | `pro`, `enterprise` |
| `analytics_charts` | boolean | Dashboard and finance charts (`DashboardCharts.tsx`, `FinanceCharts.tsx`, chart sections in `Dashboard.tsx`, `FinanceAnalisa.tsx`). | `pro`, `enterprise` |
| `export_csv` | boolean | CSV-oriented exports (e.g. `Reports.tsx` / `services/api.ts` `reportsApi.exportReport` if used; any future CSV from orders). | `basic`, `pro`, `enterprise` |
| `export_pdf` | boolean | PDF export path (e.g. `Reports.tsx` `handleExportReport` using jsPDF). | `pro`, `enterprise` |
| `push_notifications` | limit | FCM-backed pushes via `notifications` + Edge `notify-courier` (`useNotificationStore.ts`, `Notifications.tsx`, `CourierNotifications.tsx`). **Basic: 100 / org / month**; Pro/Enterprise **unlimited**. | All; limit only on `basic` |
| `scheduled_notifications` | boolean | Rows in `scheduled_notifications` from `Shifts.tsx`; processor `supabase/functions/process-scheduled-notifications/index.ts`. | `pro`, `enterprise` |
| `courier_warnings` | boolean | Automated `courier_warnings` rows (e.g. from `process-alpha` / attendance pipelines in `supabase/functions/process-alpha/index.ts` and related migrations). No dedicated admin TSX today — gate server-side first. | `pro`, `enterprise` |
| `pwa_offline` | boolean | PWA / service worker / `orderCache` usage (`src/lib/orderCache.ts`, `Header.tsx`, `App.tsx` PWA banner). | All |
| `android_native_app` | boolean | Capacitor native build behaviors (`PermissionOnboarding.tsx`, native bridges). | `basic`, `pro`, `enterprise` |
| `system_diagnostics` | boolean | God-view diagnostics page (`SystemDiagnostics.tsx`, route in `App.tsx`). | `enterprise` only |
| `audit_logs` | boolean | Writes to `audit_logs` and any future audit viewer. | `pro`, `enterprise` |

#### 6.2.2 SQL seed — plans

Run after `CREATE TABLE public.plans` (Section 6.3). Prices stored as **`price_idr_month bigint`** (whole rupiah, no cents).

```sql
INSERT INTO public.plans (
  slug, name, description, is_public, sort_order,
  max_couriers, max_staff, max_orders_per_month, max_customers, max_basecamps, data_retention_days,
  price_idr_month
)
VALUES
  ('starter', 'STARTER (Free)', 'Free tier for small teams', true, 10,
   5, 1, 200, 50, 0, 30, 0),
  ('basic', 'BASIC', 'Growing operations', true, 20,
   15, 3, 1000, NULL, 0, 90, 299000),
  ('pro', 'PRO', 'Most popular', true, 30,
   50, 10, NULL, NULL, 3, 365, 699000),
  ('enterprise', 'ENTERPRISE', 'Custom contract', false, 40,
   NULL, NULL, NULL, NULL, NULL, NULL, NULL)
ON CONFLICT (slug) DO NOTHING;
```

#### 6.2.3 SQL seed — `plan_entitlements`

Assumes `plans` rows exist. **`ON CONFLICT (plan_id, feature_key) DO NOTHING`** requires the unique constraint on `(plan_id, feature_key)`.

```sql
INSERT INTO public.plan_entitlements (plan_id, feature_key, limit_value, metadata)
SELECT p.id, 'order_management', 1, '{}'::jsonb FROM public.plans p WHERE p.slug IN ('starter','basic','pro','enterprise')
ON CONFLICT (plan_id, feature_key) DO NOTHING;

INSERT INTO public.plan_entitlements (plan_id, feature_key, limit_value, metadata)
SELECT p.id, 'customer_directory', 50, '{}'::jsonb FROM public.plans p WHERE p.slug = 'starter'
ON CONFLICT (plan_id, feature_key) DO NOTHING;
INSERT INTO public.plan_entitlements (plan_id, feature_key, limit_value, metadata)
SELECT p.id, 'customer_directory', NULL, '{}'::jsonb FROM public.plans p WHERE p.slug IN ('basic','pro','enterprise')
ON CONFLICT (plan_id, feature_key) DO NOTHING;

INSERT INTO public.plan_entitlements (plan_id, feature_key, limit_value, metadata)
SELECT p.id, 'courier_queue_rotation', 1, '{}'::jsonb FROM public.plans p WHERE p.slug IN ('starter','basic','pro','enterprise')
ON CONFLICT (plan_id, feature_key) DO NOTHING;

INSERT INTO public.plan_entitlements (plan_id, feature_key, limit_value, metadata)
SELECT p.id, 'customer_change_requests', 1, '{}'::jsonb FROM public.plans p WHERE p.slug IN ('basic','pro','enterprise')
ON CONFLICT (plan_id, feature_key) DO NOTHING;

INSERT INTO public.plan_entitlements (plan_id, feature_key, limit_value, metadata)
SELECT p.id, 'shift_management', 1, '{}'::jsonb FROM public.plans p WHERE p.slug IN ('basic','pro','enterprise')
ON CONFLICT (plan_id, feature_key) DO NOTHING;
INSERT INTO public.plan_entitlements (plan_id, feature_key, limit_value, metadata)
SELECT p.id, 'shift_swap', 1, '{}'::jsonb FROM public.plans p WHERE p.slug IN ('pro','enterprise')
ON CONFLICT (plan_id, feature_key) DO NOTHING;
INSERT INTO public.plan_entitlements (plan_id, feature_key, limit_value, metadata)
SELECT p.id, 'attendance_monitoring', 1, '{}'::jsonb FROM public.plans p WHERE p.slug IN ('basic','pro','enterprise')
ON CONFLICT (plan_id, feature_key) DO NOTHING;
INSERT INTO public.plan_entitlements (plan_id, feature_key, limit_value, metadata)
SELECT p.id, 'attendance_fines', 1, '{}'::jsonb FROM public.plans p WHERE p.slug IN ('pro','enterprise')
ON CONFLICT (plan_id, feature_key) DO NOTHING;
INSERT INTO public.plan_entitlements (plan_id, feature_key, limit_value, metadata)
SELECT p.id, 'holiday_management', 1, '{}'::jsonb FROM public.plans p WHERE p.slug IN ('basic','pro','enterprise')
ON CONFLICT (plan_id, feature_key) DO NOTHING;

INSERT INTO public.plan_entitlements (plan_id, feature_key, limit_value, metadata)
SELECT p.id, 'basecamp_management', 3, '{}'::jsonb FROM public.plans p WHERE p.slug = 'pro'
ON CONFLICT (plan_id, feature_key) DO NOTHING;
INSERT INTO public.plan_entitlements (plan_id, feature_key, limit_value, metadata)
SELECT p.id, 'basecamp_management', NULL, '{}'::jsonb FROM public.plans p WHERE p.slug = 'enterprise'
ON CONFLICT (plan_id, feature_key) DO NOTHING;

INSERT INTO public.plan_entitlements (plan_id, feature_key, limit_value, metadata)
SELECT p.id, 'stay_qr_checkin', 1, '{}'::jsonb FROM public.plans p WHERE p.slug IN ('pro','enterprise')
ON CONFLICT (plan_id, feature_key) DO NOTHING;
INSERT INTO public.plan_entitlements (plan_id, feature_key, limit_value, metadata)
SELECT p.id, 'courier_gps_monitoring', 1, '{}'::jsonb FROM public.plans p WHERE p.slug IN ('pro','enterprise')
ON CONFLICT (plan_id, feature_key) DO NOTHING;

INSERT INTO public.plan_entitlements (plan_id, feature_key, limit_value, metadata)
SELECT p.id, 'finance_dashboard', 1, '{}'::jsonb FROM public.plans p WHERE p.slug IN ('basic','pro','enterprise')
ON CONFLICT (plan_id, feature_key) DO NOTHING;
INSERT INTO public.plan_entitlements (plan_id, feature_key, limit_value, metadata)
SELECT p.id, 'penagihan_fines', 1, '{}'::jsonb FROM public.plans p WHERE p.slug IN ('pro','enterprise')
ON CONFLICT (plan_id, feature_key) DO NOTHING;
INSERT INTO public.plan_entitlements (plan_id, feature_key, limit_value, metadata)
SELECT p.id, 'analytics_charts', 1, '{}'::jsonb FROM public.plans p WHERE p.slug IN ('pro','enterprise')
ON CONFLICT (plan_id, feature_key) DO NOTHING;
INSERT INTO public.plan_entitlements (plan_id, feature_key, limit_value, metadata)
SELECT p.id, 'export_csv', 1, '{}'::jsonb FROM public.plans p WHERE p.slug IN ('basic','pro','enterprise')
ON CONFLICT (plan_id, feature_key) DO NOTHING;
INSERT INTO public.plan_entitlements (plan_id, feature_key, limit_value, metadata)
SELECT p.id, 'export_pdf', 1, '{}'::jsonb FROM public.plans p WHERE p.slug IN ('pro','enterprise')
ON CONFLICT (plan_id, feature_key) DO NOTHING;

INSERT INTO public.plan_entitlements (plan_id, feature_key, limit_value, metadata)
SELECT p.id, 'push_notifications', 100, '{}'::jsonb FROM public.plans p WHERE p.slug = 'basic'
ON CONFLICT (plan_id, feature_key) DO NOTHING;
INSERT INTO public.plan_entitlements (plan_id, feature_key, limit_value, metadata)
SELECT p.id, 'push_notifications', NULL, '{}'::jsonb FROM public.plans p WHERE p.slug IN ('starter','pro','enterprise')
ON CONFLICT (plan_id, feature_key) DO NOTHING;

INSERT INTO public.plan_entitlements (plan_id, feature_key, limit_value, metadata)
SELECT p.id, 'scheduled_notifications', 1, '{}'::jsonb FROM public.plans p WHERE p.slug IN ('pro','enterprise')
ON CONFLICT (plan_id, feature_key) DO NOTHING;
INSERT INTO public.plan_entitlements (plan_id, feature_key, limit_value, metadata)
SELECT p.id, 'courier_warnings', 1, '{}'::jsonb FROM public.plans p WHERE p.slug IN ('pro','enterprise')
ON CONFLICT (plan_id, feature_key) DO NOTHING;

INSERT INTO public.plan_entitlements (plan_id, feature_key, limit_value, metadata)
SELECT p.id, 'pwa_offline', 1, '{}'::jsonb FROM public.plans p WHERE p.slug IN ('starter','basic','pro','enterprise')
ON CONFLICT (plan_id, feature_key) DO NOTHING;
INSERT INTO public.plan_entitlements (plan_id, feature_key, limit_value, metadata)
SELECT p.id, 'android_native_app', 1, '{}'::jsonb FROM public.plans p WHERE p.slug IN ('basic','pro','enterprise')
ON CONFLICT (plan_id, feature_key) DO NOTHING;
INSERT INTO public.plan_entitlements (plan_id, feature_key, limit_value, metadata)
SELECT p.id, 'system_diagnostics', 1, '{}'::jsonb FROM public.plans p WHERE p.slug = 'enterprise'
ON CONFLICT (plan_id, feature_key) DO NOTHING;
INSERT INTO public.plan_entitlements (plan_id, feature_key, limit_value, metadata)
SELECT p.id, 'audit_logs', 1, '{}'::jsonb FROM public.plans p WHERE p.slug IN ('pro','enterprise')
ON CONFLICT (plan_id, feature_key) DO NOTHING;
```

---

### 6.3 Database schema

Below is **production-style** DDL: `IF NOT EXISTS`, explicit constraints, and indexes for foreign keys and common filters. Adjust schema name if not `public`.

**`plans`** — catalog of sellable tiers (limits + display price).

```sql
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_public boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  max_couriers int,
  max_staff int,
  max_orders_per_month int,
  max_customers int,
  max_basecamps int,
  data_retention_days int,
  price_idr_month bigint,
  legacy_features jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plans_slug_nonempty CHECK (length(trim(slug)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_plans_public_sort ON public.plans (is_public, sort_order);
```

**`plan_entitlements`** — normalized feature/limit matrix (this is the **entitlements** table).

```sql
CREATE TABLE IF NOT EXISTS public.plan_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  limit_value int,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, feature_key),
  CONSTRAINT plan_entitlements_key_nonempty CHECK (length(trim(feature_key)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_plan_entitlements_plan ON public.plan_entitlements (plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_entitlements_key ON public.plan_entitlements (feature_key);
```

**`subscriptions`** — one active subscription row per organization (enforced in application or partial unique index when finalized).

```sql
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('trialing','active','past_due','canceled','paused')),
  billing_cycle text NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly','annual')),
  current_period_start timestamptz NOT NULL DEFAULT date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta',
  current_period_end timestamptz NOT NULL DEFAULT ((date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta') + interval '1 month') AT TIME ZONE 'Asia/Jakarta'),
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  trial_end_at timestamptz,
  grace_until timestamptz,
  external_customer_id text,
  external_subscription_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON public.subscriptions (organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions (status);
```

**`payment_logs`** — provider events and manual adjustments.

```sql
CREATE TABLE IF NOT EXISTS public.payment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  amount_cents bigint NOT NULL,
  currency char(3) NOT NULL DEFAULT 'IDR',
  provider text NOT NULL,
  provider_event_id text,
  status text NOT NULL CHECK (status IN ('pending','succeeded','failed','refunded')),
  invoice_url text,
  receipt_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_logs_provider_event_unique UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_logs_org_created ON public.payment_logs (organization_id, created_at DESC);
```

**`audit_logs`** — compliance trail (paired with `audit_logs` entitlement for UX surfacing).

```sql
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON public.audit_logs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity, entity_id);
```

---

### 6.4 Subscription lifecycle

#### 6.4.1 Organization creation → Starter

When a new `organizations` row is created (signup or migration default org):

1. Insert **`subscriptions`** with `plan_id` = `(SELECT id FROM plans WHERE slug = 'starter')`, `status = 'active'`, `billing_cycle = 'monthly'`, `current_period_start` / `current_period_end` set to the current monthly window in org timezone.  
2. Insert **`payment_logs`** only if there is a charge (Starter has none).  
3. Insert **`audit_logs`** row: `action = 'subscription.created'`, `entity = 'subscription'`, payload includes `plan_slug: starter`.  
4. **Idempotency:** `INSERT … ON CONFLICT DO NOTHING` on a future partial unique index `(organization_id) WHERE status IN ('active','trialing','past_due')` once product locks one active sub per org.

#### 6.4.2 Upgrade

1. Owner selects higher plan in Billing UI (to be added under `Settings.tsx` or dedicated route).  
2. Client starts checkout via Edge (provider); **`payment_logs`** row `pending`.  
3. On successful webhook: update `subscriptions.plan_id`, set `status = 'active'`, roll `current_period_*`, append **`audit_logs`**.  
4. **Immediate capability:** new limits apply **immediately** unless product chooses “next period” — document in UI. KurirMe default: **immediate** for upgrades.

#### 6.4.3 Downgrade and data above new limits

When `plan_id` moves to a **lower** tier (e.g. Pro → Basic):

| Resource | At downgrade effective time | Behavior |
|----------|-----------------------------|----------|
| **Couriers** (profiles with role courier) over `max_couriers` | Effective immediately or at period end (configurable; default **period end** to avoid mid-day disruption) | **Block new assigns** to excess couriers; **existing assigned orders** continue until completed. **UI:** Couriers list shows banner “N couriers over limit — hide from assignment until upgrade or remove seats.” **CTA:** “Upgrade to Pro”. No automatic deletion of user accounts. |
| **Staff** over `max_staff` | Same | **Block** `create-staff-user` and role promotions. **UI:** `UsersTab.tsx` disables “Add user” with paywall modal. **CTA:** “Upgrade to BASIC” or higher. |
| **Customers** over `max_customers` (Starter 50) | | **Block new customer create** and **block imports**; **read** existing customers. **UI:** `Customers.tsx` / `AddOrderModal.tsx` paywall. **CTA:** “Upgrade to BASIC”. |
| **Orders / month** over cap | | **Block new order** insert for remainder of month. **UI:** `AddOrderModal.tsx` / `Orders.tsx`. **CTA:** “Upgrade to PRO” for unlimited. |
| **Basecamps** over cap (Pro→Basic) | | **Freeze** creation/editing; existing basecamps **read-only**; courier flows that require a basecamp show lock. **UI:** `GeneralOpsTab.tsx`. **CTA:** “Upgrade to PRO”. |
| **Scheduled notifications** | | **Stop scheduling** new rows; cron **skips** sends for org until plan allows (soft-disable). **CTA:** “Upgrade to PRO”. |
| **Data retention** | | Purge jobs **do not delete immediately** on downgrade; on next retention window, trim to new `data_retention_days` (async job + `audit_logs`). |

**Product rule:** Downgrade effective **default = end of `current_period_end`** unless payment provider forces immediate; user must confirm modal listing **feature loss**.

#### 6.4.4 Renewal, failed payment, grace (7 days)

1. When subscription period ends without renewal: set `status = 'past_due'` (or provider equivalent), set **`grace_until = now() + interval '7 days'`** at org timezone.  
2. **During grace:** **Reads allowed**; **writes that increase liability or cost** blocked: new orders, new couriers/staff, shift swaps, fines application, scheduled notifications creation, push sends (optional: allow transactional pushes — default **block marketing-style** only). **Finance:** allow **read** `FinancePenagihan.tsx`; **block** `mark_order_paid` / `settle_order` if product requires paid subscription (recommended: **block settlements** during grace).  
3. **After grace with no payment:** `status = 'paused'` (read-only org): block **all** mutations except `payment_logs` / subscription repair and owner billing settings. **CTA:** “Renew BASIC”.

#### 6.4.5 Platform admin manual override (no payment)

Platform `admin` (god role in app) uses internal tool or SQL-safe RPC `admin_set_org_plan(p_org_id, p_plan_slug, p_reason)`:

- Updates `subscriptions.plan_id`, sets `metadata.manual_override = true`, `metadata.override_reason`, `metadata.override_by`.  
- Inserts **`payment_logs`** with `provider = 'manual'`, `amount_cents = 0`, `status = 'succeeded'`, metadata reason **or** skip payment log and rely on **`audit_logs` only** (pick one convention).  
- **Audit:** mandatory `audit_logs` row.  
- Does **not** require provider webhook.

**Full DDL — `public.admin_set_org_plan` (implement in migration; callers must use service role or restricted RPC executed only by platform admin)**

```sql
CREATE OR REPLACE FUNCTION public.admin_set_org_plan(
  p_organization_id uuid,
  p_plan_slug text,
  p_reason text,
  p_actor_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
  v_sub_id uuid;
  v_profile_role text;
BEGIN
  SELECT role INTO v_profile_role FROM public.profiles WHERE id = p_actor_id LIMIT 1;
  IF v_profile_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_plan_id FROM public.plans WHERE slug = p_plan_slug LIMIT 1;
  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'UNKNOWN_PLAN_SLUG';
  END IF;

  SELECT id INTO v_sub_id FROM public.subscriptions
  WHERE organization_id = p_organization_id
  ORDER BY created_at DESC LIMIT 1;

  IF v_sub_id IS NULL THEN
    INSERT INTO public.subscriptions (organization_id, plan_id, status)
    VALUES (p_organization_id, v_plan_id, 'active')
    RETURNING id INTO v_sub_id;
  ELSE
    UPDATE public.subscriptions
    SET plan_id = v_plan_id,
        updated_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'manual_override', true,
          'override_reason', p_reason,
          'override_by', p_actor_id::text,
          'override_at', to_jsonb(now())
        )
    WHERE id = v_sub_id;
  END IF;

  INSERT INTO public.audit_logs (organization_id, actor_id, action, entity, entity_id, payload)
  VALUES (
    p_organization_id,
    p_actor_id,
    'billing.admin_set_plan',
    'subscription',
    v_sub_id::text,
    jsonb_build_object('plan_slug', p_plan_slug, 'reason', p_reason)
  );

  RETURN jsonb_build_object('subscription_id', v_sub_id, 'plan_id', v_plan_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_org_plan(uuid, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_org_plan(uuid, text, text, uuid) TO authenticated;
```

---

### 6.5 Feature gating — frontend implementation

#### 6.5.1 `useEntitlements()` — full implementation spec

**File:** `src/hooks/useEntitlements.ts` (new). Follow the same patterns as `src/hooks/useRealtimeHealth.ts`: small surface, `useMemo`/`useCallback`, reads from `useAuth()` for `user` / `organization_id`, and calls one RPC for server truth.

**Dependencies**

- `import { useEffect, useMemo, useState, useCallback } from 'react'`  
- `import { supabase } from '@/lib/supabaseClient'`  
- `import { useAuth } from '@/context/AuthContext'`  
- Types: `OrgEntitlementsPayload` interface mirroring the JSON in the earlier spec block (`plan_slug`, `subscription_status`, `grace_until`, `limits`, `usage`, `features`).

**State inside the hook**

- `const [data, setData] = useState<OrgEntitlementsPayload | null>(null)`  
- `const [loading, setLoading] = useState(true)`  
- `const [error, setError] = useState<Error | null>(null)`  
- `const orgId = user?.organization_id ?? null` (or JWT claim read via `supabase.auth.getSession()` if you store `org_id` only on token).

**Fetch function**

```ts
const fetchEntitlements = useCallback(async () => {
  if (!orgId) { setData(null); setLoading(false); return; }
  setLoading(true);
  setError(null);
  const { data: row, error: rpcError } = await supabase.rpc('get_org_entitlements', {
    p_organization_id: orgId,
  });
  if (rpcError) setError(rpcError as unknown as Error);
  else setData(row as OrgEntitlementsPayload);
  setLoading(false);
}, [orgId]);
```

`useEffect(() => { void fetchEntitlements(); }, [fetchEntitlements])` on mount/org change; optional `useEffect` subscribing to `visibilitychange` to `refetch` when tab focused.

**Derived helpers (useMemo)**

- `hasFeature(key: string)` — if key is boolean-only: `data?.features?.[key] === true` OR nested `{ enabled: true }` per your RPC shape; for keys stored only in `plan_entitlements`, delegate to RPC’s `features` map.  
- `getLimit(key)` — read `data.limits[key]` or `data.features[key]?.limit`.  
- `isAtOrOverLimit(key)` — compare `usage` vs limit; for `null` limit return false.  
- `isReadOnlyGrace()` — `data.subscription_status === 'past_due' && data.grace_until && new Date(data.grace_until) > new Date()`.

**Return object**

`{ loading, error, entitlements: data, refetch: fetchEntitlements, hasFeature, getLimit, isAtOrOverLimit, isReadOnlyGrace }`.

**Backend prerequisite:** Postgres RPC `get_org_entitlements(p_organization_id uuid) RETURNS jsonb` implemented as `SECURITY DEFINER`, checks caller is member of `p_organization_id`, aggregates `subscriptions` + `plans` + `plan_entitlements`, runs `COUNT(*)` usage queries (couriers, staff, orders in billing month, customers, basecamps, push sends), returns single JSON object.

#### 6.5.1b `PaywallModal` — component spec

**File:** `src/components/billing/PaywallModal.tsx` (new). Compose from existing primitives — same stacking and backdrop behavior as `src/components/ui/Modal.tsx`.

**Props interface**

```ts
export interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureKey: string;           // e.g. 'shift_swap'
  featureLabel: string;         // human label for heading
  recommendedPlanSlug: 'basic' | 'pro' | 'enterprise';
  recommendedPlanName: string;   // display string
  currentUsage?: string;         // optional e.g. "Customers 50/50"
  onPrimaryCta?: () => void;     // default: navigate to /admin/settings?tab=billing or open checkout URL
}
```

**Layout**

- Use `Modal` with `isOpen`, `onClose`, `title={\`Upgrade for ${featureLabel}\`}`, `size="lg"`, `showClose={true}`.  
- Inner content: short explanation paragraph; if `currentUsage`, show `Badge` or muted text line; compact comparison table (plan names vs checkmarks) using `Table` / `TableRow` or static grid with `border-gray-200`.  
- Footer: `Button variant="outline"` “Manage billing” → `onClose` + optional navigate; primary `Button` “Upgrade to {recommendedPlanName}” → `onPrimaryCta` or default navigation.

**Behavior**

- Focus trap inherited from `Modal` (Escape closes).  
- Primary CTA disabled while `isLoading` if parent passes async handler.  
- Does not call Supabase itself — parent decides checkout vs settings.

#### 6.5.2 Gate types — UI behavior

**Boolean gate (`hasFeature(key) === false`)**

- Replace primary action control with **disabled** button + **Lock** icon (`lucide-react` `Lock`).  
- **Tooltip:** `Upgrade to [PLAN]` where `[PLAN]` is the **cheapest plan slug** that enables the feature (derive from static map in `src/constants/planFeatures.ts`).  
- **Navigation:** Sidebar items (`Sidebar.tsx`) should **grey out** or hide routes the role cannot use **and** the plan denies; show badge “Pro” when visible but locked.

**Limit gate (`isAtOrOverLimit(key)`)**

- Show inline **usage** text, e.g. “Customers 50 / 50”.  
- On click of blocked action, open **`PaywallModal`** (new component, e.g. `src/components/billing/PaywallModal.tsx`) with short copy, comparison table snippet, primary CTA **“Upgrade to Pro”** (or Basic / Enterprise per map), secondary “Manage billing”.  
- **Block** the mutation: do not call `supabase.from(...).insert` / `rpc` when over limit.

#### 6.5.3 Code pattern (example)

```tsx
import { Lock } from 'lucide-react';
import { useEntitlements } from '@/hooks/useEntitlements';
import { Button } from '@/components/ui/Button';

export function ShiftSwapButton() {
  const { loading, hasFeature, isReadOnlyGrace } = useEntitlements();
  const allowed = hasFeature('shift_swap') && !isReadOnlyGrace();

  if (loading) return <Button disabled>Loading…</Button>;

  if (!allowed) {
    return (
      <span title="Upgrade to PRO">
        <Button disabled className="gap-2">
          <Lock className="h-4 w-4" />
          Swap shift
        </Button>
      </span>
    );
  }

  return <Button onClick={onSwap}>Swap shift</Button>;
}
```

#### 6.5.4 Gating map — `feature_key` → TSX / TS files (add checks)

| feature_key | Primary UI / store files (gate location) |
|-------------|----------------------------------------|
| `order_management` | `src/pages/Orders.tsx`, `src/components/orders/modals/AddOrderModal.tsx`, `src/stores/useOrderStore.ts`; courier: `CourierOrders.tsx`, `CourierOrderDetail.tsx` |
| `customer_directory` | `src/pages/Customers.tsx`, `src/stores/useCustomerStore.ts`, customer picker in `AddOrderModal.tsx` |
| `courier_queue_rotation` | Assign UI in `Orders.tsx` (`assign_order_and_rotate`) |
| `customer_change_requests` | `src/stores/useCustomerStore.ts`, `src/components/settings/CustomerApprovalTab.tsx`, `src/pages/courier/components/order-detail/OrderCustomerInfo.tsx` |
| `shift_management` | `src/pages/admin/Shifts.tsx`, `src/stores/useShiftStore.ts`, nav in `Sidebar.tsx` |
| `shift_swap` | Swap / override section in `Shifts.tsx` |
| `attendance_monitoring` | `src/pages/admin/AttendanceMonitoring.tsx`, `src/stores/useAdminAttendanceStore.ts`, `Sidebar.tsx` |
| `attendance_fines` | Fine buttons in `AttendanceMonitoring.tsx`; RPC callers in `useAdminAttendanceStore.ts`, `useAttendanceStore.ts` |
| `holiday_management` | `src/components/settings/GeneralOpsTab.tsx`, `src/stores/useSettingsStore.ts` |
| `basecamp_management` | `GeneralOpsTab.tsx`, `BasecampSelectionModal.tsx`, `BasecampIndicator.tsx` |
| `stay_qr_checkin` | `QRScannerModal.tsx`, `StayQRDisplay.tsx`, `useCourierStore.ts` (`verify_stay_qr`) |
| `courier_gps_monitoring` | `useStayMonitor.ts`, `stayMonitoring.ts`, `CourierLayout.tsx`, `PermissionOnboarding.tsx` |
| `finance_dashboard` | `FinanceDashboard.tsx`, finance nav in `Sidebar.tsx` |
| `penagihan_fines` | `FinancePenagihan.tsx` |
| `analytics_charts` | `Dashboard.tsx`, `DashboardCharts.tsx`, `FinanceAnalisa.tsx`, `FinanceCharts.tsx` |
| `export_csv` | `Reports.tsx`, any CSV export wired through `src/services/api.ts` |
| `export_pdf` | `Reports.tsx` (`handleExportReport`) |
| `push_notifications` | `useNotificationStore.ts`, `Notifications.tsx`, `CourierNotifications.tsx`, Edge trigger path (client: before mass notify) |
| `scheduled_notifications` | `Shifts.tsx` (inserts into `scheduled_notifications`) |
| `courier_warnings` | Server-first: `supabase/functions/process-alpha/index.ts`; if admin UI added later, gate that route |
| `pwa_offline` | `App.tsx` (PWA banner), `orderCache.ts` usage in `useOrderStore.ts` — optional soft banner on Starter |
| `android_native_app` | `PermissionOnboarding.tsx`, native entry in `main.tsx` / Capacitor config (disable dangerous native menus on Starter if required) |
| `system_diagnostics` | `SystemDiagnostics.tsx`, route guard in `App.tsx` (already role `admin`; add **plan** gate for Enterprise-only) |
| `audit_logs` | Future viewer page; for now gate **writes** from RPC middleware + `audit_logs` INSERT helper |

---

### 6.6 Feature gating — backend enforcement

#### 6.6.1 RPCs and Edge Functions (must call entitlement helper)

Implement **`assert_org_entitlement(p_org uuid, p_feature text, p_required_limit int DEFAULT NULL)`** returning void or raising `SQLSTATE P0001` with message codes the client can map.

| Surface | File / location | Entitlement keys / limits to enforce |
|---------|-----------------|--------------------------------------|
| `assign_order_and_rotate` | Called from `src/pages/Orders.tsx` | `order_management`, `courier_queue_rotation`; courier count vs `max_couriers` when assigning new courier |
| `generate_order_number` / order insert path | `src/stores/useOrderStore.ts` | `order_management`, `max_orders_per_month` |
| `complete_order` | `useOrderStore.ts` | `order_management` |
| `mark_order_paid`, `settle_order` | `useOrderStore.ts` | `finance_dashboard`; `penagihan_fines` if settling fine-related buckets |
| `get_courier_fines_complete` | `src/pages/finance/FinancePenagihan.tsx` | `penagihan_fines` |
| `apply_attendance_fine`, `excuse_attendance`, `get_missing_couriers`, `reset_daily_fine_flags` | `src/stores/useAdminAttendanceStore.ts` | `attendance_monitoring`; `attendance_fines` for fine apply/settle |
| `settle_attendance_fine` | `src/stores/useAttendanceStore.ts` | `attendance_fines` |
| `record_courier_checkin`, `verify_stay_qr` | `src/stores/useCourierStore.ts` | `stay_qr_checkin`, `courier_gps_monitoring`, `basecamp_management` |
| `auto_shift_end_if_ready` | `supabase/functions/process-auto-shift-end/index.ts` | `shift_management` |
| `create-staff-user` | `supabase/functions/create-staff-user/index.ts` | `max_staff` / `max_couriers` depending on role created; `android_native_app` optional |
| `update-user-management` | `supabase/functions/update-user-management/index.ts` | same seat caps |
| `notify-courier` | `supabase/functions/notify-courier/index.ts` | `push_notifications` monthly cap for Basic |
| `process-scheduled-notifications` | `supabase/functions/process-scheduled-notifications/index.ts` | `scheduled_notifications` |
| `process-shift-attendance` | `supabase/functions/process-shift-attendance/index.ts` | `attendance_monitoring` |
| `process-alpha` | `supabase/functions/process-alpha/index.ts` | `courier_warnings`, `attendance_fines` (if warnings tied to fines) |

Any **new** RPC that mutates tenant data must call **`assert_org_entitlement`** first.

#### 6.6.2 RLS + entitlement pattern

- **RLS** answers: “Is this row in **my** `organization_id`?”  
- **Entitlement** answers: “Is my org **allowed** to do this operation on this plan?”  

**Pattern:** keep RLS as today; add **`CHECK`** via `SECURITY DEFINER` RPCs for mutations that already go through RPC (orders, fines, stay). For **direct `INSERT` from client** (e.g. `scheduled_notifications` in `Shifts.tsx`), either:

- move to RPC `schedule_shift_reminder(...)` that calls `assert_org_entitlement`, or  
- use **RLS policy** with `EXISTS` subquery to active plan + `plan_entitlements` (heavier; RPC preferred).

**Read-only grace:** RPCs consult `subscriptions.status`, `grace_until`; if `now() > grace_until` and unpaid → raise exception `ORG_READ_ONLY`.

---

### 6.7 Over-limit scenarios (exhaustive)

For each **quantitative** limit, the table below defines **UI message**, **block vs warn**, and **CTA** copy. Messages may stay Indonesian in-app; English here is the spec for PM/engineers.

| Limit | When hit | UI message (spec) | Block or warn | CTA button |
|-------|----------|-------------------|----------------|------------|
| **max_couriers** (e.g. Starter 5) | Creating courier via `Couriers.tsx` / `create-staff-user` | “Courier limit reached (5/5) for your plan.” | **Block** create | “Upgrade to BASIC” |
| **max_staff** (Starter 1) | Invite in `UsersTab.tsx` | “Staff seat limit reached.” | **Block** | “Upgrade to BASIC” |
| **max_orders_per_month** (Starter 200, Basic 1000) | New order in `AddOrderModal.tsx` | “Monthly order limit reached (200/200).” | **Block** new order | “Upgrade to PRO” (unlimited) or “Upgrade to BASIC” if on Starter |
| **max_customers** (Starter 50) | New customer in `Customers.tsx` or inline create in `AddOrderModal.tsx` | “Customer directory full (50/50).” | **Block** create | “Upgrade to BASIC” |
| **max_basecamps** (Pro 3; Basic/Starter 0) | Add basecamp in `GeneralOpsTab.tsx` | “Basecamp limit reached.” / “Basecamps not available on your plan.” | **Block** | “Upgrade to PRO” / “Upgrade to ENTERPRISE” |
| **push_notifications** (Basic 100/month) | 101st push send in month (`notify-courier` or client pre-check) | “Push notification quota reached (100/100) this month.” | **Block** send (notification row may still insert with `fcm_status = skipped` — product choice; spec: **block Edge send**) | “Upgrade to PRO” |
| **max_scheduled_notifications_per_day** (if you add per-day cap later from `plans`) | Exceed daily scheduled inserts | “Daily scheduled reminder limit reached.” | **Block** | “Upgrade to PRO” |
| **data_retention_days** (purge job) | Background job deletes old data | Email + in-app banner once: “Older than 30 days removed per Starter retention.” | **Warn** (async) | “Upgrade to BASIC” (90d) / “PRO” (365d) |

**Boolean feature denied (not a numeric limit)** — e.g. `shift_swap` on Basic:

- **Message:** “Shift swap is a Pro feature.”  
- **Block** action.  
- **CTA:** “Upgrade to PRO”.

**`system_diagnostics` on non-Enterprise**

- **Message:** “Diagnostics available on Enterprise.”  
- **Block** route (`SystemDiagnostics.tsx`).  
- **CTA:** “Contact sales for ENTERPRISE”.

**`export_pdf` on Basic**

- **Message:** “PDF export requires Pro.”  
- **Block** `Export Laporan` in `Reports.tsx`.  
- **CTA:** “Upgrade to PRO”.

---

✅ Section 6 rewrite complete.

---

## 7. Firebase / push (summary)

- Tokens on `profiles.fcm_token` (web/native).  
- `notifications` INSERT → trigger → Edge `notify-courier` → FCM.  
- Multi-tenant: move tokens to `fcm_tokens` with `organization_id` + `user_id` (see Appendix migration stub).

---

## 8. Section 8 — Page-by-page (expanded)

**Convention:** “**Direct Supabase**” = calls in this TSX file. “**Via store**” = Zustand store calls `supabase` internally (table/RPC named where known).

---

### Admin shell — `components/layout/Layout.tsx` (wraps `/admin/*`)

**Components:** `Header`, `NavLink` sidebar/mobile drawer, role-based `roleNavItems` (`admin`, `admin_kurir`, `owner`, `finance`), `BasecampIndicator`, `useNetworkStatus`, `useRealtimeHealth`, `getRoleLabel` / `getRoleBadgeColor`, logout button.

**Forms / validation:** None (chrome only).

**Direct Supabase:** None.

**Loading / error / empty:** Network + realtime health boolean; mobile sidebar open state.

**Business rules:** Finance role sees reduced nav (finance + reports + settings + orders per `roleNavItems`); `admin` sees Diagnostics link.

---

### Login — `/` — `src/pages/Login.tsx`

**Components:** Logo `img`, card layout, `Mail`/`Lock` icons, email/password inputs, remember-me checkbox, submit `Button`, `Loader2` when loading, error banner `div`.

**Form fields & validation**

| Field | Client validation |
|-------|-------------------|
| Email | HTML `type="email"` + `required`; on submit regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` |
| Password | `required` (HTML) |
| Remember me | boolean — if true stores `lastLoginEmail` + `lastLoginPassword` in `localStorage` (security debt) |

**Direct Supabase:** `supabase.auth.signInWithPassword({ email: email.toLowerCase().trim(), password })`.

**Loading / error / empty:** `isLoading` disables submit; maps auth error to Indonesian copy (`Invalid login` / `credentials` → fixed message).

**Business rules:** On mount clears legacy keys `lastLoginEmail_${role}`; navigation after login handled by `AuthContext` + `AuthRoute` in `App.tsx`.

---

### Dashboard — `/admin/dashboard` — `src/pages/Dashboard.tsx`

**Components:** `Header`, `Card`/`StatCard`, `Badge`, `Link`, lazy `RevenueChart`/`StatusPieChart` with `ChartSkeleton`, pending customer-change section (approve path if `canApprove`).

**Forms:** Time range toggles `today` | `7days` | `30days` (local state, not a DB form).

**Direct Supabase:** None.

**Data:** `useOrderStore`, `useUserStore`, `useAuth`, `useSettingsStore`, `useCustomerStore`; IndexedDB via `getOrdersForWeek`, `getTopCustomers`, `getTopCouriers` from `@/lib/orderCache`; `fetchPendingRequests()`.

**Loading / error / empty:** `ChartSkeleton` inside `Suspense`; empty chart data when no orders in range (derived zeros).

**Business rules:** `isFinance` / `canApprove` gate UI; `calcAdminEarning` for net revenue; merges `cachedHistorical` with realtime `orders` + `activeOrdersByCourier`; `pendingChangeRequests` from customer store.

---

### Orders — `/admin/orders` — `src/pages/Orders.tsx`

**Components:** `Header`, `Button`, `Pagination`, `OrdersLoading`, lazy `OrderFilters`, `OrderTable`, `OrderListMobile`, `AddOrderModal`, `OrderModal`, `CancelOrderModal`, `BulkSettleModal`, `CourierBadge`, hidden `InvoiceTemplate` + `invoiceRef` for export.

**Form fields (create flow — state `newOrder` in page, passed to `AddOrderModal`)** — validation in `handleCreateOrder` / modal: customer match, address, fee (see modal + handler); page sets `formError` on failure.

**Direct Supabase:** `supabase.rpc('assign_order_and_rotate', { p_order_id, p_courier_id, p_courier_name, p_admin_id, p_admin_name, p_notes })`.

**Via store:** `addOrder`, `updateOrder`, `cancelOrder`, `settleOrder`, `fetchInitialOrders`, `fetchOrdersByDateRange`, `useCustomerStore.upsertCustomer` / addresses, order cache utilities.

**Loading / error / empty**

- `OrdersLoading` for lazy `Suspense`.  
- `cacheStatus`: `missing` → amber panel + “Ambil Data”; `loading` → blue spinner row; `loaded` → small cache note.  
- `formError` on create; assign error → toast “Order sudah di-assign…” if message contains `tidak tersedia`.

**Business rules:** `isOpsAdmin = admin_kurir || admin`; `isFinance = finance || admin`; Export CSV + bulk settle for finance; `ITEMS_PER_PAGE=40`; date filter defaults last month through today; sortable columns; `handleAssign` guards `!selectedOrder || !courierId || isAssigning`.

---

### Couriers — `/admin/couriers` — `src/pages/Couriers.tsx`

**Components:** `Header`, `StatCard`, `Input`, `Table`/`TableEmpty`, `Modal`, `Button`, `Select`, `CourierBadge`, lazy `StayQRDisplay`, performance modal, add-courier modal with password visibility toggle.

**Form (add courier):** `newCourier`: name, email, password, phone, vehicle_type, plate_number, shift_id.

**Validation:** `password.length < 8` → `alert('Password must be at least 8 characters long')` before `addCourier`.

**Direct Supabase:** None in TSX.

**Via store:** `addCourier(courierData, password)` → Edge `create-staff-user` pattern inside store; `updateCourier`, `updateUser`, `setCourierOffline`/`setCourierOnline`, `useShiftStore.fetchShifts`, `getUnpaidOrdersByCourier`, `getOrdersForWeek`.

**Loading / error / empty:** Toast loading for shift update; table empty via `TableEmpty`; stats from merged week orders.

**Business rules:** Suspend: `setCourierOffline(id,'suspended')` + `is_active: false`; Unsuspend: `is_active: true` + `setCourierOnline(id,'on')`; finance-only stat card “Potensi Setoran”; QR Stay modal.

---

### Reports — `/admin/reports` — `src/pages/Reports.tsx`

**Components:** `Header`, `Card`/`StatCard`, `Button`, `Input` (date range), Recharts `BarChart`/`PieChart`, `Table`/`TableEmpty`.

**Forms:** `dateRange.start` / `dateRange.end` (`yyyy-MM-dd`).

**Validation:** `handleApplyFilter` uses `getOrdersByDateRange`; empty → `cacheStatus = 'missing'`.

**Direct Supabase:** None.

**Via store / cache:** `fetchOrdersByDateRange`, `cacheOrdersByDate`, `getCachedOrdersByRange`, `useOrderStore.historicalOrders`.

**Loading / error / empty:** `cacheStatus` `checking`/`missing`/`loading`/`loaded` UI; catch sets `missing`.

**Business rules:** Revenue uses `delivered` + `actual_delivery_time` vs `created_at` per filter logic; top courier by delivered count; CSV export in file tail.

---

### Notifications — `/admin/notifications` — `src/pages/Notifications.tsx`

**Components:** `Header`, `Card`, `Button`, `Input`, `SearchableSelect`, `Textarea`, `Badge`, template quick-fill buttons.

**Form fields:** `selectedCourierId`, `notificationTitle`, `notificationBody`.

**Validation:** `handleSendNotification` early return if `!selectedCourierId || !notificationTitle || !notificationBody`; button `disabled` when incomplete.

**Direct Supabase:** None (insert via store).

**Via store:** `subscribeAllNotifications()` on mount (duplicate subscribe guard noted in comments); `addNotification({ user_id, user_name, title, message, data })` → `useNotificationStore` → `supabase.from('notifications').insert(...)`.

**Loading / error / empty:** `isLoading` on button; `successMessage` auto-clears after 3s; stats cards from in-memory `notifications`.

**Business rules:** Only active couriers in select; push delivery relies on DB trigger (not Vercel API).

---

### Customers — `/admin/customers` — `src/pages/Customers.tsx`

**Components:** `Header`, `Button`, `Card`, `StatCard`, `Input`, `Modal`, `ConfirmModal`, `Pagination`, Lucide icons, customer table + modals for edit/add/requests.

**Forms:** Search; add/edit customer modals (name, phone, addresses — see file body).

**Direct Supabase:** None.

**Via store:** `loadFromLocal`, `syncFromServer`, `fetchPendingRequests`, `upsertCustomer`, `changeRequests`, pagination/sort.

**Loading / error / empty:** `paginatedCustomers.length === 0` → centered empty “Tidak ada data pelanggan.”

**Business rules:** Pending request badges per customer; sort by name/phone/order_count/addresses/created_at.

---

### Settings — `/admin/settings` — `src/pages/Settings.tsx`

**Components:** `Header`, `ConfirmModal`, lazy tabs `ProfileTab`, `PasswordTab`, `UsersTab`, `GeneralOpsTab`, `InstructionsTab`, `StorageTab`, `BusinessTab`, `TabLoading`.

**Forms:** `ProfileTab` / `PasswordTab` / etc. per tab. **Password (admin `Settings.tsx`):** `PasswordTab` collects `currentPassword`, `newPassword`, `confirmPassword`; parent `handleChangePassword` must be aligned with **`src/pages/courier/CourierProfile.tsx`** — validate match + min length 8, then `supabase.auth.updateUser({ password: newPassword })` (and verify current password via `signInWithPassword` if product requires re-auth). **Current code defect:** `Settings.tsx` still simulates success with `setTimeout`; replace stub with the real Supabase flow above.

**Direct Supabase:** `syncSettingsToServer` → `supabase.from('settings').update({...}).eq('id','global')` with fields: commission_*, operational_*, courier_instructions, fine_*, billing_start_day.

**Via store:** `updateUser`, `addUser`, `updateSettings`, `updateCourierInstruction`, cache helpers `clearAllCache`, etc.

**Loading / error / empty:** `TabLoading` in `Suspense`; `message` / `syncMessage` banners; `handleRefreshPush` → dynamic `requestFCMPermission`.

**Business rules:** Tab categories filtered — finance user: **code filters tabs** (`visibleTabs` — see file) hiding ops users/instructions for finance; `syncSettingsToServer` throws on error to show failure toast.

---

### System diagnostics — `/admin/diagnostics` — `src/pages/admin/SystemDiagnostics.tsx`

**Components:** `Header`, `Card`, `Button`, `ConfirmModal`, tabs `health` | `inspector` | `force` | `audit` | `cache`, Lucide icons.

**Forms:** Inspector: `inspectType` + `inspectId`; Force update: `forceOrderId`, `forceStatus` select.

**Validation:** Inspect: empty id → `setInspectError('Please enter a Record ID...')`; Force: empty order id → `setForceMsg('❌ Order ID wajib diisi.')`.

**Direct Supabase**

- Health: `supabase.from('settings').select('id').eq('id','global').single()`  
- Inspector: dynamic `from('orders'|'profiles'|'customers'|'tracking_logs').select('*')` with `.eq`/`.ilike`/`.maybeSingle()`  
- Force / audit paths: `supabase.from('orders').update(...)` and other mutations (see file ~250+)

**Loading / error / empty:** `supabaseOk` tri-state; `inspectError` string; `forceLoading`; IndexedDB `checkIntegrity`.

**Business rules:** **Super-admin surface** — dangerous mutations; role gate only via route (`admin`).

---

### Shifts — `/admin/shifts` — `src/pages/admin/Shifts.tsx`

**Components:** Modals for shift CRUD, assign couriers, swap shifts, lists, sorting, toasts.

**Forms:** `ShiftFormData` (name, start_time, end_time, is_overnight, is_active); `ShiftSwapFormData` (date, courier1_id, courier2_id).

**Direct Supabase**

- `from('shift_overrides').select(...).gte('date', today).order('date')`  
- `from('shift_overrides').insert([...])` for swaps  
- `from('notifications').insert(...)` ×2 (both couriers)  
- `from('scheduled_notifications').insert(...)` ×2 for reminders  
- Additional `supabase` updates (see ~542+)

**Via store:** `useShiftStore` (`fetchShifts`, `addShift`, `updateShift`), `useUserStore` (`updateUser`, `fetchUsers`).

**Loading / error / empty:** `isLoading` from shift store; swap loading flags; toast errors.

**Business rules:** Assign uses `Promise.all` updating `shift_id`; unassign sets `shift_id: null`; swap pairs require two override rows.

---

### Attendance monitoring — `/admin/attendance` — `src/pages/admin/AttendanceMonitoring.tsx`

**Components:** `Modal`, `Badge`, tables, fine dialog with `fineNotes` textarea, missing courier panels (`criticalMissing` ≥60 min late, `warningMissing` 1–59).

**Forms:** Search `searchTerm`; shift filter `selectedShift`; fine notes.

**Direct Supabase:** None.

**Via store:** `useAdminAttendanceStore` — `fetchTodayLogs`, `fetchMissingCouriers`, `subscribeToday`, `applyFine`, `excuseLate` (these call RPCs inside store).

**Loading / error / empty:** `isLoading` from store; `actionLoading` per log id; empty logs UI in table.

**Business rules:** `applyFine` passes `fineType` `per_order` | `flat_major` + optional notes; `excuseLate` requires `user`; interval 60s refresh missing couriers.

---

### Finance dashboard — `/admin/finance` — `src/pages/finance/FinanceDashboard.tsx`

**Components:** `Header`, `Card`/`StatCard`, `Button`, navigate to penagihan.

**Direct Supabase:** None.

**Via cache/store:** `getOrdersForWeek`, `getAllUnpaidOrdersLocal`, `useOrderStore`, `calcAdminEarning`, `isLocalToday`.

**Loading / error / empty:** Early return spinner until `isDataReady`.

**Business rules:** `unpaidByCourier` includes orphan courier ids; paid today filter on `updated_at`.

---

### Finance penagihan — `/admin/finance/penagihan` — `src/pages/finance/FinancePenagihan.tsx`

**Components:** `Header`, `Card`, `Modal`, `Table`, `Input`, `Badge`, `CourierBadge`, expand per courier, confirm modal.

**Direct Supabase:** `supabase.rpc('get_courier_fines_complete', { p_courier_id, p_date_from, p_date_to })` (last 90 days).

**Via store:** `settleOrder`, `useAttendanceStore` for unpaid attendance, etc.

**Loading / error / empty:** `finesLoading`, `finesAccessDenied` if RPC `P0001` / `Unauthorized`; debounced search 300ms.

**Business rules:** Parallel fetch all couriers’ fines; role gate `['admin','owner','admin_kurir','finance']`; filter types `unpaid|paid|all`.

---

### Finance analisa — `/admin/finance/analisa` — `src/pages/finance/FinanceAnalisa.tsx`

**Components:** `Header`, `ErrorBoundary`, `Card`/`StatCard`, lazy `RevenueBarChart`/`PaymentPieChart` from `@/components/finance/FinanceCharts`, `ChartSkeleton` in `Suspense`.

**Forms / validation:** Period selector `Period = '7days' | '30days' | 'thisMonth'` (local state only; no schema validation).

**Direct Supabase:** None.

**Via store / cache:** `useOrderStore`, `useUserStore`, `useSettingsStore`; `getOrdersByDateRange`, `getAllUnpaidOrdersLocal`; merges `periodOrders`, `globalUnpaidOrders`, live `orders` in `useMemo`.

**Loading / error / empty:** `ChartSkeleton` for lazy charts; empty merged order sets yield zeroed analytics in derived `useMemo` blocks.

**Business rules:** `calcCourierEarning` / `calcAdminEarning` with `commission_type` aware settings; listens to `indexeddb-synced` to reload period data.

---

### Courier layout — `/courier/*` — `src/pages/courier/CourierLayout.tsx`

**Components:** Header brand, live status dot, bottom `NavLink` nav, unread badge, logout.

**Direct Supabase:** None.

**Via store:** `useOrderStore`, `useCustomerStore`, `useNotificationStore`, `useUserStore`, `useSessionStore`.

**Business rules:** `isSuspended` from live users; realtime health `orders:courier:{id}` + `customer_requests_all`.

---

### Courier dashboard — `/courier` — `src/pages/courier/CourierDashboard.tsx`

**Components:** `PermissionOnboarding`, `QRScannerModal`, `AttendanceWidget`, `ShiftScheduleWidget`, `ShiftStatusWidget`, `DebugPanel`, off-line modals, order list section.

**Direct Supabase:** None.

**Via store:** `setCourierOffline`/`setCourierOnline`, `useStayMonitor` hook, `requestFCMPermission` on mount, `subscribeProfile`.

**Validation:** Off reasons: preset list + custom; online toggle guards (see file).

**Business rules:** Native-only permission onboarding key `courier_permissions_onboarded`; suspended users still detected via live profile.

---

### Courier orders — `/courier/orders` — `src/pages/courier/CourierOrders.tsx`

**Components:** Search `input`, horizontal filter chips (`all`, `assigned`, `picked_up`, `in_transit`), order cards with `Badge`, `ChevronRight`, navigate to detail on click.

**Form fields & validation:** `searchQuery` — optional text filter on `order_number` / `customer_name` (case-insensitive substring). `activeFilter` toggles status filter; when `all`, only `matchesSearch` applies.

**Direct Supabase:** None.

**Via store:** `useOrderStore` — `activeOrdersByCourier`, `isLoading`.

**Loading / error / empty:** Full-page spinner when `isLoading && myOrders.length === 0` with copy “Memuat pesanan aktif…”; if loaded and filters exclude all orders, list area empty (no dedicated empty-state copy in first 80 lines).

**Business rules:** `myOrders` sorted with `is_waiting` orders first, then `created_at` descending; filter keys use courier-facing labels (“GAS — Penjual”, etc.).

---

### Courier order detail — `/courier/orders/:id` — `src/pages/courier/CourierOrderDetail.tsx`

**Components:** `OrderHeader`, `OrderCustomerInfo`, `OrderItemsList`, `OrderPricingSummary`, `OrderCancelModal`, `OrderMapPanel`, `InvoiceTemplate`, `shareInvoiceNative`.

**Forms:** Cancel flow (`cancelStep`, `cancelReasonType`, `cancelReasonText`), beban/items/ongkir edits with local parsers (`formatRupiah`).

**Direct Supabase:** None.

**Via store:** `subscribeOrderById`, `updateOrderStatus`, `cancelOrder`, `updateBiayaTambahan`, `updateItems`, `updateOngkir`, `updateOrderWaiting`, `updateOrder`, `createAddressChangeRequest`, `upsertCustomer`, `fetchPendingRequests`.

**Loading / error / empty:** `isUpdating`, `isWaitingUpdating`; suspended guard blocks actions; auto-scroll on delivered.

**Business rules:** Order resolution priority: `currentOrder` if id matches, else active list, else history.

---

### Courier notifications — `/courier/notifications` — `src/pages/courier/CourierNotifications.tsx`

**Components:** Title row, “BACA SEMUA” button, empty state card (“KOSONG”), notification list buttons with `Badge`, icons `Bell`/`CheckCircle`/`Clock`.

**Forms:** None (tap actions only).

**Direct Supabase:** None.

**Via store:** `useNotificationStore` — `subscribeNotifications(user.id)` on mount (cleanup on unmount); `markAsRead`, `markAllAsRead`; `useOrderStore.getState()` read for navigation branch.

**Loading / error / empty:** Empty UI when no notifications in last 7 days for user (`sevenDaysAgo` + `isAfter` filter).

**Business rules:** Only `n.user_id === user.id` and `sent_at` within rolling window; on mark read, if `data.orderId` or `data.order_id` present — navigate to `/courier/orders/:id` unless historical order in store is `delivered` or `cancelled`, then navigate to `/courier/earnings` with `state: { activeTab: 'history', highlightOrderId }`.

---

### Courier earnings — `/courier/earnings` — `src/pages/courier/CourierEarnings.tsx`

**Components:** Tabs `summary` | `history`, period `daily` | `weekly`, `InvoiceTemplate` + `invoiceRef`, dynamic `recharts` import, search + status filter, `Badge`, share invoice via `shareInvoiceNative`.

**Form fields & validation:** `searchQuery`, `statusFilter` (`all` | `delivered` | `cancelled`), `period`, `activeTab`; optional `location.state` for highlight (`highlightOrderId`).

**Direct Supabase:** None.

**Via store / cache:** `useAuth`, `useSettingsStore`, `useOrderStore.isSyncing`, `getOrdersByCourierFromLocal(user.id)`, `calcCourierEarning`, toasts `useToastStore`.

**Loading / error / empty:** Local load errors logged to console; chart library loaded async; highlight scroll uses `document.getElementById`.

**Business rules:** `location.state` seeds `activeTab`; listens `indexeddb-synced` to refresh local orders; invoice generation guarded by `isGeneratingInvoice`.

---

### Courier profile — `/courier/profile` — `src/pages/courier/CourierProfile.tsx`

**Tabs:** Profile / Attendance (`shift_attendance` query in attendance tab).

**Direct Supabase**

- `supabase.auth.updateUser({ password })` for password change with validation (`newPassword` vs `confirm`, min 8).  
- `supabase.from('shift_attendance').select('*, shift:shifts(...)').eq('courier_id', user.id).gte('date').lte('date').order('date',{ascending:false})` when attendance tab active.

**Loading / error / empty:** `isLoading`, `isLoadingAttendance`, `message` state with timeout.

**Business rules:** `totalFines` sums flat fines excluding `flat_fine_status === 'cancelled'`; expanded rows toggles.

---

### Courier attendance history — **NOT ROUTED** — `src/pages/courier/CourierAttendanceHistory.tsx`

**Note:** No `<Route>` in `App.tsx` — screen exists for future linking.

**Direct Supabase:** Same pattern as profile attendance: `from('shift_attendance').select(...)` filtered by `user.id` and `dateRange`.

**UI:** Date filter buttons + optional custom `type="date"` inputs; loading spinner; empty states in list.

---

## Design System & Component Library

**Location:** `src/components/ui/`. **Styling:** Tailwind 4 utility classes; composition helper `cn()` from `src/utils/cn.ts` (typically `clsx` + `tailwind-merge`). **Focus:** inputs/buttons use custom class `focus-ring` (defined in global CSS / Tailwind plugin). **Responsive:** components rely on Tailwind breakpoints (`sm:`, `md:`, `lg:`) as used by pages (e.g. `Settings.tsx` `lg:flex-row`, `CourierProfile` grids); primitives themselves are mostly width-fluid (`w-full`) and delegate layout to parents.

### Component inventory

| Component file | Export | Props (summary) | Usage notes |
|----------------|--------|-------------------|-------------|
| `Button.tsx` | `Button` | `variant?: 'primary' \| 'secondary' \| 'danger' \| 'ghost' \| 'outline'`; `size?: 'sm' \| 'md' \| 'lg'`; `isLoading?: boolean`; `leftIcon?`, `rightIcon?`; extends `ButtonHTMLAttributes` | Primary uses emerald palette; `disabled \|\| isLoading` disables button; shows spinner when loading. |
| `Modal.tsx` | `Modal` | `isOpen`, `onClose`, `title?`, `children`, `size?: 'sm' \| 'md' \| 'lg' \| 'xl'`, `showClose?: boolean` | Locks `document.body.overflow`; Escape closes; backdrop click closes; centered panel `rounded-xl shadow-xl`. |
| `ConfirmModal.tsx` | `ConfirmModal` | `isOpen`, `onClose`, `onConfirm`, `title`, `message`, `confirmText?`, `cancelText?`, `variant?: 'danger' \| 'warning' \| 'info' \| 'primary'`, `isLoading?` | Wraps `Modal` `size="sm"` `showClose={false}`; icon + colored header circle; two `Button`s outline + solid. |
| `Card.tsx` | `Card`, `StatCard` | `Card`: `padding?: 'none' \| 'sm' \| 'md' \| 'lg'`, `onClick?`, `isHoverable?`, `className?` | Default white card `rounded-xl shadow-sm border border-gray-200`. `StatCard` adds title/value/trend layout (see file). |
| `Input.tsx` | `Input` (forwardRef) | extends `InputHTMLAttributes`; `label?`, `error?`, `helperText?`, `leftIcon?`, `rightIcon?` | `rounded-xl` `min-h-[44px]`; error state red border; auto `id` from label slug. |
| `Textarea.tsx` | `Textarea` | Same pattern as `Input` for label/error/helper | Multiline `rounded-xl` min height. |
| `Select.tsx` | `Select` (forwardRef) | `label?`, `error?`, **`options: { value, label }[]`**, `placeholder?`, native select attrs | `rounded-xl` `min-h-[44px]`. |
| `SearchableSelect.tsx` | `SearchableSelect` | Searchable dropdown — see file for `options`, `value`, `onChange`, `placeholder`, `disabled` | Combobox with filter input. |
| `Badge.tsx` | `Badge`, `getStatusBadgeVariant`, `getStatusBadgeLabel` | `variant`, `size`, `className` | Pill `rounded-full`; status helper maps order status → variant. |
| `Table.tsx` | `Table`, `TableHead`, `TableBody`, `TableRow`, `TableHeader`, `TableCell`, `TableEmpty` | Presentational; `TableEmpty` accepts `message`, `colSpan` | Border-b rows `hover:bg-gray-50` on clickable rows. |
| `Pagination.tsx` | `Pagination` | Page index, total pages, `onPageChange` (see file) | Icon buttons prev/next. |
| `ToastContainer.tsx` | `ToastContainer` | Reads `useToastStore` | Fixed position list; type icons `info`/`success`/`error`/`warning`/`loading`; ARIA roles. |

### Usage examples

```tsx
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
<Button variant="primary" size="md" isLoading={saving} leftIcon={<Save className="h-4 w-4" />}>Save</Button>
<Modal isOpen={open} onClose={() => setOpen(false)} title="Title" size="md">...</Modal>
```

---

## 9. User flows & integrations (detailed)

External systems referenced: **Supabase Auth & Postgres**, **Supabase Realtime**, **Firebase FCM**, **Capacitor** (native), optional **payment provider** (Stripe/Xendit, etc.) for Section 6.

---

### 9.1 New organization registration (target SaaS flow; `register-organization` Edge not in repo yet)

| Step | Actor | Action | System / data |
|------|--------|--------|----------------|
| 1 | Visitor | Opens marketing signup URL | SPA loads registration form |
| 2 | Visitor | Submits org name, slug, owner email, password | Client validates slug format, email, password strength |
| 3 | Client | Calls signup RPC or Edge Function `register-organization` | **Transaction:** insert `organizations`; insert `auth.users` (or use `signUp` then link); insert `profiles` with `organization_id`; insert `organization_members` (`role = owner`); insert `subscriptions` (`plan_id` = Free, `status = active`); insert default `settings` row for `organization_id` |
| 4 | Supabase Auth | Returns session | JWT issued; **Custom Access Token Hook** adds `org_id`, `org_role` = `owner` |
| 5 | Client | Persists session, sets active org in app state | `supabase.auth` storage; redirect to `/admin/dashboard` or onboarding wizard |
| 6 | Owner | Completes wizard (timezone, commission defaults) | `UPDATE settings` scoped by `organization_id` |
| 7 | System | Sends verification email (if email confirmation enabled) | User must confirm before full access if policy requires |

**Edge cases:** Slug collision → 409 + retry; email already exists → offer “join existing org” flow; hook failure → session without `org_id` → RLS blocks reads until fixed.

**Step-by-step (expanded)** — implementation sequence

1. **Preconditions:** Marketing site or `/register` route loads; Supabase project has Auth email provider configured; Custom Access Token Hook deployed and associated with the project.  
2. **Slug check:** Client normalizes slug (lowercase, hyphen rules); optional RPC returns `{ available: boolean }` before any user creation.  
3. **Auth user:** Call `supabase.auth.signUp({ email, password })` or server-side `inviteUserByEmail` pattern; capture `user.id`.  
4. **Org row:** Insert `organizations` with `name`, `slug`, default `settings` jsonb; on unique violation, abort and show slug error.  
5. **Profile:** Insert `profiles` with `id = user.id`, `organization_id = organizations.id`, `role = 'owner'`, `is_active = true` (or follow existing trigger if present).  
6. **Membership:** Insert `organization_members` with `role = 'owner'`, `joined_at = now()`.  
7. **Billing:** Insert `subscriptions` row pointing at seeded `plans.slug = 'free'`.  
8. **Settings:** Insert one `settings` row for that `organization_id` with defaults (timezone, fees, feature flags).  
9. **Session:** Client receives session; hook adds `org_id`, `org_role`; client stores session and navigates to admin shell.  
10. **Verification:** If email confirmation is on, gate write operations until `user.email_confirmed_at` is set; show “check inbox” state.  
11. **Postcondition:** `SELECT` on tenant tables succeeds only when JWT includes matching `org_id`; first `UPDATE settings` completes under staff RLS.

---

### 9.2 Member invite and onboarding

| Step | Actor | Action | System / data |
|------|--------|--------|----------------|
| 1 | Owner/Admin | Opens Settings → Users, enters invitee email + app role (`finance`, `admin_kurir`, etc.) | UI validates email |
| 2 | Server | Creates invite record | Option A: `organization_members` with `invited_at`, `joined_at` null + magic link token table; Option B: Supabase `inviteUserByEmail` with `app_metadata` default `org_id` |
| 3 | Invitee | Clicks link, sets password | `auth.users` completes; trigger upserts `profiles` with same `organization_id` |
| 4 | Trigger / RPC | Inserts `organization_members` (`role` from invite, `joined_at = now()`) | Unique `(organization_id, user_id)` enforced |
| 5 | Hook | Refreshes JWT if user had stale session | `org_id` present; optional multi-org later via `switch_org` RPC |
| 6 | Invitee | First login | `AuthContext.fetchProfile`; `AppListeners` subscribes Realtime for that org |

**Edge cases:** Invite expired → re-invite; plan limit on members → RPC returns error before insert (Section 6); invitee already in org → idempotent upsert.

**Step-by-step (expanded)**

1. **Preconditions:** Inviter session has JWT `org_id` and app role in `owner` / `admin`; `organization_members` row exists for inviter.  
2. **Plan gate:** Server-side RPC `invite_org_member` (recommended) checks `subscriptions` + `plans` / `plan_entitlements` for `max_members` before any email send.  
3. **Invite artifact:** Persist pending invite (magic token + `expires_at`) or call Supabase Admin `inviteUserByEmail` with `user_metadata.org_id` / `app_metadata.org_id` for the hook to read on first token use.  
4. **Email:** Invitee receives link; opens SPA route `/invite?token=…` or Supabase hosted confirmation.  
5. **Account completion:** Invitee sets password; `auth.users` row becomes confirmed; database trigger or callback creates/updates `profiles` with `organization_id` from metadata (never from client-only body).  
6. **Membership finalize:** Upsert `organization_members` with invited role, `joined_at = now()`; enforce unique `(organization_id, user_id)`.  
7. **JWT refresh:** Client calls `supabase.auth.refreshSession()` or re-login so Custom Access Token Hook emits `org_id` and `org_role` aligned with `organization_members`.  
8. **Realtime:** `AppListeners` (or equivalent) subscribes to `orders`, `notifications`, etc., filtered by `organization_id` in query until hook is universal.  
9. **Postcondition:** Invitee passes RLS on org tables; cannot read other orgs’ rows.

---

### 9.3 Admin: create order and assign courier

| Step | Actor | Action | System / data |
|------|--------|--------|----------------|
| 1 | Admin Kurir / Admin | Navigates to `/admin/orders`, clicks New Order | `AddOrderModal` opens |
| 2 | Admin | Fills customer, address, fee, items; submits | Client validation; may `upsertCustomer` + addresses in `customers` |
| 3 | Store | `insert` into `orders` | `status = pending`, `organization_id` from session, `created_by` = admin id |
| 4 | Realtime | Broadcasts new row | Subscribers refresh lists |
| 5 | Admin | Opens order, chooses courier, confirms assign | `assign_order_and_rotate` RPC (must validate org + locks order) |
| 6 | DB | Updates `orders` (courier, status, queue fields) | Trigger may insert `tracking_logs`, `notifications` for courier |
| 7 | Courier device | Receives Realtime + optional FCM | In-app list updates; push if token valid |

**Edge cases:** Concurrent assign → RPC raises; UI toast and refetch; inactive courier → filter in UI + optional DB check; customer phone duplicate merge policy.

**Step-by-step (expanded)**

1. **Preconditions:** Admin session has `organization_id` in JWT; user has `admin_kurir` or `admin` (or `owner`) per product rules; customer exists or will be upserted in same flow.  
2. **Open modal:** `AddOrderModal` loads customers list via `from('customers').select(...).eq('organization_id', activeOrgId)` (defense in depth until hook-only).  
3. **Customer resolution:** Search by phone/name; if missing, `insert` customer + nested `addresses` with same `organization_id`.  
4. **Order insert:** `insert` into `orders` with `organization_id`, `status = 'pending'`, `created_by`, pricing fields, `customer_id`, optional `courier_id` null.  
5. **RLS check:** `WITH CHECK` on insert policy ensures only staff roles create rows in that org.  
6. **Realtime fan-out:** Subscribed admins and couriers (pending bucket) receive `INSERT` event; UI merges into store.  
7. **Assign action:** Admin selects courier in UI; client calls `assign_order_and_rotate` (or current RPC name) with `order_id`, `courier_id`, and optionally `p_organization_id` once hardened.  
8. **RPC internals (target):** `SELECT … FOR UPDATE` on `orders` where `organization_id = request_org_id()`; verify courier profile in same org and active; set `courier_id`, `status = 'assigned'`, rotation metadata.  
9. **Side effects:** Triggers insert `tracking_logs` and `notifications` rows with same `organization_id`.  
10. **Push path:** Notification insert triggers Edge `notify-courier`; Edge reads `fcm_tokens` for `(organization_id, user_id)`.  
11. **Failure modes:** If RPC returns unique/lock error, UI refetches order and shows “already assigned”; if courier offline, optional warning only (business rule).

---

### 9.4 Courier: accept through delivery (happy path)

| Step | Actor | Action | System / data |
|------|--------|--------|----------------|
| 1 | Courier | Logs in, goes online | `profiles.is_online`, `courier_status` updated via store |
| 2 | Courier | Sees order in `/courier/orders` | Reads from `useOrderStore.activeOrdersByCourier` |
| 3 | Courier | Opens `/courier/orders/:id` | `subscribeOrderById` |
| 4 | Courier | Advances status (assigned → picked_up → in_transit) | `updateOrderStatus` → `orders` + `tracking_logs` |
| 5 | Courier | Marks delivered with notes | May call `complete_order` RPC with commission args |
| 6 | DB | RPC updates order, courier earnings aggregates on `profiles` | Atomic transaction |
| 7 | Courier | Optional: share invoice | `shareInvoiceNative` + hidden `InvoiceTemplate` |

**Edge cases:** Suspended mid-flow → `AuthContext` / layout logout; offline → IndexedDB mirror; invalid status transition → RPC error.

**Step-by-step (expanded)**

1. **Preconditions:** Courier authenticated; JWT `org_id` matches order’s `organization_id`; courier is `orders.courier_id` for that order (or can see `pending` pool per policy).  
2. **Go online:** Client updates `profiles.is_online` / `courier_status` within org-scoped update policy.  
3. **List load:** `useOrderStore` loads active orders: staff sees all; courier sees `pending` plus rows where `courier_id = auth.uid()`.  
4. **Detail subscription:** `subscribeOrderById` opens Realtime channel on `orders` PK; merges server patches into local store.  
5. **Accept / progress:** UI sends allowed transitions only; each action calls `updateOrderStatus` or RPC with `order_id` and target status.  
6. **Server validation:** RPC checks current status, courier ownership, and org; updates `orders`; inserts `tracking_logs` with `organization_id`.  
7. **Delivered:** Courier submits proof notes / signature flags per product; client calls `complete_order` with commission parameters if applicable.  
8. **Settlement data:** RPC writes final amounts, may touch `profiles` aggregates or finance tables inside one transaction.  
9. **Invoice:** Optional native share reads rendered `InvoiceTemplate` HTML/PDF path; no cross-org data in template props.  
10. **Offline:** `orderCache` (IndexedDB) queues mutations; replay when online with conflict handling (refetch if version mismatch).

---

### 9.5 Customer address change (approval)

| Step | Actor | Action | System / data |
|------|--------|--------|----------------|
| 1 | Courier | From order detail requests address change | `createAddressChangeRequest` → `customer_change_requests` (`status = pending`) |
| 2 | Admin | Sees pending on Dashboard / Customers | `useCustomerStore` + Realtime |
| 3 | Admin | Approves or rejects with notes | `UPDATE customer_change_requests`; merge into `customers.addresses` on approve |
| 4 | Courier | Sees updated customer on next fetch | Realtime on customers/requests |

**Edge cases:** Concurrent edits; reject with reason stored in `admin_notes`.

**Step-by-step (expanded)**

1. **Preconditions:** Order in a state where address change is allowed (business rule); courier owns or is assigned to the order.  
2. **Create request:** Courier submits new address payload; client inserts `customer_change_requests` with `organization_id`, `status = 'pending'`, `order_id`, `customer_id`, proposed fields.  
3. **Notify staff:** Optional `notifications` row for admin role or rely on Realtime `INSERT` on `customer_change_requests`.  
4. **Admin triage:** Dashboard or Customers UI lists pending requests with filters by org.  
5. **Review:** Admin opens diff view (old vs proposed); may call customer out-of-band.  
6. **Approve path:** Transaction: update `customer_change_requests.status = 'approved'`; merge structured addresses into `customers.addresses` (json/array per schema); optional `tracking_logs` note.  
7. **Reject path:** Update request `status = 'rejected'`, fill `admin_notes`; courier sees on next fetch/Realtime.  
8. **Courier refresh:** Order detail refetches customer; navigation state cleared.  
9. **Concurrency:** Second pending request for same customer blocked or versioned per product; use `updated_at` optimistic lock if implemented.

---

### 9.6 Finance: settlement and fines

| Step | Actor | Action | System / data |
|------|--------|--------|----------------|
| 1 | Finance | Opens `/admin/finance/penagihan` | Parallel `get_courier_fines_complete` per courier |
| 2 | Finance | Selects unpaid orders / confirms bulk settle | `mark_order_paid` / `settleOrder` paths |
| 3 | Admin | Applies attendance fine from `/admin/attendance` | `apply_attendance_fine` RPC with `p_admin_id` |
| 4 | Courier | Views fines in profile attendance tab | `shift_attendance` SELECT own rows |

**Edge cases:** RPC `P0001` unauthorized role → `finesAccessDenied` flag stops retries; orphan courier on settled orders → Finance dashboard bucket.

**Step-by-step (expanded)**

1. **Preconditions:** User has `finance` (or `admin`/`owner` per policy) in app role; JWT scoped to org.  
2. **Penagihan load:** Page fetches courier list for org; for each courier, calls `get_courier_fines_complete` (or equivalent) with org context.  
3. **Unpaid orders bucket:** Query `orders` where `payment_status = 'unpaid'` and `organization_id` matches; parallelize with care for rate limits.  
4. **Mark paid (single):** Finance selects order(s); client invokes `mark_order_paid` / `settleOrder` RPC; RPC verifies role and org, flips `payment_status`, writes audit metadata.  
5. **Bulk settle:** Either loop with idempotency keys or dedicated batch RPC returning per-id results.  
6. **Attendance fine:** Admin on `/admin/attendance` selects shift row; `apply_attendance_fine` with `p_admin_id` and fine amount; RPC inserts fine ledger tied to `shift_attendance` / org.  
7. **Courier view:** Courier profile attendance tab reads only own `shift_attendance` and related fines under courier SELECT policy.  
8. **Errors:** Map `P0001` to UI banner and disable buttons; log correlation id for support.  
9. **Reporting:** Finance exports respect `organization_id` filter in CSV/Excel generators.

---

### 9.7 Subscription upgrade / downgrade (SaaS)

| Step | Actor | Action | System / data |
|------|--------|--------|----------------|
| 1 | Owner | Opens Billing, chooses Pro | Client loads `plans`, current `subscriptions` |
| 2 | Client | Starts checkout session | Payment provider API; `payment_logs` row `pending` |
| 3 | Provider | Webhook `checkout.session.completed` | Edge verifies signature; `UPDATE subscriptions SET plan_id, status`; `payment_logs` → `succeeded` |
| 4 | System | Next JWT refresh includes entitlements snapshot (optional) | Hook embeds `plan_slug` or client refetches `get_org_entitlements` |
| 5 | Downgrade | Owner schedules at period end | `cancel_at_period_end` + plan change job at `current_period_end` |

**Edge cases:** Webhook replay idempotency via `provider_event_id`; past_due and grace (Section 6).

**Step-by-step (expanded)**

1. **Preconditions:** `plans` and `plan_entitlements` seeded; `subscriptions` row exists for org; payment provider (e.g. Stripe) configured with webhook secret in Edge env.  
2. **Billing UI:** Owner opens Billing; client loads `plans` (catalog) and current `subscriptions` for `organization_id`.  
3. **Checkout start:** Client calls Edge `create-checkout-session` with `organization_id`, `plan_slug`, `success_url`, `cancel_url`; Edge uses **service role** to validate org ownership and create provider session.  
4. **Redirect:** Browser opens provider hosted checkout; user pays.  
5. **Webhook:** Provider calls Edge `billing-webhook`; Edge verifies signature, parses `provider_event_id`.  
6. **Idempotency:** `INSERT payment_logs … ON CONFLICT (provider, provider_event_id) DO NOTHING` or equivalent; exit early if duplicate.  
7. **Apply plan:** In transaction: `UPDATE subscriptions SET plan_id, status, current_period_*` from line items; `UPDATE payment_logs SET status = 'succeeded'`.  
8. **Entitlements:** Optional hook embeds `plan_slug`; or client calls `get_org_entitlements` RPC after success redirect.  
9. **Downgrade:** Owner selects lower plan; set `cancel_at_period_end` or schedule worker at `current_period_end` to swap `plan_id` and trim limits.  
10. **Dunning:** Webhook `invoice.payment_failed` sets `past_due`, `grace_until`; app shows banner and read-only mode per Section 6 matrix.

---

### 9.8 Push notification: trigger to device

| Step | Actor | Action | System / data |
|------|--------|--------|----------------|
| 1 | System or Admin | Inserts row into `notifications` for `user_id` = courier | `title`, `message`, `data` JSON; `organization_id` set |
| 2 | Postgres | `AFTER INSERT` trigger fires | `pg_net` or queue calls Edge `notify-courier` with secret |
| 3 | Edge | Loads `fcm_tokens` (or legacy `profiles.fcm_token`) for user + org | Picks latest token per platform |
| 4 | Edge | POST FCM HTTP v1 | On success: `notifications.fcm_status = sent`; on invalid token: clear token row |
| 5 | Device | FCM delivers; SW or native handler | Foreground `onMessage` / background navigation by `orderId` in data |

**Edge cases:** No token → `fcm_status = skipped`; Edge misconfig → 500; cross-tenant leakage prevented by org-scoped token lookup.

**Step-by-step (expanded)**

1. **Preconditions:** `notifications` row includes `organization_id`, `user_id` (courier), title/body, optional `data.orderId`.  
2. **Trigger:** Postgres `AFTER INSERT` on `notifications` invokes `pg_net.http_post` or enqueues job table pointing at Edge URL with service secret header.  
3. **Edge auth:** Function validates internal HMAC or Supabase **service role** key; rejects anonymous calls.  
4. **Token lookup:** `SELECT token, platform FROM fcm_tokens WHERE organization_id = :row.organization_id AND user_id = :row.user_id ORDER BY last_seen_at DESC` (fallback: legacy `profiles.fcm_token` during migration).  
5. **FCM v1:** Build OAuth2 access token for Firebase project; `POST` messages:send with platform-specific payload (`notification` + `data`).  
6. **Success path:** Update `notifications.fcm_status = 'sent'`, optional `fcm_message_id`.  
7. **Invalid token:** Delete or deactivate offending `fcm_tokens` row; set `fcm_status = 'failed'` with error code.  
8. **No token:** Set `fcm_status = 'skipped'`; do not error the insert transaction.  
9. **Client:** Web SW `onBackgroundMessage` or Capacitor `PushNotifications.addListener`; deep-link using `data.orderId` within same org session only.

---

### 9.9 Shift swap and scheduled reminders

| Step | Actor | Action | System / data |
|------|--------|--------|----------------|
| 1 | Admin | Opens Shifts, submits swap form (date, two couriers) | Validates pair exists |
| 2 | Client | Inserts two `shift_overrides` rows | Notifications inserted for both couriers |
| 3 | Client | Inserts `scheduled_notifications` for reminders | Cron `process-scheduled-notifications` fires at `scheduled_at` |
| 4 | System | Sends reminder notification | Same pipeline as 9.8 |

**Step-by-step (expanded)**

1. **Preconditions:** `shifts` and `courier_shifts` defined for org and date; admin has staff role.  
2. **Swap UI:** Admin picks date and two couriers; client validates both have `courier_shifts` rows that day (or override policy allows gap).  
3. **Write overrides:** Insert two `shift_overrides` rows with `organization_id`, `courier_id`, `shift_date`, `override_type` per schema; idempotent if same swap resubmitted.  
4. **Notify couriers:** Insert two `notifications` rows; trigger fires push per flow 9.8.  
5. **Reminders:** Client inserts `scheduled_notifications` with `organization_id`, `user_id`, `scheduled_at`, template key; RLS `sched_notif_insert_own` or staff policy applies.  
6. **Cron:** Scheduled Edge `process-scheduled-notifications` runs each minute; `SELECT … WHERE scheduled_at <= now() AND processed_at IS NULL FOR UPDATE SKIP LOCKED`.  
7. **Fire:** For each due row, insert live `notifications` and mark scheduled row processed (or delete); respect `max_scheduled_notifications_per_day` from `plans`.  
8. **Failure retry:** Backoff on Edge errors; dead-letter table optional for ops.

---

### 9.10 Stay monitoring and QR verify (courier)

| Step | Actor | Action | System / data |
|------|--------|--------|----------------|
| 1 | Courier | Sets status STAY / scans QR | `verify_stay_qr` RPC; native `stayNative.start` with `service_secret` from `settings` |
| 2 | DB | Logs `stay_attendance_logs`, updates counters | May update `profiles.courier_status` / basecamp linkage |
| 3 | Admin | Generates QR from Stay QR modal | Inserts `stay_qr_tokens` scoped to org basecamp |

**Step-by-step (expanded)**

1. **Preconditions:** Stay feature enabled in `plans.features` / entitlements; `settings` contains `service_secret` or equivalent for native plugin attestation.  
2. **Courier STAY status:** Client updates courier status to STAY when entering geofence or manual toggle; persists via profile update within org policy.  
3. **QR scan:** Capacitor Barcode / camera reads token string; client calls `verify_stay_qr` RPC with `token`, `courier_id`, `organization_id` (or derived server-side).  
4. **RPC validation:** Match `stay_qr_tokens` row by token + `organization_id`; check expiry and basecamp binding; reject replay if single-use.  
5. **Logging:** Insert `stay_attendance_logs` with `courier_id`, `organization_id`, timestamps; optional link to `basecamps.id`.  
6. **Native monitoring:** `stayNative.start` on Android/iOS uses foreground service with periodic GPS sample; batches posts to Edge or direct `insert` to logs table per security review.  
7. **Admin QR mint:** Stay QR modal creates `stay_qr_tokens` with `expires_at`, prints QR JSON URL; staff-only INSERT policy.  
8. **Privacy / battery:** Throttle GPS interval; stop native service on logout or org switch.

---

### 9.11 Integrations map (reference)

| Integration | Purpose |
|-------------|---------|
| Supabase | Auth, DB, Realtime, RPC, Edge Functions |
| Firebase | FCM web + native messaging |
| Capacitor | Push, geolocation, camera, barcode, filesystem |
| IndexedDB (`orderCache`) | Offline order mirror / exports |

---

## Appendix A — Full Fresh Install SQL (Single Paste, Zero Errors)

**Prerequisites**

1. Configure Supabase **Custom Access Token Hook** to add claims: `org_id`, `org_role` (values from `organization_members` for active org).  
2. Re-run `supabase gen types` after applying migration.  
3. **This script creates a complete fresh database** — all tables, columns, functions, RLS policies.

**Important**: Supabase SQL Editor does not support `BEGIN/COMMIT`. All statements run independently.

### A.1 Helper Functions (run FIRST)

```sql
-- Get auth user role from JWT or profiles (ACTUAL FUNCTION FROM DB)
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM profiles WHERE id = auth.uid() AND is_active = true;
$function$;

-- Get organization ID from JWT claims (for Custom Access Token Hook)
CREATE OR REPLACE FUNCTION public.request_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'org_id', '')::uuid;
$$;

-- Get organization role from JWT claims
CREATE OR REPLACE FUNCTION public.request_org_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(lower(trim(current_setting('request.jwt.claims', true)::json->>'org_role')), '');
$$;

-- Check if user is member of organization
CREATE OR REPLACE FUNCTION public.is_org_member(p_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = p_org
      AND m.user_id = auth.uid()
  );
$$;

-- Check if user is staff (non-courier)
CREATE OR REPLACE FUNCTION public.is_org_staff()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.get_auth_user_role() = ANY (ARRAY['owner','admin','admin_kurir','finance']::text[]);
$$;

-- Get org_id directly from profiles (fallback when JWT hook not configured)
-- SECURITY DEFINER prevents RLS recursion on profiles table
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Generate unique order number
CREATE OR REPLACE FUNCTION public.generate_order_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_date_prefix TEXT;
  v_sequence INT;
  v_order_number TEXT;
  v_max_attempts INT := 10;
  v_attempt INT := 0;
BEGIN
  v_date_prefix := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD');
  LOOP
    v_attempt := v_attempt + 1;
    IF v_attempt > v_max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique order number after % attempts', v_max_attempts;
    END IF;
    SELECT COUNT(*) + 1 INTO v_sequence
    FROM orders
    WHERE order_number LIKE v_date_prefix || '%';
    v_order_number := v_date_prefix || '-' || LPAD(v_sequence::TEXT, 4, '0');
    IF NOT EXISTS (SELECT 1 FROM orders WHERE order_number = v_order_number) THEN
      RETURN v_order_number;
    END IF;
  END LOOP;
END;
$function$;

-- Get missing couriers for shift attendance
CREATE OR REPLACE FUNCTION public.get_missing_couriers(p_date date)
 RETURNS TABLE(courier_id uuid, courier_name text, shift_id uuid, shift_name text, shift_start_time time without time zone, minutes_late integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_timezone  TEXT;
  v_now_local TIMESTAMPTZ;
BEGIN
  SELECT operational_timezone INTO v_timezone FROM settings WHERE id = 'global';
  v_timezone  := COALESCE(v_timezone, 'Asia/Makassar');
  v_now_local := NOW() AT TIME ZONE v_timezone;

  RETURN QUERY
  SELECT
    p.id,
    p.name::TEXT,
    s.id,
    s.name::TEXT,
    s.start_time,
    GREATEST(0, EXTRACT(EPOCH FROM (
      v_now_local - (p_date + s.start_time)::TIMESTAMPTZ
    )) / 60)::INT
  FROM profiles p
  JOIN shifts s ON s.id = p.shift_id
  LEFT JOIN shift_attendance sa ON sa.courier_id = p.id AND sa.date = p_date
  WHERE p.role = 'courier'
    AND p.is_active = true
    AND s.is_active = true
    AND v_now_local > (p_date + s.start_time)::TIMESTAMPTZ
    AND (sa.id IS NULL OR sa.first_online_at IS NULL)
    AND COALESCE(p.day_off, '') != TRIM(TO_CHAR(p_date, 'Day'))
    AND NOT EXISTS (
      SELECT 1 FROM shift_overrides so
      WHERE so.original_courier_id = p.id
        AND so.date = p_date
    )

  UNION ALL

  SELECT
    p.id,
    p.name::TEXT,
    s.id,
    s.name::TEXT,
    s.start_time,
    GREATEST(0, EXTRACT(EPOCH FROM (
      v_now_local - (p_date + s.start_time)::TIMESTAMPTZ
    )) / 60)::INT
  FROM shift_overrides so
  JOIN profiles p ON p.id = so.replacement_courier_id
  JOIN shifts s ON s.id = so.original_shift_id
  LEFT JOIN shift_attendance sa ON sa.courier_id = p.id AND sa.date = p_date
  WHERE so.date = p_date
    AND p.is_active = true
    AND s.is_active = true
    AND v_now_local > (p_date + s.start_time)::TIMESTAMPTZ
    AND (sa.id IS NULL OR sa.first_online_at IS NULL);
END;
$function$;

-- mark_order_paid (marks order as paid without settling courier payouts)
CREATE OR REPLACE FUNCTION public.mark_order_paid(p_order_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $function$
DECLARE
  v_order RECORD;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order tidak ditemukan';
  END IF;

  IF v_order.payment_status = 'paid' THEN
    RAISE EXCEPTION 'Order sudah lunas';
  END IF;

  UPDATE public.orders 
  SET payment_status = 'paid', 
      updated_at = NOW() 
  WHERE id = p_order_id;
END;
$function$;

-- execute_sql (dynamic SQL execution - used by Edge Functions for timezone-aware queries)
CREATE OR REPLACE FUNCTION public.execute_sql(p_query text, p_params jsonb DEFAULT '{}'::jsonb)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  EXECUTE p_query INTO v_result USING p_params;
  RETURN COALESCE(v_result, '[]'::jsonb);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM, 'detail', SQLSTATE);
END;
$function$;

-- 1) Core org & billing tables (IF NOT EXISTS - safe for re-runs)
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  billing_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','admin','member')),
  invited_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_public boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  max_members int,
  max_couriers int,
  max_orders_per_month int,
  max_customers int,
  max_basecamps int,
  data_retention_days int,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.plan_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  limit_value int,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, feature_key)
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('trialing','active','past_due','canceled','paused')),
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','annual')),
  current_period_start timestamptz NOT NULL DEFAULT date_trunc('month', now()),
  current_period_end timestamptz NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  trial_end_at timestamptz,
  grace_until timestamptz,
  external_customer_id text,
  external_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  amount_cents bigint NOT NULL,
  currency char(3) NOT NULL DEFAULT 'IDR',
  provider text NOT NULL,
  provider_event_id text,
  status text NOT NULL CHECK (status IN ('pending','succeeded','failed','refunded')),
  invoice_url text,
  receipt_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON public.subscriptions(organization_id);

-- 2) Seed plans (aligned with Section 6.1 - actual DB schema)
INSERT INTO public.plans (slug, name, max_members, max_couriers, max_orders_per_month, max_customers, max_basecamps, data_retention_days)
VALUES
  ('starter', 'STARTER (Free)', 1, 5, 200, 50, 0, 30),
  ('basic', 'BASIC', 3, 15, 1000, NULL, 0, 90),
  ('pro', 'PRO', 10, 50, NULL, NULL, 3, 365),
  ('enterprise', 'ENTERPRISE', NULL, NULL, NULL, NULL, NULL, NULL)
ON CONFLICT (slug) DO NOTHING;

-- 3) Default organization + membership (idempotent)
INSERT INTO public.organizations (name, slug)
VALUES ('Default Organization', 'default')
ON CONFLICT (slug) DO NOTHING;

-- Backfill profiles.organization_id for existing users
DO $$
DECLARE
  v_org uuid;
BEGIN
  SELECT id INTO v_org FROM public.organizations WHERE slug = 'default' LIMIT 1;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Default organization missing';
  END IF;

  -- Assign profiles without organization to default org
  INSERT INTO public.organization_members (organization_id, user_id, role)
  SELECT v_org, p.id,
    CASE WHEN p.role = 'owner' THEN 'owner' ELSE 'member' END
  FROM public.profiles p
  WHERE p.organization_id IS NULL
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  -- Update profiles organization_id
  UPDATE public.profiles
  SET organization_id = v_org
  WHERE organization_id IS NULL;
END $$;

-- 3b) Tenant tables (CREATE IF NOT EXISTS - must be created before section 4 ALTER TABLE)
-- These are the actual table definitions from the database schema

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  name character varying NOT NULL,
  email character varying,
  phone character varying,
  role character varying NOT NULL DEFAULT 'courier' CHECK (role IN ('owner','admin','admin_kurir','finance','courier')),
  is_online boolean DEFAULT false,
  is_active boolean DEFAULT true,
  courier_status character varying,
  off_reason text,
  vehicle_type character varying,
  plate_number character varying,
  queue_position bigint,
  fcm_token character varying,
  fcm_token_updated_at timestamptz,
  total_deliveries_alltime integer DEFAULT 0,
  total_earnings_alltime bigint DEFAULT 0,
  unpaid_count integer DEFAULT 0,
  unpaid_amount bigint DEFAULT 0,
  platform character varying,
  last_active timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_priority_recovery boolean DEFAULT false,
  queue_joined_at timestamptz,
  cancel_count integer DEFAULT 0,
  shift_id uuid,
  late_fine_active boolean DEFAULT false,
  permit_count_no_swap integer DEFAULT 0,
  gps_consecutive_out integer DEFAULT 0,
  last_stay_check timestamptz,
  stay_activated_via_qr boolean DEFAULT false,
  stay_basecamp_id uuid,
  day_off text,
  stay_zone_counter integer DEFAULT 0,
  current_basecamp_id uuid,
  organization_id uuid
);

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  phone character varying,
  addresses jsonb DEFAULT '[]'::jsonb,
  order_count integer DEFAULT 0,
  last_order_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  organization_id uuid
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number character varying NOT NULL,
  customer_id uuid,
  customer_name character varying NOT NULL,
  customer_phone character varying NOT NULL,
  customer_address text NOT NULL,
  customer_address_id text,
  items jsonb DEFAULT '[]'::jsonb,
  titik integer DEFAULT 1,
  total_biaya_titik integer DEFAULT 0,
  beban jsonb DEFAULT '[]'::jsonb,
  total_biaya_beban integer DEFAULT 0,
  total_fee integer DEFAULT 0,
  status character varying DEFAULT 'pending' CHECK (status IN ('pending','assigned','picked_up','in_transit','delivered','cancelled')),
  payment_status character varying DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid')),
  courier_id uuid,
  created_by uuid,
  is_waiting boolean DEFAULT false,
  notes text,
  applied_commission_rate integer,
  applied_commission_threshold integer,
  estimated_delivery_time timestamptz,
  actual_pickup_time timestamptz,
  actual_delivery_time timestamptz,
  assigned_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  cancel_reason_type character varying,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  applied_commission_type character varying,
  applied_admin_fee bigint,
  fine_deducted integer DEFAULT 0,
  item_name text,
  item_price integer,
  assigned_by uuid,
  payment_confirmed_by uuid,
  cancelled_by uuid,
  creator_name text,
  assigner_name text,
  courier_name text,
  canceller_name text,
  payment_confirmed_by_name text,
  assignment_instruction text,
  queue_position_at_assign integer,
  organization_id uuid
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_name character varying,
  title character varying NOT NULL,
  message text NOT NULL,
  type character varying DEFAULT 'info',
  data jsonb DEFAULT '{}'::jsonb,
  is_read boolean DEFAULT false,
  sent_at timestamptz DEFAULT now(),
  fcm_status text DEFAULT 'pending',
  fcm_error text,
  organization_id uuid
);

CREATE TABLE IF NOT EXISTS public.tracking_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  status character varying NOT NULL,
  changed_by uuid,
  changed_by_name character varying,
  notes text,
  changed_at timestamptz DEFAULT now(),
  organization_id uuid
);

CREATE TABLE IF NOT EXISTS public.customer_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid,
  customer_name character varying,
  requester_id uuid,
  requester_name character varying,
  change_type character varying,
  old_data jsonb DEFAULT '{}'::jsonb,
  requested_data jsonb DEFAULT '{}'::jsonb,
  new_address jsonb,
  affected_address_id text,
  order_id uuid,
  status character varying DEFAULT 'pending',
  admin_id uuid,
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  organization_id uuid
);

CREATE TABLE IF NOT EXISTS public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  is_overnight boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  organization_id uuid
);

CREATE TABLE IF NOT EXISTS public.courier_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL,
  shift_id uuid NOT NULL,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  organization_id uuid
);

CREATE TABLE IF NOT EXISTS public.shift_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  original_courier_id uuid NOT NULL,
  replacement_courier_id uuid NOT NULL,
  original_shift_id uuid NOT NULL,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  organization_id uuid
);

CREATE TABLE IF NOT EXISTS public.shift_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL,
  shift_id uuid NOT NULL,
  date date NOT NULL,
  first_online_at timestamptz,
  last_online_at timestamptz,
  late_minutes integer DEFAULT 0,
  status text DEFAULT 'on_time',
  fine_type text,
  fine_per_order integer DEFAULT 0,
  flat_fine integer DEFAULT 0,
  flat_fine_status text DEFAULT 'active',
  cancelled_by uuid,
  cancelled_at timestamptz,
  cancel_reason text,
  resolved_by uuid,
  resolved_at timestamptz,
  notes text,
  payment_status text DEFAULT 'unpaid',
  payment_confirmed_at timestamptz,
  payment_confirmed_by uuid,
  organization_id uuid
);

CREATE TABLE IF NOT EXISTS public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  name text NOT NULL,
  is_national boolean DEFAULT true,
  is_active boolean DEFAULT false,
  set_by uuid,
  set_at timestamptz,
  organization_id uuid
);

CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  event_type text NOT NULL,
  metadata jsonb,
  organization_id uuid
);

CREATE TABLE IF NOT EXISTS public.stay_attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL,
  courier_name text,
  token_id uuid NOT NULL,
  verified_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  organization_id uuid
);

CREATE TABLE IF NOT EXISTS public.stay_qr_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL,
  basecamp_id uuid NOT NULL,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  is_used boolean DEFAULT false,
  used_by_courier_id uuid,
  used_at timestamptz,
  organization_id uuid
);

CREATE TABLE IF NOT EXISTS public.basecamps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  radius_m integer NOT NULL DEFAULT 15,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid,
  organization_id uuid
);

CREATE TABLE IF NOT EXISTS public.tier_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid,
  old_status text,
  new_status text,
  old_is_priority boolean,
  new_is_priority boolean,
  tier_before integer,
  tier_after integer,
  queue_joined_at_before timestamptz,
  queue_joined_at_after timestamptz,
  reason text,
  trigger_source text,
  source_id uuid,
  context jsonb,
  created_at timestamptz DEFAULT now(),
  happened_at timestamptz,
  organization_id uuid
);

CREATE TABLE IF NOT EXISTS public.courier_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid,
  created_by uuid,
  warning_type text,
  message text,
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  organization_id uuid
);

CREATE TABLE IF NOT EXISTS public.client_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  level text NOT NULL,
  message text NOT NULL,
  stack_trace text,
  context jsonb,
  user_id uuid,
  url text,
  organization_id uuid
);

CREATE TABLE IF NOT EXISTS public.settings (
  id text PRIMARY KEY,
  commission_rate integer NOT NULL,
  commission_threshold integer NOT NULL,
  commission_type text,
  courier_instructions jsonb DEFAULT '{}'::jsonb,
  operational_area text,
  operational_timezone text DEFAULT 'Asia/Makassar',
  billing_start_day integer,
  fine_late_minor_amount integer,
  fine_late_major_minutes integer,
  fine_late_major_amount integer,
  fine_alpha_amount integer,
  service_secret text,
  radius_m integer,
  updated_at timestamptz,
  organization_id uuid
);

CREATE TABLE IF NOT EXISTS public.scheduled_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info',
  data jsonb DEFAULT '{}'::jsonb,
  scheduled_at timestamptz NOT NULL,
  sent boolean DEFAULT false,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  organization_id uuid
);

-- 4) Ensure organization_id column exists on all tenant tables
-- These are no-op if column already exists and populated
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.tracking_logs ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.customer_change_requests ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
-- Note: profiles.organization_id already exists in DB schema (check via information_schema)
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.courier_shifts ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.shift_overrides ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.shift_attendance ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.holidays ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.stay_attendance_logs ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.stay_qr_tokens ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.basecamps ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.tier_change_log ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.courier_warnings ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.client_logs ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- scheduled_notifications (if table exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='scheduled_notifications') THEN
    EXECUTE 'ALTER TABLE public.scheduled_notifications ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id)';
  END IF;
END $$;

-- 5) Backfill organization_id from default org
DO $$
DECLARE v_org uuid;
BEGIN
  SELECT id INTO v_org FROM public.organizations WHERE slug = 'default' LIMIT 1;
  -- Only update rows where organization_id is NULL
  UPDATE public.customers SET organization_id = v_org WHERE organization_id IS NULL;
  UPDATE public.orders SET organization_id = v_org WHERE organization_id IS NULL;
  UPDATE public.tracking_logs SET organization_id = v_org WHERE organization_id IS NULL;
  UPDATE public.notifications SET organization_id = v_org WHERE organization_id IS NULL;
  UPDATE public.customer_change_requests SET organization_id = v_org WHERE organization_id IS NULL;
  -- Note: profiles.organization_id should already be populated from section 3
  UPDATE public.settings SET organization_id = v_org WHERE organization_id IS NULL;
  UPDATE public.shifts SET organization_id = v_org WHERE organization_id IS NULL;
  UPDATE public.courier_shifts SET organization_id = v_org WHERE organization_id IS NULL;
  UPDATE public.shift_overrides SET organization_id = v_org WHERE organization_id IS NULL;
  UPDATE public.shift_attendance SET organization_id = v_org WHERE organization_id IS NULL;
  UPDATE public.holidays SET organization_id = v_org WHERE organization_id IS NULL;
  UPDATE public.attendance_logs SET organization_id = v_org WHERE organization_id IS NULL;
  UPDATE public.stay_attendance_logs SET organization_id = v_org WHERE organization_id IS NULL;
  UPDATE public.stay_qr_tokens SET organization_id = v_org WHERE organization_id IS NULL;
  UPDATE public.basecamps SET organization_id = v_org WHERE organization_id IS NULL;
  UPDATE public.tier_change_log SET organization_id = v_org WHERE organization_id IS NULL;
  UPDATE public.courier_warnings SET organization_id = v_org WHERE organization_id IS NULL;
  UPDATE public.client_logs SET organization_id = v_org WHERE organization_id IS NULL;
  IF to_regclass('public.scheduled_notifications') IS NOT NULL THEN
    UPDATE public.scheduled_notifications SET organization_id = v_org WHERE organization_id IS NULL;
  END IF;
END $$;

-- 6) Enforce NOT NULL (only if you want to require org on all rows)
-- ALTER TABLE public.customers ALTER COLUMN organization_id SET NOT NULL;
-- ALTER TABLE public.orders ALTER COLUMN organization_id SET NOT NULL;

-- 7) settings: unique per org
CREATE UNIQUE INDEX IF NOT EXISTS uq_settings_org ON public.settings(organization_id);

-- 8) FCM tokens (tenant-scoped)
CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('web','android','ios')),
  device_label text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_org_user ON public.fcm_tokens(organization_id, user_id);
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- 9) JWT + app role helpers (requires Custom Access Token Hook: claims `org_id`, optional `org_role`)
CREATE OR REPLACE FUNCTION public.request_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'org_id', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.request_org_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(lower(trim(current_setting('request.jwt.claims', true)::json->>'org_role')), '');
$$;

CREATE OR REPLACE FUNCTION public.app_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.organization_id = public.request_org_id()
    AND (p.is_active IS DISTINCT FROM false)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(p_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = p_org
      AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_staff()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.app_user_role() = ANY (ARRAY['owner','admin','admin_kurir','finance']::text[]);
$$;

-- 10) Drop ALL existing policies on tenant + billing tables (dynamic)
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'orders','profiles','customers','settings','notifications',
        'tracking_logs','customer_change_requests','shift_attendance',
        'shifts','courier_shifts','shift_overrides','holidays',
        'attendance_logs','stay_attendance_logs','stay_qr_tokens',
        'basecamps','tier_change_log','courier_warnings','client_logs',
        'fcm_tokens','organizations','organization_members',
        'subscriptions','payment_logs','plans','plan_entitlements','scheduled_notifications'
      )
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 11) RLS — catalog & org shell
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY plans_select_authenticated ON public.plans
  FOR SELECT TO authenticated USING (true);

ALTER TABLE public.plan_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY plan_entitlements_select_authenticated ON public.plan_entitlements
  FOR SELECT TO authenticated USING (true);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY orgs_select_member ON public.organizations
  FOR SELECT TO authenticated
  USING (public.is_org_member(id));
CREATE POLICY orgs_update_owner_jwt_or_staff ON public.organizations
  FOR UPDATE TO authenticated
  USING (
    public.is_org_member(id)
    AND (
      public.request_org_role() = 'owner'
      OR (public.request_org_id() = id AND public.is_org_staff() AND public.app_user_role() = 'owner')
    )
  )
  WITH CHECK (public.is_org_member(id));

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY om_select_same_org ON public.organization_members
  FOR SELECT TO authenticated
  USING (organization_id = public.request_org_id());
CREATE POLICY om_insert_staff ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.request_org_id()
    AND public.is_org_staff()
    AND public.app_user_role() = ANY (ARRAY['owner','admin']::text[])
  );
CREATE POLICY om_update_staff ON public.organization_members
  FOR UPDATE TO authenticated
  USING (organization_id = public.request_org_id() AND public.is_org_staff() AND public.app_user_role() = ANY (ARRAY['owner','admin']::text[]))
  WITH CHECK (organization_id = public.request_org_id());
CREATE POLICY om_delete_staff ON public.organization_members
  FOR DELETE TO authenticated
  USING (organization_id = public.request_org_id() AND public.is_org_staff() AND public.app_user_role() = 'owner');

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subs_select_staff ON public.subscriptions
  FOR SELECT TO authenticated
  USING (organization_id = public.request_org_id() AND public.is_org_staff());
CREATE POLICY subs_all_service ON public.subscriptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY pay_select_finance_owner ON public.payment_logs
  FOR SELECT TO authenticated
  USING (
    organization_id = public.request_org_id()
    AND public.is_org_staff()
    AND public.app_user_role() = ANY (ARRAY['owner','finance','admin']::text[])
  );
CREATE POLICY pay_all_service ON public.payment_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 12) RLS — fcm_tokens (no cross-tenant token reuse)
CREATE POLICY fcm_select_own ON public.fcm_tokens
  FOR SELECT TO authenticated
  USING (organization_id = public.request_org_id() AND user_id = auth.uid());
CREATE POLICY fcm_insert_own ON public.fcm_tokens
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.request_org_id() AND user_id = auth.uid());
CREATE POLICY fcm_update_own ON public.fcm_tokens
  FOR UPDATE TO authenticated
  USING (organization_id = public.request_org_id() AND user_id = auth.uid())
  WITH CHECK (organization_id = public.request_org_id() AND user_id = auth.uid());
CREATE POLICY fcm_delete_own ON public.fcm_tokens
  FOR DELETE TO authenticated
  USING (organization_id = public.request_org_id() AND user_id = auth.uid());
CREATE POLICY fcm_service_all ON public.fcm_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 13) RLS — orders (parity with legacy: staff all orders; courier pending + own; finance payment on unpaid)
CREATE POLICY orders_select_tenant ON public.orders FOR SELECT TO authenticated
USING (
  organization_id = public.request_org_id()
  AND (
    public.is_org_staff()
    OR (
      public.app_user_role() = 'courier'
      AND (status = 'pending' OR courier_id = auth.uid())
    )
  )
);

CREATE POLICY orders_insert_ops ON public.orders FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.request_org_id()
  AND public.is_org_staff()
  AND public.app_user_role() = ANY (ARRAY['owner','admin','admin_kurir']::text[])
);

CREATE POLICY orders_update_ops_finance_courier ON public.orders FOR UPDATE TO authenticated
USING (
  organization_id = public.request_org_id()
  AND (
    (public.is_org_staff() AND public.app_user_role() = ANY (ARRAY['owner','admin','admin_kurir']::text[]))
    OR (public.is_org_staff() AND public.app_user_role() = 'finance' AND orders.payment_status = 'unpaid')
    OR (
      public.app_user_role() = 'courier'
      AND orders.courier_id = auth.uid()
      AND orders.status = ANY (ARRAY['assigned','picked_up','in_transit']::text[])
    )
  )
)
WITH CHECK (organization_id = public.request_org_id());

-- 14) RLS — profiles
-- NOTE: COALESCE(request_org_id(), get_my_org_id()) allows login BEFORE
-- JWT Custom Access Token Hook is configured (fresh install friendly)
CREATE POLICY profiles_select_org ON public.profiles FOR SELECT TO authenticated
  USING (organization_id = COALESCE(public.request_org_id(), public.get_my_org_id()));

CREATE POLICY profiles_insert_self ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update_self_or_staff ON public.profiles FOR UPDATE TO authenticated
  USING (
    organization_id = COALESCE(public.request_org_id(), public.get_my_org_id())
    AND (
      (id = auth.uid())
      OR (public.is_org_staff() AND public.app_user_role() = ANY (ARRAY['owner','admin','admin_kurir','finance']::text[]))
    )
  )
  WITH CHECK (organization_id = COALESCE(public.request_org_id(), public.get_my_org_id()));

-- 15) RLS — customers
CREATE POLICY customers_select_org ON public.customers FOR SELECT TO authenticated
  USING (organization_id = public.request_org_id());

CREATE POLICY customers_insert_org ON public.customers FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.request_org_id()
    AND (
      public.is_org_staff()
      OR public.app_user_role() = 'courier'
    )
  );

CREATE POLICY customers_update_staff ON public.customers FOR UPDATE TO authenticated
  USING (organization_id = public.request_org_id() AND public.is_org_staff())
  WITH CHECK (organization_id = public.request_org_id());

CREATE POLICY customers_delete_staff ON public.customers FOR DELETE TO authenticated
  USING (organization_id = public.request_org_id() AND public.is_org_staff() AND public.app_user_role() = ANY (ARRAY['owner','admin','admin_kurir']::text[]));

-- 16) RLS — settings (one row per organization_id)
CREATE POLICY settings_select_org ON public.settings FOR SELECT TO authenticated
  USING (organization_id = public.request_org_id());

CREATE POLICY settings_update_staff ON public.settings FOR UPDATE TO authenticated
  USING (
    organization_id = public.request_org_id()
    AND public.is_org_staff()
    AND public.app_user_role() = ANY (ARRAY['owner','admin','admin_kurir','finance']::text[])
  )
  WITH CHECK (organization_id = public.request_org_id());

-- 17) RLS — notifications
CREATE POLICY notifications_select_own_or_staff ON public.notifications FOR SELECT TO authenticated
  USING (
    organization_id = public.request_org_id()
    AND (user_id = auth.uid() OR (public.is_org_staff() AND public.app_user_role() = ANY (ARRAY['owner','admin','admin_kurir']::text[])))
  );

CREATE POLICY notifications_insert_staff ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.request_org_id()
    AND public.is_org_staff()
    AND public.app_user_role() = ANY (ARRAY['owner','admin','admin_kurir']::text[])
  );

CREATE POLICY notifications_update_own_or_staff ON public.notifications FOR UPDATE TO authenticated
  USING (
    organization_id = public.request_org_id()
    AND (
      user_id = auth.uid()
      OR (public.is_org_staff() AND public.app_user_role() = ANY (ARRAY['owner','admin','admin_kurir']::text[]))
    )
  )
  WITH CHECK (organization_id = public.request_org_id());

-- 18) RLS — tracking_logs
CREATE POLICY tracking_logs_select ON public.tracking_logs FOR SELECT TO authenticated
  USING (
    organization_id = public.request_org_id()
    AND (
      public.is_org_staff()
      OR EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = tracking_logs.order_id
          AND o.organization_id = public.request_org_id()
          AND o.courier_id = auth.uid()
      )
    )
  );

CREATE POLICY tracking_logs_insert_org ON public.tracking_logs FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.request_org_id()
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = tracking_logs.order_id
        AND o.organization_id = public.request_org_id()
    )
    AND (
      public.is_org_staff()
      OR EXISTS (
        SELECT 1 FROM public.orders o2
        WHERE o2.id = tracking_logs.order_id AND o2.courier_id = auth.uid()
      )
    )
  );

-- 19) RLS — customer_change_requests
CREATE POLICY ccr_select_org ON public.customer_change_requests FOR SELECT TO authenticated
  USING (organization_id = public.request_org_id());

CREATE POLICY ccr_insert_org ON public.customer_change_requests FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.request_org_id());

CREATE POLICY ccr_update_staff ON public.customer_change_requests FOR UPDATE TO authenticated
  USING (organization_id = public.request_org_id() AND public.is_org_staff() AND public.app_user_role() = ANY (ARRAY['owner','admin','admin_kurir']::text[]))
  WITH CHECK (organization_id = public.request_org_id());

-- 20) RLS — shifts & courier_shifts & shift_overrides & holidays
CREATE POLICY shifts_select_org ON public.shifts FOR SELECT TO authenticated
  USING (organization_id = public.request_org_id());
CREATE POLICY shifts_write_staff ON public.shifts FOR ALL TO authenticated
  USING (organization_id = public.request_org_id() AND public.is_org_staff() AND public.app_user_role() = ANY (ARRAY['owner','admin','admin_kurir']::text[]))
  WITH CHECK (organization_id = public.request_org_id());

CREATE POLICY courier_shifts_select_org ON public.courier_shifts FOR SELECT TO authenticated
  USING (organization_id = public.request_org_id());
CREATE POLICY courier_shifts_write_staff ON public.courier_shifts FOR ALL TO authenticated
  USING (organization_id = public.request_org_id() AND public.is_org_staff() AND public.app_user_role() = ANY (ARRAY['owner','admin','admin_kurir']::text[]))
  WITH CHECK (organization_id = public.request_org_id());

CREATE POLICY shift_overrides_select_org ON public.shift_overrides FOR SELECT TO authenticated
  USING (organization_id = public.request_org_id());
CREATE POLICY shift_overrides_write_staff ON public.shift_overrides FOR ALL TO authenticated
  USING (organization_id = public.request_org_id() AND public.is_org_staff() AND public.app_user_role() = ANY (ARRAY['owner','admin','admin_kurir']::text[]))
  WITH CHECK (organization_id = public.request_org_id());

CREATE POLICY holidays_select_org ON public.holidays FOR SELECT TO authenticated
  USING (organization_id = public.request_org_id());
CREATE POLICY holidays_write_staff ON public.holidays FOR ALL TO authenticated
  USING (organization_id = public.request_org_id() AND public.is_org_staff() AND public.app_user_role() = ANY (ARRAY['owner','admin','admin_kurir']::text[]))
  WITH CHECK (organization_id = public.request_org_id());

-- 21) RLS — shift_attendance
CREATE POLICY shift_att_select ON public.shift_attendance FOR SELECT TO authenticated
  USING (
    organization_id = public.request_org_id()
    AND (
      public.is_org_staff()
      OR courier_id = auth.uid()
    )
  );

CREATE POLICY shift_att_write_staff ON public.shift_attendance FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.request_org_id() AND public.is_org_staff());

CREATE POLICY shift_att_update_staff ON public.shift_attendance FOR UPDATE TO authenticated
  USING (organization_id = public.request_org_id() AND public.is_org_staff())
  WITH CHECK (organization_id = public.request_org_id());
CREATE POLICY shift_att_service ON public.shift_attendance FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 22) RLS — attendance_logs (system + staff read)
CREATE POLICY attendance_logs_select_staff ON public.attendance_logs FOR SELECT TO authenticated
  USING (
    organization_id = public.request_org_id()
    AND public.is_org_staff()
  );

CREATE POLICY attendance_logs_insert_org ON public.attendance_logs FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.request_org_id()
    AND (
      courier_id IS NULL
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = attendance_logs.courier_id AND p.organization_id = public.request_org_id())
    )
  );
CREATE POLICY attendance_logs_service ON public.attendance_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 23) RLS — stay_attendance_logs, stay_qr_tokens, basecamps
CREATE POLICY stay_logs_select ON public.stay_attendance_logs FOR SELECT TO authenticated
  USING (
    organization_id = public.request_org_id()
    AND (
      public.is_org_staff()
      OR courier_id = auth.uid()
    )
  );
CREATE POLICY stay_logs_insert ON public.stay_attendance_logs FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.request_org_id()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = stay_attendance_logs.courier_id AND p.organization_id = public.request_org_id())
  );

CREATE POLICY stay_qr_select_org ON public.stay_qr_tokens FOR SELECT TO authenticated
  USING (organization_id = public.request_org_id());
CREATE POLICY stay_qr_write_staff ON public.stay_qr_tokens FOR ALL TO authenticated
  USING (organization_id = public.request_org_id() AND public.is_org_staff() AND public.app_user_role() = ANY (ARRAY['owner','admin','admin_kurir']::text[]))
  WITH CHECK (organization_id = public.request_org_id());

CREATE POLICY basecamps_select_org ON public.basecamps FOR SELECT TO authenticated
  USING (organization_id = public.request_org_id());
CREATE POLICY basecamps_write_staff ON public.basecamps FOR ALL TO authenticated
  USING (organization_id = public.request_org_id() AND public.is_org_staff() AND public.app_user_role() = ANY (ARRAY['owner','admin','admin_kurir']::text[]))
  WITH CHECK (organization_id = public.request_org_id());

-- 24) RLS — tier_change_log, courier_warnings
CREATE POLICY tier_log_select ON public.tier_change_log FOR SELECT TO authenticated
  USING (
    organization_id = public.request_org_id()
    AND (
      public.is_org_staff()
      OR courier_id = auth.uid()
    )
  );
CREATE POLICY tier_log_insert_service ON public.tier_change_log FOR INSERT TO service_role
  WITH CHECK (organization_id IS NOT NULL);

CREATE POLICY courier_warn_select ON public.courier_warnings FOR SELECT TO authenticated
  USING (
    organization_id = public.request_org_id()
    AND (
      public.is_org_staff()
      OR courier_id = auth.uid()
    )
  );
CREATE POLICY courier_warn_write_staff ON public.courier_warnings FOR ALL TO authenticated
  USING (organization_id = public.request_org_id() AND public.is_org_staff())
  WITH CHECK (organization_id = public.request_org_id());

-- 25) RLS — client_logs (tenant-scoped insert; read org admin app role only)
CREATE POLICY client_logs_insert ON public.client_logs FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.request_org_id());

CREATE POLICY client_logs_select_admin ON public.client_logs FOR SELECT TO authenticated
  USING (
    organization_id = public.request_org_id()
    AND public.app_user_role() = 'admin'
  );

-- 26) RLS — scheduled_notifications (only if table exists; column added in section 4)
DO $$
BEGIN
  IF to_regclass('public.scheduled_notifications') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY';
    EXECUTE $pol$
      CREATE POLICY sched_notif_select_own ON public.scheduled_notifications
        FOR SELECT TO authenticated
        USING (organization_id = public.request_org_id() AND user_id = auth.uid())
    $pol$;
    EXECUTE $pol$
      CREATE POLICY sched_notif_insert_own ON public.scheduled_notifications
        FOR INSERT TO authenticated
        WITH CHECK (organization_id = public.request_org_id() AND user_id = auth.uid())
    $pol$;
    EXECUTE $pol$
      CREATE POLICY sched_notif_manage_staff ON public.scheduled_notifications
        FOR ALL TO authenticated
        USING (
          organization_id = public.request_org_id()
          AND public.is_org_staff()
          AND public.app_user_role() = ANY (ARRAY['owner','admin','admin_kurir']::text[])
        )
        WITH CHECK (organization_id = public.request_org_id())
    $pol$;
    EXECUTE $pol$
      CREATE POLICY sched_notif_service ON public.scheduled_notifications
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $pol$;
  END IF;
END $$;

-- NOTE: After backfill, consider ALTER TABLE public.scheduled_notifications ALTER COLUMN organization_id SET NOT NULL.

-- IMPORTANT: request_org_id() is NULL until JWT Custom Access Token Hook sets `org_id`.
-- Edge `notify-courier` should resolve tokens with: WHERE organization_id = <from notification row>.

```

**Post-migration checklist**

- [ ] Verify RLS against staging (courier pending orders, finance unpaid updates, scheduled reminder inserts).  
- [ ] Ensure tier-change and other server-side writers use **service_role** or `SECURITY DEFINER` functions owned by a role that bypasses RLS where intended.  
- [ ] Update **every RPC** (`assign_order_and_rotate`, `complete_order`, …) to take `p_organization_id` or derive from `orders.organization_id` and enforce membership.  
- [ ] Update Edge Functions to scope by org.  
- [ ] Update frontend queries to `.eq('organization_id', activeOrgId)` until JWT hook is live.  
- [ ] Regenerate `src/types/supabase.ts`.

---

---

## Appendix B — First User Setup

Run these steps in order after Appendix A SQL completes successfully.

### B.1 Create auth user

Go to **Supabase Dashboard → Authentication → Users → Add User**.

Fill in:
- Email: `your@email.com`
- Password: (min 8 chars)
- Click **Create User**
- Copy the **UUID** shown in the users list — you need it for B.2.

### B.2 Insert profile row

Run in **SQL Editor** (replace placeholders):

```sql
INSERT INTO public.profiles (id, name, email, role, organization_id, is_active)
VALUES (
  'PASTE-UUID-FROM-AUTH-USERS-HERE',   -- from B.1, NOT gen_random_uuid()
  'Your Full Name',
  'your@email.com',
  'owner',
  (SELECT id FROM public.organizations WHERE slug = 'default'),
  true
);
```

### B.3 Verify login works

Run this to confirm the profile is linked correctly:

```sql
SELECT p.id, p.name, p.role, p.organization_id, o.slug
FROM public.profiles p
JOIN public.organizations o ON o.id = p.organization_id
WHERE p.email = 'your@email.com';
```

Expected: one row with `role = owner` and `slug = default`.

### B.4 Environment variables

Create `.env` in project root:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your-anon-key...
```

Get both values from **Supabase Dashboard → Settings → API**.

⚠️ `VITE_SUPABASE_ANON_KEY` (anon/public) is safe to expose in frontend.  
🚫 `service_role` key must **never** appear in frontend code.

### B.5 Default seed data (optional but recommended)

```sql
-- Default settings for the org
INSERT INTO public.settings (id, organization_id, commission_rate, commission_threshold, operational_timezone)
SELECT 'global', id, 80, 5000, 'Asia/Makassar'
FROM public.organizations WHERE slug = 'default'
ON CONFLICT (id) DO NOTHING;

-- Default shift
INSERT INTO public.shifts (name, start_time, end_time, organization_id)
SELECT 'Shift Pagi', '08:00:00', '17:00:00', id
FROM public.organizations WHERE slug = 'default';

-- Starter subscription
INSERT INTO public.subscriptions (organization_id, plan_id, status)
SELECT o.id, p.id, 'active'
FROM public.organizations o, public.plans p
WHERE o.slug = 'default' AND p.slug = 'starter'
ON CONFLICT DO NOTHING;
```

