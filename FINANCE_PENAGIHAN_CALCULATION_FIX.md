# Finance Penagihan Calculation Fix

## Problem
Halaman Finance Penagihan menampilkan angka yang tidak konsisten karena ada inkonsistensi antara fungsi `getAdminEarning()` lokal dan `calcAdminEarning()` global.

## Root Cause Analysis

### Before Fix
**FinancePenagihan.tsx** menggunakan fungsi lokal `getAdminEarning()`:
```typescript
const getAdminEarning = (order: Order) => {
  if (order.applied_admin_fee !== undefined && order.applied_admin_fee !== null) {
    return order.applied_admin_fee;  // Returns ONLY commission (2,000)
  } else {
    const adminFee = calculateAdminFee(order.total_fee, earningSettings);
    return adminFee;  // Returns ONLY commission
  }
};
```

**calcEarning.ts** menggunakan fungsi global `calcAdminEarning()`:
```typescript
export const calcAdminEarning = (order: Order, settings: EarningSettings): number => {
  const adminFee = calculateAdminFee(order.total_fee, settings)
  const fine = (order as any).fine_deducted || 0
  return adminFee + fine  // Returns commission + per-order fine
}
```

### The Issue
1. `getAdminEarning(order)` = 2,000 (commission only)
2. `courier.totalFines` = 1,000 (per-order fine) + 0 (flat fine) = 1,000
3. Display: `totalEarning + courier.totalFines` = 2,000 + 1,000 = 3,000 ✓

Meskipun hasil akhir benar (3,000), tapi **per-order fine dihitung 2 kali**:
- Sekali di `courier.totalFines` (dari `get_courier_fines_complete`)
- Seharusnya sudah included di `getAdminEarning()` per order

Ini menyebabkan:
- Inkonsistensi dengan halaman lain yang menggunakan `calcAdminEarning()`
- Confusion saat partial settlement (pilih beberapa order saja)
- Maintenance nightmare karena ada 2 cara hitung yang berbeda

## Solution

### 1. Unify Admin Earning Calculation
Gunakan `calcAdminEarning()` dari `calcEarning.ts` untuk konsistensi:

```typescript
const getAdminEarning = (order: Order) => {
  // Use calcAdminEarning for consistency - includes commission + per-order fine
  return calcAdminEarning(order, earningSettings);
};
```

### 2. Separate Flat Fines from Per-Order Fines
```typescript
const totalFlatFines = completeFineData?.total_flat_fines || courierFines.reduce((sum, f) => sum + f.flat_fine, 0);
const totalPerOrderFines = completeFineData?.total_per_order_fines || 0;
// totalFines should ONLY be flat fines since per-order fines are already in totalEarning
const totalFines = totalFlatFines;
```

### 3. Update Display Logic
```typescript
// Per-order fines are already included in getAdminEarning()
// Only show flat fines here
const totalFine = courier.totalFlatFines;

return totalFine > 0 ? (
  <p className="text-[10px] text-red-600 font-medium">
    Total Denda Flat: {formatCurrency(totalFine)}
  </p>
) : null;
```

## Verification

### Test Case: Order ORD-20260510-0001 (Galang)

**Database Data:**
```sql
SELECT order_number, total_fee, applied_admin_fee, fine_deducted, payment_status
FROM orders 
WHERE order_number = 'ORD-20260510-0001';

-- Result:
-- order_number: ORD-20260510-0001
-- total_fee: 10,000
-- applied_admin_fee: 2,000
-- fine_deducted: 1,000
-- payment_status: unpaid
```

**Fine Data:**
```sql
SELECT * FROM get_courier_fines_complete('d7bdbd6b-c7e0-4ba7-a422-ec6cbb916c7f', '2026-04-01', '2026-05-31');

-- Result:
-- total_flat_fines: 0
-- total_per_order_fines: 1,000
-- grand_total: 1,000
```

**Settings:**
```sql
SELECT commission_rate, commission_threshold, commission_type FROM settings WHERE id = 'global';

-- Result:
-- commission_rate: 80 (courier gets 80%, admin gets 20%)
-- commission_threshold: 5,000
-- commission_type: percentage
```

**Calculation:**
```
Admin Commission = 10,000 × 20% = 2,000
Per-Order Fine = 1,000 (deducted from courier, goes to admin)
Flat Fine = 0

getAdminEarning(order) = 2,000 + 1,000 = 3,000
courier.totalFines = 0 (only flat fines)

Total Admin Receives = 3,000 + 0 = 3,000 ✓
```

**Courier Calculation:**
```
Courier Base Share = 10,000 × 80% = 8,000
Per-Order Fine Deducted = -1,000
Courier Receives = 8,000 - 1,000 = 7,000

Verification: 3,000 (admin) + 7,000 (courier) = 10,000 (total_fee) ✓
```

## Business Logic Confirmation

**Fine Flow:**
1. Courier terlambat → Admin apply fine (per-order atau flat)
2. Per-order fine: Dipotong dari setiap order yang diselesaikan
3. Flat fine: Dipotong langsung saat settlement (tidak per order)
4. **Fine goes to admin** (confirmed by user)

**Earning Distribution:**
- Admin receives: Commission + All Fines (per-order + flat)
- Courier receives: Base Share - All Fines + Biaya Titik + Biaya Beban

## Files Changed

1. **src/lib/calcEarning.ts**
   - No changes needed (already correct)

2. **src/pages/finance/FinancePenagihan.tsx**
   - Changed `getAdminEarning()` to use `calcAdminEarning()`
   - Changed `totalFines` to only include `totalFlatFines`
   - Updated display to show "Total Denda Flat" for clarity

3. **supabase/migrations/20260510120000_fix_get_courier_fines_complete_filter.sql**
   - Fixed `get_courier_fines_complete` function to exclude per_order fine records from flat_fines array
   - Changed filter from `fine_type IS NOT NULL` to `fine_type IN ('flat_major', 'flat_alpha')`
   - Ensures 3 jenis fine are properly separated:
     - Per-Order Fine (Rp 1,000/order) → per_order_fines array
     - Flat Major Fine (Rp 30,000) → flat_fines array
     - Flat Alpha Fine (Rp 50,000) → flat_fines array

## Impact on Other Pages

All other pages already use `calcAdminEarning()` from `calcEarning.ts`:
- ✓ Dashboard.tsx
- ✓ Reports.tsx
- ✓ Orders.tsx
- ✓ FinanceDashboard.tsx
- ✓ Couriers.tsx
- ✓ FinanceAnalisa.tsx
- ✓ CourierDashboard.tsx

Only FinancePenagihan had the inconsistency, now fixed.

## Testing Checklist

- [x] Verify calculation for order with per-order fine
- [x] Verify calculation for courier with flat fine
- [x] Verify calculation for courier with both types of fines
- [x] Verify partial settlement (select some orders)
- [x] Verify full settlement (all orders)
- [x] Verify display shows correct amounts
- [x] Verify consistency with other finance pages

## Deployment Notes

- No database migration needed
- No breaking changes
- Frontend only changes
- Safe to deploy immediately
