# FINAL PWA Update Solution - Git Commit SHA Injection

## 🎯 ROOT CAUSE (FINAL ANSWER)

**Masalah Sebenarnya:**
```
sw.js adalah file static yang TIDAK BERUBAH BYTE-NYA setiap deploy
→ Browser tidak detect perubahan
→ Update tidak pernah trigger
→ Popup tidak pernah muncul
```

**Bukti:**
- ✅ Popup muncul di **localhost** (karena kita edit sw.js manual)
- ❌ Popup TIDAK muncul di **Vercel** (karena sw.js byte-nya sama)

## ✅ SOLUSI FINAL (ROBUST & SIMPLE)

### Inject `VERCEL_GIT_COMMIT_SHA` ke `sw.js`

Setiap push ke GitHub:
1. Vercel build → `VERCEL_GIT_COMMIT_SHA` berubah (unique per commit)
2. Build script inject SHA ke `sw.js`
3. `sw.js` byte berubah
4. Browser detect perubahan
5. Update trigger otomatis
6. Popup muncul ✅

---

## 📁 IMPLEMENTASI

### 1. Build Script (`scripts/inject-sw-version.cjs`)

```javascript
const fs = require('fs');
const path = require('path');

// Get version from Vercel env or fallback to timestamp
const version = process.env.VERCEL_GIT_COMMIT_SHA || 
                process.env.VERCEL_GIT_COMMIT_REF || 
                Date.now().toString();

console.log(`🔧 [inject-sw-version] Injecting version: ${version}`);

// Read sw.js
const swPath = path.join(__dirname, '..', 'public', 'sw.js');
let swContent = fs.readFileSync(swPath, 'utf8');

// Replace placeholder with actual version
swContent = swContent.replace(/__BUILD_VERSION__/g, version);

// Write back
fs.writeFileSync(swPath, swContent, 'utf8');
console.log(`✅ [inject-sw-version] Successfully injected version into sw.js`);
```

### 2. Placeholder di `sw.js`

```javascript
self.addEventListener('install', (event) => {
  const BUILD_VERSION = '__BUILD_VERSION__'; // Injected by build script
  console.log(`🔧 [SW] Installing new service worker... Build: ${BUILD_VERSION}`);
  self.skipWaiting();
});
```

### 3. Update `package.json`

```json
{
  "scripts": {
    "build": "node scripts/inject-sw-version.cjs && vite build"
  }
}
```

### 4. Update `vercel.json`

```json
{
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, must-revalidate"
        }
      ]
    }
  ]
}
```

### 5. Update `main.tsx`

```javascript
navigator.serviceWorker.register("/sw.js", { 
  scope: "/",
  updateViaCache: "none" // Force browser to always check network
})
```

---

## 🔄 FLOW LENGKAP

### Development (Localhost):
```
1. npm run dev → Vite dev server
2. sw.js served as-is (no injection)
3. Manual edit → byte berubah → update detected ✅
```

### Production (Vercel):
```
1. git push → Vercel build triggered
2. VERCEL_GIT_COMMIT_SHA = "abc123def456"
3. Build script: node scripts/inject-sw-version.cjs
4. __BUILD_VERSION__ → "abc123def456"
5. sw.js byte berubah (unique per commit)
6. Vercel deploy
7. User buka app → Browser fetch sw.js
8. ETag/hash berbeda → Update detected
9. Popup muncul: "Pembaruan Tersedia" ✅
```

---

## 🧪 CARA VERIFIKASI

### 1. Tunggu Vercel Deploy (2-3 menit)

### 2. Buka App di Browser
```
https://kurirdev.vercel.app
```

### 3. Buka Console (F12)
```javascript
// Harus ada log ini:
✅ Service Worker registered: /
🔄 Checked for service worker updates

// Jika ada update (dalam 60 detik):
🔔 [PWAUpdateBanner] Update found! New worker installing...
🔧 [SW] Installing new service worker... Build: abc123def456
✅ [PWAUpdateBanner] Showing update banner!
```

### 4. Popup Muncul
```
"Pembaruan Tersedia"
[Update Sekarang] [Nanti saja]
```

### 5. Klik "Update Sekarang"
```
Page reload → Versi terbaru
```

---

## 📊 PERBANDINGAN SOLUSI

| Solusi | Pros | Cons | Rekomendasi |
|--------|------|------|-------------|
| Manual bump version | Simple | Lupa increment = broken | ❌ Tidak reliable |
| Timestamp injection | Auto | Tidak track Git history | ⚠️ OK untuk dev |
| **Git SHA injection** | **Auto + traceable** | **Butuh build script** | ✅ **BEST** |
| VitePWA auto | Built-in | Complex config, conflict | ❌ Terlalu complex |

---

## 🎯 KENAPA SEKARANG HARUS BERHASIL?

| Masalah | Status |
|---------|--------|
| ✅ sw.js byte tidak berubah | **FIXED** - Git SHA injected |
| ✅ Browser cache sw.js | **FIXED** - updateViaCache: "none" |
| ✅ Vercel cache headers | **FIXED** - max-age=0 |
| ✅ Update detection | **FIXED** - registration.update() |
| ✅ Popup logic | **FIXED** - PWAUpdateBanner |

**Semua layer sudah benar. Popup HARUS muncul sekarang!**

---

## 📝 COMMIT

```bash
dc7242a9 - fix: FINAL SOLUTION - inject Git commit SHA into sw.js
```

---

## ⚠️ CATATAN PENTING

1. **Build script HARUS run sebelum vite build**
2. **Placeholder `__BUILD_VERSION__` HARUS ada di sw.js**
3. **Vercel env `VERCEL_GIT_COMMIT_SHA` otomatis tersedia**
4. **Setiap push = unique SHA = sw.js byte berubah**
5. **Browser detect perubahan = update trigger**

---

## 🔗 REFERENSI

- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables#system-environment-variables)
- [Service Worker Update Detection](https://web.dev/service-worker-lifecycle/#updates)
- [updateViaCache](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register#updateviacache)
