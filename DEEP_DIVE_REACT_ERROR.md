# Deep Dive Analysis: Recurring React useCallback Error

## Symptoms
```
TypeError: Cannot read properties of null (reading 'useCallback')
```

Error ini terjadi **berulang kali** walaupun sudah dicoba clear cache dan restart dev server.

## Root Cause Analysis

### 1. **Code Splitting Issue di Vite Config** ⚠️ PRIMARY SUSPECT

File: `vite.config.ts`

**Problem**: Manual chunks configuration memisahkan React Core dan React DOM ke chunk berbeda:

```typescript
manualChunks(id) {
  // React Core (Smallest footprint for initialization)
  if (id.includes('node_modules/react/') || id.includes('node_modules/scheduler/')) {
    return 'vendor-react-core';  // ← React di chunk terpisah
  }
  // React DOM & Router (Evaluation bridge)
  if (id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router-dom/')) {
    return 'vendor-react-dom-bridge';  // ← React DOM di chunk terpisah
  }
}
```

**Impact**: 
- React Core dan React DOM di-load dari chunk berbeda
- Jika salah satu chunk fail/delay load → React instance jadi null
- Component yang menggunakan `useCallback` memanggil `React.useCallback` saat React belum fully loaded
- Error: `Cannot read properties of null (reading 'useCallback')`

**Evidence dari Codebase**:
- `App.tsx` menggunakan extensive lazy loading dengan `fetchWithRetry()`
- 30+ lazy-loaded components
- Service Worker dengan aggressive caching strategy
- PWA update banner polling every 60 seconds

### 2. **Service Worker Cache Corruption** ⚠️ SECONDARY SUSPECT

File: `public/sw.js` (assumed from PWA config)

**Problem**: Service Worker mem-cache chunks dengan strategy yang aggressive:

```typescript
VitePWA({
  strategies: "injectManifest",
  // ...
  injectManifest: {
    globPatterns: ["**/*.{js,css,html,ico,svg,woff2,woff,ttf,webp}"],
  },
})
```

**Impact**:
- SW caches ALL `.js` files (including React chunks)
- Saat ada deploy baru:
  - Old `vendor-react-core.js` di-cache
  - New `vendor-react-dom-bridge.js` di-fetch
  - Version mismatch → React initialization fails
  - `useCallback` throws error

**Evidence**:
- `main.tsx` has aggressive SW update polling (every 60s)
- `PWAUpdateBanner` component di App.tsx
- Browser console likely shows SW cache hits for old chunks

### 3. **Chunk Loading Race Condition** ⚠️ TERTIARY SUSPECT

File: `App.tsx`

**Problem**: Banyak lazy-loaded components dengan `fetchWithRetry()`:

```typescript
const AttendanceMonitoring = lazy(() => fetchWithRetry(() => 
  import('@/pages/admin/AttendanceMonitoring').then(m => ({ default: m.AttendanceMonitoring }))
));
```

**Impact**:
- `AttendanceMonitoring.tsx` imports `useAdminAttendanceStore`
- Store imports `useCallback` from React
- Jika `vendor-react-core` chunk belum fully loaded:
  - `useCallback` resolves to `undefined`
  - Error thrown

**Evidence**:
- 30+ lazy imports in App.tsx
- Each lazy component can potentially trigger this race
- Error muncul berulang kali (different components, same root cause)

### 4. **StrictMode Double Rendering** ⚠️ CONTRIBUTING FACTOR

File: `main.tsx`

```typescript
createRoot(document.getElementById("root")!).render(
  <StrictMode>  // ← Double renders in dev mode
    <App />
  </StrictMode>
);
```

**Impact**:
- StrictMode renders twice in development
- If first render hits race condition → error
- Second render might succeed
- Users see flashing/inconsistent behavior

### 5. **PWA Update Mechanism Conflict** ⚠️ AMPLIFYING FACTOR

File: `App.tsx` - `PWAUpdateBanner` component

```typescript
useEffect(() => {
  // Check for updates every 60 seconds
  checkInterval = setInterval(() => {
    reg.update().catch(err => ...);
  }, 60000);
}, []);
```

**Impact**:
- SW update check every 60 seconds
- If update found → new chunks available
- User continues using app with old chunks
- Mix of old/new chunks → React initialization fails

## Why It's Recurring

### Cycle of Failure:

1. **Initial Load**: Works fine (all chunks from same build)
2. **New Deploy**: New chunks available on server
3. **SW Update Check**: Detects new version after 60s
4. **Partial Update**: SW caches some new chunks, some old chunks still used
5. **User Navigation**: Lazy loads new component
6. **Chunk Mismatch**: React Core (old) + Component (new) → version conflict
7. **ERROR**: `Cannot read properties of null (reading 'useCallback')`
8. **Auto Reload**: `fetchWithRetry()` reloads page
9. **REPEAT**: Cycle 3-8 continues until user does hard refresh

## Proof: Check Browser DevTools

### Network Tab:
```
✅ vendor-react-core.abc123.js (from cache) 
❌ AttendanceMonitoring.xyz789.js (from network)
```

### Console:
```
Failed to fetch dynamically imported module
TypeError: Cannot read properties of null (reading 'useCallback')
Reloading...
```

### Application > Service Worker:
```
Waiting: sw.js (new version)
Active: sw.js (old version)
```

## Solutions (Ordered by Impact)

### Solution 1: ⭐ **FIX CHUNK SPLITTING** (RECOMMENDED)

**Change**: Don't split React Core and React DOM

```typescript
// vite.config.ts
manualChunks(id) {
  // COMBINE React Core + React DOM into ONE chunk
  if (id.includes('node_modules/react') || 
      id.includes('node_modules/scheduler')) {
    return 'vendor-react';  // ← Single chunk for all React
  }
  // ... rest of chunks
}
```

**Why**: Ensures React is atomic unit, no partial loads

### Solution 2: ⭐ **FORCE SW UPDATE ON DEPLOY**

**Change**: Clear SW cache when version mismatch detected

```typescript
// main.tsx
const VERSION = '1.0.10';  // Increment on each deploy

if (localStorage.getItem('app_version') !== VERSION) {
  // Clear all caches
  caches.keys().then(names => {
    names.forEach(name => caches.delete(name));
  });
  
  // Unregister SW
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(reg => reg.unregister());
  });
  
  localStorage.setItem('app_version', VERSION);
  window.location.reload();
}
```

### Solution 3: **ADD REACT PRELOAD**

**Change**: Preload React chunks before lazy components

```typescript
// App.tsx (top of file)
import 'react';  // ← Force React bundle to load first
import 'react-dom';  // ← Before any lazy components
```

### Solution 4: **DISABLE STRICTMODE IN PROD**

**Change**: Only use StrictMode in dev

```typescript
// main.tsx
createRoot(document.getElementById("root")!).render(
  import.meta.env.DEV ? (
    <StrictMode><App /></StrictMode>
  ) : (
    <App />
  )
);
```

### Solution 5: **REDUCE SW UPDATE POLLING**

**Change**: Update less frequently to reduce churn

```typescript
// App.tsx - PWAUpdateBanner
setInterval(() => {
  reg.update().catch(err => ...);
}, 300000);  // ← 5 minutes instead of 60s
```

### Solution 6: **ADD CHUNK ERROR BOUNDARY**

**Change**: Graceful handling instead of reload loop

```typescript
// App.tsx
class ChunkErrorBoundary extends React.Component {
  state = { hasError: false, chunkError: false };
  
  static getDerivedStateFromError(error) {
    const isChunkError = error.message?.includes('useCallback') ||
                         error.message?.includes('Failed to fetch');
    return { hasError: true, chunkError: isChunkError };
  }
  
  render() {
    if (this.state.chunkError) {
      return (
        <div>
          <h2>Update Required</h2>
          <p>Please refresh the page to get the latest version.</p>
          <button onClick={() => window.location.reload()}>
            Refresh Now
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

## Immediate Action Plan

### Phase 1: Quick Fix (5 minutes)

```powershell
# 1. Clear all caches
Remove-Item -Recurse -Force node_modules\.vite
Remove-Item -Recurse -Force dist

# 2. Rebuild
npm run build

# 3. Tell users to hard refresh
# Ctrl+Shift+R or Ctrl+F5
```

### Phase 2: Code Fix (30 minutes)

Apply Solution 1 + 2:
1. Fix chunk splitting in vite.config.ts
2. Add version check in main.tsx
3. Test deploy with version increment

### Phase 3: Monitoring (24 hours)

Monitor for:
- Browser console errors
- Service Worker cache hits/misses
- Network tab chunk loading
- Error rate in production

## Prevention Strategy

### For Future Deploys:

1. **Increment version** in package.json
2. **Clear SW cache** on version change
3. **Test locally** with SW enabled (`npm run preview`)
4. **Monitor first hour** after deploy
5. **Have rollback ready**

### Code Guidelines:

1. ✅ Keep React in single chunk
2. ✅ Preload critical chunks
3. ✅ Handle chunk errors gracefully
4. ✅ Version bump on every deploy
5. ✅ Clear SW cache on version change

## Testing Checklist

Before deploy:

- [ ] Build with `npm run build`
- [ ] Test with `npm run preview` (with SW)
- [ ] Hard refresh in browser (Ctrl+Shift+R)
- [ ] Test lazy-loaded routes
- [ ] Check Network tab for chunk loading
- [ ] Check Console for errors
- [ ] Test on slow 3G network
- [ ] Test with SW cache enabled
- [ ] Test PWA update flow

## Files to Modify

1. **vite.config.ts** - Fix chunk splitting
2. **main.tsx** - Add version check
3. **App.tsx** - Add error boundary
4. **package.json** - Increment version

## Expected Results After Fix

✅ No more `useCallback` errors
✅ Smooth SW updates
✅ No reload loops
✅ Faster initial load (single React chunk)
✅ Better cache invalidation

## Monitoring After Fix

Watch these metrics:
- Error rate (should drop to 0)
- SW cache hit rate (should increase)
- Initial load time (should decrease)
- User-reported issues (should stop)

