# Lighthouse Performance Fix Plan — KurirDev Courier PWA

## Current Score: 55/100 (Target: 65-75)

## Root Cause Analysis

After deep analysis, the remaining performance issues stem from **eager initialization** of modules that are not needed for the initial render of `/courier`.

### The Problem Chain
```
index.html
  └─ index-BEDbzTEJ.js (104KB transfer, 324KB resource)
       ├─ App.tsx
       │    ├─ fcm.ts (static import) ← PULLS IN:
       │    │    ├─ firebase/messaging (~20KB)
       │    │    ├─ firebase/installations (~10KB)
       │    │    ├─ @capacitor/core (~15KB)
       │    │    └─ @capacitor/push-notifications (~5KB)
       │    ├─ useOrderStore → firebase/firestore
       │    ├─ useCustomerStore → firebase/firestore + orderCache → dexie
       │    └─ orderCache → dexie (95KB)
       ├─ firebase.ts
       │    ├─ firebase/app
       │    ├─ firebase/firestore
       │    ├─ firebase/auth
       │    └─ firebase/messaging ← NOT NEEDED AT BOOT
       └─ AppListeners.tsx
            ├─ seedFirestore → firebase/installations (runs every mount)
            ├─ initQueuePositions (runs every mount)
            └─ syncAllFinalOrders (runs after 3s)
```

### What Courier Actually Needs at Boot
1. ✅ `firebase/app` + `firebase/auth` — for login
2. ✅ `firebase/firestore` — for real-time order listener
3. ✅ `zustand` — state management
4. ✅ `react-router-dom` — routing
5. ✅ `lucide-react` — icons (tree-shaken)
6. ✅ `date-fns` — date formatting
7. ✅ `dexie` — IndexedDB (for offline orders)
8. ❌ `firebase/messaging` — only for push notifications
9. ❌ `firebase/installations` — only for FCM token cleanup
10. ❌ `@capacitor/*` — only for native app
11. ❌ `seedFirestore` — no-op after first run
12. ❌ `initQueuePositions` — admin-only concern
13. ❌ Customer sync — not needed for initial render

---

## Implementation Plan

### Step 1: Make Firebase Messaging Lazy
**File**: `src/lib/firebase.ts`

Remove `firebase/messaging` import and `messaging` export. Move messaging initialization to `fcm.ts`.

**Before** (33 lines):
```typescript
import { getMessaging, type Messaging } from 'firebase/messaging'
// ... 
let _messaging: Messaging | null = null
try { _messaging = getMessaging(app) } catch (e) { ... }
export const messaging = _messaging
```

**After**:
```typescript
import { initializeApp, SDK_VERSION } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const app = initializeApp(firebaseConfig)
const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp')

export const db = getFirestore(app)
export const auth = getAuth(app)
export const secondaryAuth = getAuth(secondaryApp)
export default app
```

**Impact**: Saves ~30KB (firebase/messaging + firebase/installations) from main bundle

---

### Step 2: Move Messaging Init to fcm.ts
**File**: `src/lib/fcm.ts`

Add lazy messaging initialization at the top of fcm.ts (already imports firebase/messaging).

**Add**:
```typescript
import { getMessaging, type Messaging } from 'firebase/messaging'

let _messaging: Messaging | null = null
try {
  _messaging = getMessaging(app)
} catch (e) {
  console.warn('⚠️ Firebase Messaging not supported in this browser:', e)
}
const messaging = _messaging
```

Remove `import { messaging } from './firebase'` (line 3).

---

### Step 3: Defer FCM in App.tsx
**File**: `src/App.tsx`

Change static import of `fcm.ts` to dynamic import, and gate behind courier role.

**Before** (line 8):
```typescript
import { onForegroundMessage, refreshFCMToken } from '@/lib/fcm';
```

**After**:
```typescript
// Remove line 8 entirely
```

**Before** (lines 201-237):
```typescript
const currentUserStr = sessionStorage.getItem('user-session');
let fcmRefreshInterval: ReturnType<typeof setInterval> | null = null;
if (currentUserStr) {
  try {
    const sessionData = JSON.parse(currentUserStr);
    const currentUser = sessionData.state?.user;
    if (currentUser?.role === 'courier') {
      refreshFCMToken(currentUser.id).catch(console.error);
      // ...
    }
  } catch (e) {}
}
const unsubFCM = onForegroundMessage((payload) => { ... });
```

**After**:
```typescript
const currentUserStr = sessionStorage.getItem('user-session');
let fcmRefreshInterval: ReturnType<typeof setInterval> | null = null;
let unsubFCM: (() => void) | undefined;

if (currentUserStr) {
  try {
    const sessionData = JSON.parse(currentUserStr);
    const currentUser = sessionData.state?.user;
    if (currentUser?.role === 'courier') {
      // Dynamic import — only loads firebase/messaging for courier
      import('@/lib/fcm').then(({ refreshFCMToken, onForegroundMessage }) => {
        refreshFCMToken(currentUser.id).catch(console.error);
        const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
        fcmRefreshInterval = setInterval(() => {
          refreshFCMToken(currentUser.id).catch(console.error);
        }, SEVEN_DAYS_MS);
        unsubFCM = onForegroundMessage((payload) => {
          console.log('🔔 Foreground message received:', payload);
          const notifData = payload.notification || payload.data || {};
          const title = notifData.title;
          const body = notifData.body;
          if (title && Notification.permission === 'granted') {
            const notif = new Notification(title, {
              body: body || '',
              icon: '/icons/android/android-launchericon-192-192.png',
              tag: payload.data?.orderId || 'kurirdev-foreground',
            });
            notif.onclick = () => window.focus();
          }
        });
      });
    }
  } catch (e) {
    // ignore parse error
  }
}

return () => {
  if (unsubFCM) unsubFCM();
  if (fcmRefreshInterval) clearInterval(fcmRefreshInterval);
};
```

---

### Step 4: Defer Customer Sync in App.tsx
**File**: `src/App.tsx` lines 191-199

Move customer sync inside the same auth check, after first paint.

**Before**:
```typescript
useEffect(() => {
  loadFromLocal().then(() => {
    // sync logic
  });
}, []);
```

**After**:
```typescript
useEffect(() => {
  // Defer non-critical sync to after first paint
  const timer = setTimeout(() => {
    loadFromLocal().then(() => {
      const lastSyncRaw = getCustomerSyncTime();
      const lastSyncDate = lastSyncRaw ? new Date(lastSyncRaw).toDateString() : null;
      const today = new Date().toDateString();
      if (lastSyncDate !== today) {
        syncFromFirestore();
      }
    });
  }, 0); // setTimeout 0 = after current event loop, still before user interaction

  return () => clearTimeout(timer);
}, []);
```

---

### Step 5: Gate firebaseSeeder with localStorage
**File**: `src/components/AppListeners.tsx` line 115

**Before**:
```typescript
seedFirestore().catch(console.error)
```

**After**:
```typescript
if (!localStorage.getItem('kurirdev_seeded')) {
  seedFirestore().then(() => {
    localStorage.setItem('kurirdev_seeded', '1');
  }).catch(console.error);
}
```

---

### Step 6: Gate initQueuePositions for Courier
**File**: `src/components/AppListeners.tsx` lines 117-119

**Before**:
```typescript
setTimeout(() => {
  initQueuePositions().catch(console.error)
}, 2000)
```

**After**:
```typescript
// Only admin needs queue positions; courier doesn't manage queue
if (user && user.role !== 'courier') {
  setTimeout(() => {
    initQueuePositions().catch(console.error)
  }, 5000)
}
```

Note: `user` is available from `useAuth()` at line 97. Need to check if `user` is defined in this scope. Let me verify...

Actually, looking at line 97: `const { user } = useAuth()` — but this is inside the `AppListeners` component. The first useEffect (line 109) doesn't depend on `user`, so `user` would be `null` on first render.

We need to gate it differently — either check sessionStorage directly, or move it to a separate useEffect that depends on `user`.

**Revised approach**:
```typescript
// In useEffect #1 (line 109):
setTimeout(() => {
  // Check sessionStorage for role
  const sessionStr = sessionStorage.getItem('user-session');
  if (sessionStr) {
    try {
      const { state } = JSON.parse(sessionStr);
      if (state?.user?.role !== 'courier') {
        initQueuePositions().catch(console.error);
      }
    } catch {}
  }
}, 5000)
```

---

### Step 7: Defer AppListeners Sync Engine
**File**: `src/components/AppListeners.tsx` lines 229-308

**Before** (line 306):
```typescript
const timer = setTimeout(runSync, 3000)
```

**After**:
```typescript
const timer = setTimeout(() => {
  if (document.visibilityState === 'visible') {
    runSync();
  }
}, 5000)
```

---

### Step 8: Fix Preconnect Crossorigin
**File**: `index.html`

**Before**:
```html
<link rel="preconnect" href="https://www.googleapis.com" />
```

**After**:
```html
<link rel="preconnect" href="https://www.googleapis.com" crossorigin />
```

---

## Files to Modify

| File | Changes | Impact |
|------|---------|--------|
| `src/lib/firebase.ts` | Remove messaging import/export | -30KB main bundle |
| `src/lib/fcm.ts` | Add lazy messaging init | +2KB (only loaded for courier) |
| `src/App.tsx` | Dynamic import fcm.ts, defer customer sync | -30KB main bundle, -200ms CPU |
| `src/components/AppListeners.tsx` | Gate seed/init, defer sync | -100ms, -1 Firestore read |
| `index.html` | Add crossorigin to preconnect | Fix warning |

## Expected Results

| Metric | Before | After (Est.) |
|--------|--------|--------------|
| Performance Score | 55 | 65-75 |
| FCP | 2.3s | 1.8-2.0s |
| LCP | 5.9s | 4.0-5.0s |
| TBT | 660ms | 400-500ms |
| Main Bundle Transfer | 104KB | 70-80KB |
| Unused JS | 109KB | 50-60KB |
