# Fix: TypeError - Cannot read properties of null (reading 'useCallback')

## Error
```
TypeError: Cannot read properties of null (reading 'useCallback')
```

## Root Cause
Error ini terjadi ketika:
1. React module tidak ter-resolve dengan benar
2. Build cache corrupted
3. Multiple React instances di node_modules
4. Vite dev server issue

## Solutions (Coba Berurutan)

### Solution 1: Clear Cache & Restart Dev Server ⭐ (Most Common)

```powershell
# Stop dev server (Ctrl+C)

# Clear node_modules cache
Remove-Item -Recurse -Force node_modules\.vite

# Restart dev server
npm run dev
```

### Solution 2: Clear All Caches & Reinstall

```powershell
# Stop dev server

# Clear all caches
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json

# Reinstall dependencies
npm install

# Restart dev server
npm run dev
```

### Solution 3: Check for Multiple React Instances

```powershell
# Check React instances
npm ls react
```

Expected output: Only ONE react@19.2.3

If multiple versions exist:
```powershell
npm dedupe
npm run dev
```

### Solution 4: Force Clean Build

```powershell
# Clear Vite cache
Remove-Item -Recurse -Force node_modules\.vite

# Clear dist
Remove-Item -Recurse -Force dist

# Clear browser cache (Ctrl+Shift+Delete)
# Or open dev tools → Application → Clear storage

# Rebuild
npm run build
npm run dev
```

### Solution 5: Verify React Import in vite.config.ts

Check `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})
```

### Solution 6: Check for Circular Dependencies

Search for circular imports in files that use `useCallback`:

```powershell
# Files yang menggunakan useCallback
# - AuthContext.tsx
# - CourierDashboard.tsx
# - AttendanceMonitoring.tsx (via stores)
# - useAdminAttendanceStore.ts
```

## Quick Fix Command (PowerShell)

```powershell
# One-liner untuk clear cache dan restart
Remove-Item -Recurse -Force node_modules\.vite; npm run dev
```

## If Error Persists

1. **Check browser console** untuk error stack trace lengkap
2. **Check terminal** untuk Vite compilation errors
3. **Hard refresh browser**: Ctrl+Shift+R
4. **Try different browser** untuk isolate issue
5. **Check file yang baru diubah** - kemungkinan ada syntax error

## Most Likely Cause

Berdasarkan context, error ini kemungkinan terjadi karena:
- **Vite dev server cache** corrupted setelah banyak file changes
- **Browser cache** masih load old module

**Quick Fix**: 
```powershell
Remove-Item -Recurse -Force node_modules\.vite
# Restart browser
# Restart dev server: npm run dev
```

## Prevention

Untuk mencegah error ini di masa depan:
1. Restart dev server setelah install/uninstall dependencies
2. Clear Vite cache setelah major code changes
3. Gunakan `npm run dev` instead of `vite` directly
4. Hard refresh browser setelah clear cache

