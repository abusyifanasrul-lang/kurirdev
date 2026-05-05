# Fix: Basecamp Schema Mismatch (address vs description)

## Issue
Error saat save/update basecamp:
```
Error updating basecamp: {
  code: 'PGRST204', 
  message: "Could not find the 'address' column of 'basecamps' in the schema cache"
}
```

## Root Cause Analysis

### Schema Mismatch
**Database Schema** (actual):
```sql
CREATE TABLE basecamps (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  description text,          -- ✅ Kolom ini ada
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  radius_m integer NOT NULL,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  created_by uuid
);
```

**Frontend Code** (incorrect):
```typescript
// GeneralOpsTab.tsx
interface Basecamp {
  id: string;
  name: string;
  address: string;  // ❌ Kolom ini TIDAK ADA di database
  lat: number;
  lng: number;
  radius_m: number;
  is_active: boolean;
}
```

**Correct Type** (types/index.ts):
```typescript
export interface Basecamp {
  id: string;
  name: string;
  description?: string;  // ✅ Sesuai dengan database
  lat: number;
  lng: number;
  radius_m: number;
  is_active: boolean;
  created_at: string;
}
```

### Why This Happened
1. `GeneralOpsTab.tsx` mendefinisikan interface `Basecamp` lokal dengan field `address`
2. Interface lokal ini **override** tipe global dari `types/index.ts`
3. Saat save/update, Supabase mencoba INSERT/UPDATE kolom `address` yang tidak ada
4. Supabase PostgREST error: **PGRST204** (column not found)

## Solution Implemented

### 1. Update Local Interface
```typescript
// BEFORE
interface Basecamp {
  id: string;
  name: string;
  address: string;  // ❌
  ...
}

// AFTER
interface Basecamp {
  id: string;
  name: string;
  description: string;  // ✅
  ...
}
```

### 2. Update Form State
```typescript
// BEFORE
const [basecampForm, setBasecampForm] = useState({
  name: '',
  address: '',  // ❌
  ...
});

// AFTER
const [basecampForm, setBasecampForm] = useState({
  name: '',
  description: '',  // ✅
  ...
});
```

### 3. Update Form Validation
```typescript
// BEFORE
if (!basecampForm.address.trim()) {
  addToast('Alamat harus diisi', 'warning');
  return;
}

// AFTER
if (!basecampForm.description.trim()) {
  addToast('Deskripsi harus diisi', 'warning');
  return;
}
```

### 4. Update Edit Handler
```typescript
// BEFORE
setBasecampForm({
  name: basecamp.name,
  address: basecamp.address,  // ❌
  ...
});

// AFTER
setBasecampForm({
  name: basecamp.name,
  description: basecamp.description || '',  // ✅
  ...
});
```

### 5. Update Display
```tsx
// BEFORE
<p className="text-xs text-gray-500 mt-0.5">{basecamp.address}</p>

// AFTER
<p className="text-xs text-gray-500 mt-0.5">{basecamp.description}</p>
```

### 6. Update Form Input
```tsx
// BEFORE
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">Alamat</label>
  <textarea
    value={basecampForm.address}
    onChange={(e) => setBasecampForm({ ...basecampForm, address: e.target.value })}
    placeholder="Alamat lengkap basecamp"
  />
</div>

// AFTER
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">Deskripsi</label>
  <textarea
    value={basecampForm.description}
    onChange={(e) => setBasecampForm({ ...basecampForm, description: e.target.value })}
    placeholder="Deskripsi atau alamat basecamp"
  />
</div>
```

## Files Modified

**src/components/settings/GeneralOpsTab.tsx**
- Changed interface `Basecamp.address` → `Basecamp.description`
- Changed form state `address` → `description`
- Changed validation message "Alamat" → "Deskripsi"
- Changed edit handler to use `description`
- Changed display to show `description`
- Changed form label "Alamat" → "Deskripsi"
- Changed placeholder text

## Testing Checklist

### Create Basecamp
- [x] Fill form with name, description, lat, lng, radius
- [x] Click "Simpan"
- [x] Verify no PGRST204 error
- [x] Verify basecamp created in database
- [x] Verify description saved correctly

### Update Basecamp
- [x] Click edit on existing basecamp
- [x] Modal opens with current description
- [x] Modify description
- [x] Click "Simpan"
- [x] Verify no PGRST204 error
- [x] Verify description updated in database

### Display
- [x] Basecamp list shows description below name
- [x] Description displays correctly
- [x] No "undefined" or null values

### Integration
- [x] Build succeeds without errors
- [x] No TypeScript errors
- [x] No console warnings
- [x] Active basecamp selection still works

## Verification

### Build Status
```bash
npm run build
# ✓ built in 48.16s
# No errors
```

### Database Verification
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'basecamps';

-- Result:
-- name: text
-- description: text  ✅
-- (no 'address' column)
```

## Related Issues

- This fix resolves the PGRST204 error when saving basecamps
- Aligns frontend code with actual database schema
- Maintains consistency with global `Basecamp` type in `types/index.ts`

## Prevention

### Best Practices
1. **Use global types**: Import types from `types/index.ts` instead of defining local interfaces
   ```typescript
   // ✅ GOOD
   import { Basecamp } from '@/types';
   
   // ❌ BAD
   interface Basecamp { ... }  // Local override
   ```

2. **Verify schema before coding**: Check database schema before implementing CRUD operations
   ```sql
   \d+ basecamps  -- PostgreSQL
   -- or
   SELECT * FROM information_schema.columns WHERE table_name = 'basecamps';
   ```

3. **Use TypeScript strict mode**: Enable strict type checking to catch mismatches
   ```json
   // tsconfig.json
   {
     "compilerOptions": {
       "strict": true,
       "noImplicitAny": true
     }
   }
   ```

4. **Generate types from database**: Use Supabase CLI to auto-generate types
   ```bash
   npx supabase gen types typescript --project-id <project-id> > src/types/supabase.ts
   ```

## Notes

- Field `description` is optional in database (nullable)
- Frontend treats it as required for better UX
- Placeholder text updated to "Deskripsi atau alamat basecamp" untuk clarity
- Existing basecamps with null description will show empty string

## Migration Path

If you need to rename `description` to `address` in database:
```sql
-- Option 1: Rename column
ALTER TABLE basecamps RENAME COLUMN description TO address;

-- Option 2: Add new column and migrate data
ALTER TABLE basecamps ADD COLUMN address text;
UPDATE basecamps SET address = description;
ALTER TABLE basecamps DROP COLUMN description;
```

**Recommendation**: Keep `description` as it's more semantic (basecamp bisa punya deskripsi selain alamat)
