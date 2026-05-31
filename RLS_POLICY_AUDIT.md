# RLS Policy Audit Report
**Generated:** 2026-05-11  
**Database:** kurirdev (bunycotovavltxmutier)

## Summary

Dokumen ini berisi audit lengkap semua RLS (Row Level Security) policies di database, dengan penjelasan siapa saja yang diizinkan untuk setiap operasi.

---

## 1. attendance_logs

| Policy Name | Operation | Who Can Access |
|-------------|-----------|----------------|
| Admins can view all attendance logs | SELECT | `owner`, `admin`, `admin_kurir` |
| System can insert attendance logs | INSERT | Semua (no restriction) |

**Notes:**
- ✅ Admin roles dapat melihat semua log kehadiran
- ✅ System dapat insert log (untuk automated attendance tracking)
- ⚠️ Tidak ada policy UPDATE/DELETE (immutable logs)

---

## 2. basecamps

| Policy Name | Operation | Who Can Access |
|-------------|-----------|----------------|
| basecamps_select_auth | SELECT | Semua authenticated users |
| basecamps_write_admin | ALL (INSERT/UPDATE/DELETE) | `owner`, `admin_kurir`, `admin` |

**Notes:**
- ✅ Semua user yang login dapat melihat basecamps
- ✅ Admin roles dapat manage basecamps (CRUD)
- ✅ **FIXED:** Policy sudah include role `admin`

---

## 3. client_logs

| Policy Name | Operation | Who Can Access |
|-------------|-----------|----------------|
| Enable insert for all | INSERT | Semua (no restriction) |
| Enable read for admins | SELECT | JWT role = 'admin' |

**Notes:**
- ✅ Semua client dapat insert logs (untuk debugging)
- ⚠️ Hanya admin yang bisa baca logs
- ⚠️ Policy menggunakan JWT role, bukan profiles.role

---

## 4. customer_change_requests

| Policy Name | Operation | Who Can Access |
|-------------|-----------|----------------|
| Everyone can read requests | SELECT | Semua authenticated users |
| Only admins can update requests | UPDATE | `owner`, `admin_kurir`, `admin` |
| ccr_insert | INSERT | Semua authenticated users |
| ccr_select | SELECT | Semua authenticated users (duplicate) |
| ccr_update | UPDATE | `owner`, `admin_kurir` (duplicate, missing `admin`) |

**Notes:**
- ✅ Semua user dapat create dan view change requests
- ⚠️ **DUPLICATE POLICIES:** Ada 2 policy untuk SELECT dan UPDATE
- ⚠️ **INCONSISTENT:** Policy "Only admins can update" include `admin`, tapi "ccr_update" tidak
- 🔧 **RECOMMENDATION:** Hapus duplicate policies, gunakan yang include `admin`

---

## 5. customers

| Policy Name | Operation | Who Can Access |
|-------------|-----------|----------------|
| Admins can do everything on customers | ALL | `admin`, `owner`, `admin_kurir`, `finance` |
| Couriers can create customers | INSERT | `courier` |
| Everyone can read customers | SELECT | Semua authenticated users |
| Only admins/owners can insert/update/delete customers | ALL | `owner`, `admin_kurir`, `admin`, `finance` (duplicate) |
| Only admins/owners can update customers | UPDATE | `admin`, `owner`, `admin_kurir`, `finance` (duplicate) |
| customers_all | ALL | Semua authenticated users |

**Notes:**
- ✅ Admin dan finance dapat manage customers
- ✅ Courier dapat create customers (untuk order baru)
- ✅ Semua user dapat view customers
- ⚠️ **MULTIPLE DUPLICATE POLICIES:** Ada 4 policy yang overlap
- 🔧 **RECOMMENDATION:** Cleanup duplicate policies, keep only 3:
  - SELECT untuk authenticated
  - INSERT untuk courier + admin
  - ALL untuk admin/finance

---

## 6. notifications

| Policy Name | Operation | Who Can Access |
|-------------|-----------|----------------|
| Only admins can send notifications | INSERT | `owner`, `admin_kurir`, `admin` |
| notifications_insert | INSERT | Semua authenticated users (duplicate, conflict) |
| notifications_select | SELECT | User sendiri OR admin roles |
| notifications_update | UPDATE | User sendiri OR admin roles |

**Notes:**
- ⚠️ **CONFLICT:** Ada 2 policy INSERT yang bertentangan
  - Policy 1: Hanya admin
  - Policy 2: Semua authenticated
- ✅ User dapat view/update notifikasi mereka sendiri
- ✅ Admin dapat view/update semua notifikasi
- 🔧 **RECOMMENDATION:** Hapus "notifications_insert" (yang permissive), keep "Only admins can send"

---

## 7. orders

| Policy Name | Operation | Who Can Access |
|-------------|-----------|----------------|
| Admins and Finance can view all orders | SELECT | `admin`, `owner`, `admin_kurir`, `finance` |
| Couriers can update assigned orders status | UPDATE | `courier` (hanya order mereka) |
| Couriers can view assigned or pending orders | SELECT | `courier` (pending OR assigned to them) |
| Ops can insert/update orders | ALL | `admin`, `owner`, `admin_kurir`, `finance` |
| orders_insert | INSERT | `owner`, `admin_kurir` (duplicate, missing `admin` & `finance`) |
| orders_select | SELECT | `owner`, `admin_kurir`, `finance` OR courier (duplicate) |
| orders_update | UPDATE | Complex conditions (duplicate) |

**Notes:**
- ✅ Admin/finance dapat manage semua orders
- ✅ Courier dapat view pending orders dan update assigned orders
- ⚠️ **DUPLICATE POLICIES:** Ada 3 set policies yang overlap
- ⚠️ **INCONSISTENT:** "orders_insert" tidak include `admin` & `finance`
- 🔧 **RECOMMENDATION:** Cleanup duplicates, ensure consistency

---

## 8. profiles

| Policy Name | Operation | Who Can Access |
|-------------|-----------|----------------|
| Admins can manage all profiles | ALL | `admin`, `owner`, `admin_kurir`, `finance` |
| Users can view and edit their own profile | ALL | User sendiri |
| profiles_insert | INSERT | User sendiri (duplicate) |
| profiles_select | SELECT | Semua authenticated users (duplicate) |
| profiles_update | UPDATE | User sendiri OR `owner`, `admin_kurir` (duplicate, missing `admin` & `finance`) |

**Notes:**
- ✅ Admin dapat manage semua profiles
- ✅ User dapat manage profile sendiri
- ✅ Semua user dapat view profiles (untuk courier list, dll)
- ⚠️ **DUPLICATE POLICIES:** Ada 2 set policies
- ⚠️ **INCONSISTENT:** "profiles_update" tidak include `admin` & `finance`
- 🔧 **RECOMMENDATION:** Cleanup duplicates, ensure all admin roles included

---

## 9. scheduled_notifications

| Policy Name | Operation | Who Can Access |
|-------------|-----------|----------------|
| Service role can manage all scheduled notifications | ALL | JWT role = 'service_role' |
| Users can view their own scheduled notifications | SELECT | User sendiri |

**Notes:**
- ✅ Service role (cron jobs) dapat manage scheduled notifications
- ✅ User dapat view scheduled notifications mereka
- ⚠️ Policy menggunakan JWT role untuk service_role

---

## 10. settings

| Policy Name | Operation | Who Can Access |
|-------------|-----------|----------------|
| settings_select | SELECT | Semua authenticated users |
| settings_update | UPDATE | `owner`, `admin`, `admin_kurir`, `finance` |

**Notes:**
- ✅ Semua user dapat view settings (untuk operational config)
- ✅ Admin roles dapat update settings
- ✅ Include semua admin roles

---

## 11. shift_attendance

| Policy Name | Operation | Who Can Access |
|-------------|-----------|----------------|
| Allow admins to manage all attendance | ALL | `admin`, `admin_kurir`, `finance` (missing `owner`) |
| Allow authenticated users to view attendance | SELECT | Semua (no restriction) |

**Notes:**
- ✅ Admin dapat manage attendance
- ✅ Semua user dapat view attendance
- ⚠️ **MISSING:** Role `owner` tidak include dalam policy ALL
- 🔧 **RECOMMENDATION:** Add `owner` to admin policy

---

## 12. stay_attendance_logs

| Policy Name | Operation | Who Can Access |
|-------------|-----------|----------------|
| Admin can read all stay logs | SELECT | `admin`, `admin_kurir`, `owner`, `finance` |
| Courier can read own stay logs | SELECT | Courier sendiri |
| System can insert stay logs | INSERT | Semua (no restriction) |

**Notes:**
- ✅ Admin dapat view semua stay logs
- ✅ Courier dapat view stay logs mereka sendiri
- ✅ System dapat insert logs (untuk GPS monitoring)

---

## 13. stay_qr_tokens

| Policy Name | Operation | Who Can Access |
|-------------|-----------|----------------|
| qr_tokens_insert_admin | INSERT | `owner`, `admin_kurir`, `admin` |
| qr_tokens_select_auth | SELECT | Semua authenticated users |

**Notes:**
- ✅ Admin dapat generate QR tokens
- ✅ Semua user dapat view QR tokens (untuk scan)
- ✅ **FIXED:** Policy sudah include role `admin`

---

## 14. tracking_logs

| Policy Name | Operation | Who Can Access |
|-------------|-----------|----------------|
| Admins can view all tracking logs | SELECT | `admin`, `owner`, `admin_kurir`, `finance` |
| Authenticated users can insert tracking logs | INSERT | Semua (no restriction) |
| Couriers can view logs for their orders | SELECT | Courier (hanya order mereka) |
| tracking_logs_insert | INSERT | Semua authenticated users (duplicate) |
| tracking_logs_select | SELECT | Semua authenticated users (duplicate, conflict) |

**Notes:**
- ✅ Admin dapat view semua tracking logs
- ✅ Courier dapat view tracking logs untuk order mereka
- ✅ Semua user dapat insert tracking logs
- ⚠️ **DUPLICATE POLICIES:** Ada 2 set policies
- ⚠️ **CONFLICT:** "tracking_logs_select" allow semua user, tapi policy lain restrict
- 🔧 **RECOMMENDATION:** Cleanup duplicates

---

## Critical Issues Found

### 🔴 HIGH PRIORITY

1. **customer_change_requests**: Duplicate UPDATE policies dengan inconsistent roles
   - "Only admins can update" include `admin`
   - "ccr_update" tidak include `admin`

2. **notifications**: Conflict INSERT policies
   - Policy 1: Hanya admin
   - Policy 2: Semua authenticated

3. **profiles**: "profiles_update" tidak include `admin` & `finance`

4. **shift_attendance**: "Allow admins to manage" tidak include `owner`

### 🟡 MEDIUM PRIORITY

5. **customers**: 4 duplicate policies yang overlap

6. **orders**: 3 set duplicate policies

7. **tracking_logs**: Duplicate policies dengan potential conflict

### 🟢 LOW PRIORITY

8. Multiple tables dengan duplicate SELECT policies untuk authenticated users

---

## Recommendations

### Immediate Actions

1. **Fix customer_change_requests**:
   ```sql
   DROP POLICY "ccr_update" ON customer_change_requests;
   -- Keep "Only admins can update requests" (sudah include admin)
   ```

2. **Fix notifications**:
   ```sql
   DROP POLICY "notifications_insert" ON notifications;
   -- Keep "Only admins can send notifications"
   ```

3. **Fix profiles**:
   ```sql
   DROP POLICY "profiles_update" ON profiles;
   -- Keep "Admins can manage all profiles" + "Users can view and edit their own profile"
   ```

4. **Fix shift_attendance**:
   ```sql
   DROP POLICY "Allow admins to manage all attendance" ON shift_attendance;
   CREATE POLICY "Allow admins to manage all attendance" ON shift_attendance
   FOR ALL
   USING (
     EXISTS (
       SELECT 1 FROM profiles
       WHERE profiles.id = auth.uid()
       AND profiles.role IN ('admin', 'admin_kurir', 'finance', 'owner')
     )
   );
   ```

### Cleanup Actions

5. Remove all duplicate policies across tables
6. Ensure consistent role checks (always include: `owner`, `admin`, `admin_kurir`, `finance` for admin operations)
7. Standardize policy naming convention

---

## Role Summary

### Admin Roles (Full Access)
- `owner` - Super admin, full access to everything
- `admin` - Admin, full access to most operations
- `admin_kurir` - Courier admin, full access to courier operations
- `finance` - Finance admin, full access to financial operations

### User Roles (Limited Access)
- `courier` - Courier, can view assigned orders and update status
- (other roles) - Regular users, can view own data

### Special Roles
- `service_role` - System/cron jobs (JWT-based)
- `authenticated` - Any logged-in user

---

## Notes

- ✅ = Working correctly
- ⚠️ = Potential issue or inconsistency
- 🔧 = Recommendation for improvement
- 🔴 = Critical issue requiring immediate fix
- 🟡 = Medium priority issue
- 🟢 = Low priority cleanup
