# Basecamp-Aware QR Generation

## Overview
This feature allows administrators to configure which basecamp an application instance is associated with, ensuring QR codes are properly tied to specific basecamps.

## Configuration

### Setting Active Basecamp
1. Navigate to Settings → Umum (Operasional)
2. Scroll to "📍 Konfigurasi Instance Basecamp" section
3. Select a basecamp from the dropdown
4. Click "Simpan Konfigurasi"

### Visual Indicator
- **Desktop**: Basecamp indicator appears at bottom of sidebar
- **Mobile**: Basecamp indicator appears in header

## QR Generation Flow
1. Click "Generate QR Stay" in Couriers page
2. If no active basecamp is set, a modal will prompt you to select one
3. Select basecamp and click "Set & Generate QR"
4. QR code is generated and tied to the selected basecamp

## Troubleshooting

### "Basecamp belum dipilih" Error
- Go to Settings and configure active basecamp
- Or select basecamp when prompted during QR generation

### "Tidak ada basecamp aktif" Message
- Add a new basecamp in Settings
- Or activate an existing basecamp by editing it

### 403 Error When Generating QR
- Ensure you have admin, owner, or admin_kurir role
- Contact system administrator if issue persists

## Technical Details

### Database Changes
- Fixed RLS policy to allow 'admin' role to insert QR tokens
- QR tokens now include `basecamp_id` field

### Storage
- Active basecamp selection stored in localStorage
- Synchronized across browser tabs automatically

### Components Added
- `useActiveBasecamp` hook for state management
- `BasecampIndicator` component for visual feedback
- `BasecampSelectionModal` for first-time configuration

## Migration
Run the database migration to fix RLS policy:
```sql
-- Migration file: 20260505010340_fix_stay_qr_tokens_rls_add_admin.sql
-- This allows super admin (role: 'admin') to generate QR tokens
```

## Testing Checklist
- [ ] Super admin can generate QR without 403 error
- [ ] Owner can generate QR without 403 error
- [ ] Admin kurir can generate QR without 403 error
- [ ] Active basecamp selection in Settings works
- [ ] Basecamp indicator appears correctly (desktop/mobile)
- [ ] Modal appears when generating QR without active basecamp
- [ ] Multi-tab sync works
- [ ] Error messages are user-friendly
- [ ] Existing functionality remains intact