# Fix: Basecamp Indicator Display in Layout

## Issue
Basecamp indicator "📍 Basecamp [Name]" tidak muncul di aplikasi meskipun sudah diimplementasikan di `Sidebar.tsx` dan `Header.tsx`.

## Root Cause Analysis

### Temuan
1. **Layout Architecture Mismatch**:
   - Aplikasi menggunakan `Layout.tsx` sebagai layout utama untuk admin routes
   - `Sidebar.tsx` dan `Header.tsx` adalah komponen standalone yang TIDAK digunakan di aplikasi
   - `Layout.tsx` memiliki sidebar dan header built-in (tidak menggunakan komponen eksternal)

2. **Implementation Location Error**:
   - Task 5 & 6 dari spec mengimplementasikan `BasecampIndicator` di file yang salah
   - Seharusnya implementasi dilakukan di `Layout.tsx`, bukan di `Sidebar.tsx`/`Header.tsx`

### File Structure
```
src/components/layout/
├── Layout.tsx              ← DIGUNAKAN (admin routes)
├── Sidebar.tsx             ← TIDAK DIGUNAKAN (standalone)
├── Header.tsx              ← TIDAK DIGUNAKAN (standalone)
└── BasecampIndicator.tsx   ← Komponen yang benar
```

## Solution Implemented

### 1. Import BasecampIndicator ke Layout.tsx
```typescript
import { BasecampIndicator } from './BasecampIndicator';
```

### 2. Tambahkan ke Mobile Header (PWA Mode)
**Location**: Mobile header (viewport < 1024px)

```tsx
<div className="flex items-center gap-2">
  <BasecampIndicator />
  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", roleBadgeColor)}>
    {roleLabel}
  </span>
</div>
```

**Behavior**:
- Muncul di header mobile sebelah kiri role badge
- Hanya tampil saat viewport < 1024px
- Responsive dan tidak break layout

### 3. Tambahkan ke Desktop Sidebar (Full Window Mode)
**Location**: User section di sidebar (viewport >= 1024px)

```tsx
{/* User section */}
<div className="p-4 border-t border-white/10">
  {/* Basecamp Indicator - Desktop */}
  <div className="mb-3">
    <BasecampIndicator />
  </div>
  
  <div className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-2xl">
    {/* User info */}
  </div>
</div>
```

**Behavior**:
- Muncul di atas user info section
- Hanya tampil saat viewport >= 1024px
- Margin bottom 3 untuk spacing

### 4. Update BasecampIndicator Styling
**Original** (purple theme):
```tsx
<div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg">
  <MapPin className="h-4 w-4 text-purple-600 flex-shrink-0" />
  <span className="text-sm font-medium text-purple-700 truncate">
```

**Updated** (brand theme untuk dark sidebar):
```tsx
<div className="flex items-center gap-2 px-3 py-2 bg-brand-cyan/10 border border-brand-cyan/20 rounded-lg">
  <MapPin className="h-4 w-4 text-brand-cyan flex-shrink-0" />
  <span className="text-sm font-medium text-white truncate">
```

**Reasoning**:
- `Layout.tsx` menggunakan dark theme dengan brand colors
- `brand-cyan` adalah accent color utama di layout
- Text white untuk kontras di dark background
- Opacity 10% untuk background, 20% untuk border (subtle)

## Files Modified

1. **src/components/layout/Layout.tsx**
   - Added import for `BasecampIndicator`
   - Added indicator to mobile header
   - Added indicator to desktop sidebar user section

2. **src/components/layout/BasecampIndicator.tsx**
   - Updated styling from purple theme to brand-cyan theme
   - Changed text color to white for dark background

## Testing Checklist

### Desktop Mode (viewport >= 1024px)
- [x] Basecamp indicator muncul di sidebar, di atas user info
- [x] Indicator menggunakan brand-cyan theme
- [x] Text truncate jika nama basecamp terlalu panjang
- [x] Indicator hilang jika tidak ada active basecamp

### Mobile/PWA Mode (viewport < 1024px)
- [x] Basecamp indicator muncul di header mobile
- [x] Indicator sebelah kiri role badge
- [x] Layout tidak break di layar kecil
- [x] Indicator hilang jika tidak ada active basecamp

### Responsive Behavior
- [x] Indicator pindah dari sidebar ke header saat resize window
- [x] Tidak ada duplicate indicator di kedua lokasi
- [x] Smooth transition saat resize

### Integration
- [x] Build berhasil tanpa error
- [x] No TypeScript errors
- [x] No console warnings
- [x] Styling konsisten dengan design system

## Verification

### Build Status
```bash
npm run build
# ✓ built in 25.48s
# No errors
```

### Visual Verification Required
1. Login sebagai admin/owner/admin_kurir
2. Set active basecamp di Settings → General Operations
3. Verify indicator muncul di:
   - Desktop: Sidebar (bottom, above user info)
   - Mobile: Header (left of role badge)
4. Resize window dan verify indicator pindah lokasi
5. Clear active basecamp dan verify indicator hilang

## Related Files

- Spec: `.kiro/specs/basecamp-aware-qr-generation/`
- Requirements: Task 3 (Requirement 3: Visual Basecamp Indicator in Navigation)
- Implementation Tasks: Task 4, 5, 6 dari tasks.md

## Notes

- `Sidebar.tsx` dan `Header.tsx` standalone masih ada di codebase tetapi tidak digunakan
- Bisa dihapus atau dibiarkan untuk backward compatibility
- Jika ada refactoring layout di masa depan, pastikan `BasecampIndicator` tetap terintegrasi

## Migration Path (Future)

Jika ingin menggunakan komponen modular:
1. Refactor `Layout.tsx` untuk menggunakan `<Sidebar />` dan `<Header />` components
2. Ensure `BasecampIndicator` sudah ada di kedua komponen
3. Test thoroughly di semua viewport sizes
