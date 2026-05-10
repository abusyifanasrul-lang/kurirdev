# 5 Critical Bugs Fixed in PWA Auto-Update System

## 🔴 BUG #1: `self.skipWaiting()` di install event (FATAL)

### Masalah:
```javascript
// sw.js - LINE 83
self.addEventListener('install', (event) => {
  self.skipWaiting(); // ← INI BUNUH SEGALANYA
});
```

**Akibat:**
- `skipWaiting()` membuat SW baru langsung ambil alih tanpa tunggu
- `reg.waiting` tidak pernah terisi (langsung lompat ke `activated`)
- PWAUpdateBanner yang bergantung pada `reg.waiting` tidak pernah trigger
- Tombol "Update Sekarang" tidak pernah dipakai karena SW sudah skip sendiri

### Fix:
```javascript
self.addEventListener('install', (event) => {
  const BUILD_VERSION = '__BUILD_VERSION__';
  console.log(`🔧 [SW] Installing... Build: ${BUILD_VERSION}`);
  // ✅ HAPUS self.skipWaiting() dari sini!
  // SW harus tunggu user konfirmasi via banner
});

// skipWaiting HANYA dari pesan banner
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting(); // ← Setelah user klik "Update Sekarang"
  }
});
```

---

## 🔴 BUG #2: Placeholder `__BUILD_VERSION__` sudah terganti permanen (FATAL)

### Masalah:
```javascript
// sw.js yang di-commit ke GitHub - sudah hardcoded!
const BUILD_VERSION = '1778449117182'; // ← PLACEHOLDER SUDAH HILANG
```

**Akibat:**
- Inject script mencari `/__BUILD_VERSION__/g` → tidak ketemu
- Tidak ada yang diganti → `sw.js` byte-nya identik setiap deploy
- Browser tidak detect perubahan → update tidak pernah trigger

**Root cause:** Developer commit `sw.js` yang sudah ter-inject, bukan template-nya

### Fix:
```javascript
// 1. Rename sw.js → sw.template.js (template dengan placeholder)
// 2. Add public/sw.js ke .gitignore (file generated, jangan commit)
// 3. Update inject script untuk baca dari template

// scripts/inject-sw-version.cjs
const templatePath = path.join(__dirname, '..', 'public', 'sw.template.js');
const outputPath = path.join(__dirname, '..', 'public', 'sw.js');

let swContent = fs.readFileSync(templatePath, 'utf8');
swContent = swContent.replace(/__BUILD_VERSION__/g, version);
fs.writeFileSync(outputPath, swContent, 'utf8');
```

---

## 🔴 BUG #3: `self.__WB_MANIFEST` tidak ada di sw.js

### Masalah:
`vite.config.ts` pakai `strategies: "injectManifest"` yang wajib ada `self.__WB_MANIFEST` di source sw.js sebagai injection point.

**Akibat:**
- VitePWA tidak bisa inject precache manifest
- `sw.js` tidak berubah berdasarkan perubahan assets
- Satu-satunya mekanisme perubahan byte (inject script) sudah rusak karena Bug #2

### Fix:
```javascript
// sw.template.js
// ✅ Tambah self.__WB_MANIFEST untuk VitePWA injectManifest
const WB_MANIFEST = self.__WB_MANIFEST || [];

if (workbox) {
  // Precache assets dari manifest (diinjeksi VitePWA saat build)
  if (WB_MANIFEST && WB_MANIFEST.length > 0) {
    console.log(`📦 [SW] Precaching ${WB_MANIFEST.length} assets`);
    workbox.precaching.precacheAndRoute(WB_MANIFEST);
  }
}
```

---

## 🟡 BUG #4: Stale closure di setInterval dalam PWAUpdateBanner

### Masalah:
```javascript
// App.tsx
const checkInterval = setInterval(() => {
  if (reg.waiting && !waitingWorker) { // ← 'waitingWorker' STALE
    setWaitingWorker(reg.waiting);
  }
}, 5000);

return () => clearInterval(checkInterval); // ← return ini di dalam .then(),
                                            //   BUKAN di return useEffect
```

**Akibat:**
- Cleanup function tidak pernah dipanggil React (posisinya salah)
- Interval terus jalan meskipun component unmount
- Memory leak

### Fix:
```javascript
useEffect(() => {
  let checkInterval: ReturnType<typeof setInterval>;

  navigator.serviceWorker.ready.then(reg => {
    // ...
    
    // ✅ checkInterval pakai ref, bukan closure atas waitingWorker
    checkInterval = setInterval(() => {
      if (reg.waiting) {
        setWaitingWorker(prev => prev ?? reg.waiting); // Hanya set jika belum ada
      }
    }, 5000);
  });

  // ✅ cleanup langsung di return useEffect
  return () => {
    if (checkInterval) clearInterval(checkInterval);
  };
}, []); // ✅ dependency array kosong
```

---

## 🟡 BUG #5: useEffect dependency `[waitingWorker]` menyebabkan re-register listener

### Masalah:
```javascript
useEffect(() => {
  // ...
  reg.addEventListener('updatefound', ...); // ← listener ditambah ulang
}, [waitingWorker]); // ← trigger re-run setiap waitingWorker berubah
```

**Akibat:**
- Setiap kali `setWaitingWorker` dipanggil, effect re-run
- Menambah listener `updatefound` baru tanpa hapus yang lama
- Memory leak + listener ganda

### Fix:
```javascript
useEffect(() => {
  if (!('serviceWorker' in navigator)) return;

  let checkInterval: ReturnType<typeof setInterval>;

  navigator.serviceWorker.ready.then(reg => {
    if (reg.waiting) {
      setWaitingWorker(reg.waiting);
      return; // Sudah ada waiting worker, tidak perlu setup listener
    }
    
    // Setup listener hanya sekali
    reg.addEventListener('updatefound', () => {
      // ...
    });
    
    checkInterval = setInterval(() => {
      // ...
    }, 5000);
  });

  return () => {
    if (checkInterval) clearInterval(checkInterval);
  };
}, []); // ✅ dependency array KOSONG - hanya setup sekali
```

---

## 📊 RINGKASAN FIX

| Bug | Severity | Fix |
|-----|----------|-----|
| #1 | 🔴 FATAL | Hapus `skipWaiting()` dari install, pindah ke message handler |
| #2 | 🔴 FATAL | Gunakan `sw.template.js`, jangan commit `sw.js` |
| #3 | 🔴 FATAL | Tambah `self.__WB_MANIFEST` untuk VitePWA |
| #4 | 🟡 HIGH | Fix cleanup position dan stale closure |
| #5 | 🟡 HIGH | Hapus `waitingWorker` dari useEffect deps |

---

## 🔄 FLOW YANG BENAR SETELAH FIX

```
1. git push → Vercel build
2. Build script: node scripts/inject-sw-version.cjs
   - Read sw.template.js (placeholder intact)
   - Replace __BUILD_VERSION__ → Git SHA
   - Write sw.js (byte berubah)
3. VitePWA: Inject manifest ke self.__WB_MANIFEST
4. Vercel deploy
5. Browser fetch sw.js → ETag berbeda
6. SW install event → TIDAK skipWaiting (tunggu user)
7. reg.waiting terisi ✅
8. PWAUpdateBanner detect waiting worker ✅
9. Popup "Pembaruan Tersedia" muncul ✅
10. User klik "Update Sekarang"
11. waitingWorker.postMessage({ type: 'SKIP_WAITING' })
12. SW skipWaiting() → activate
13. window.location.reload()
14. Versi terbaru ✅
```

---

## 📝 FILES CHANGED

1. `public/sw.js` → `public/sw.template.js` (renamed, placeholder restored)
2. `scripts/inject-sw-version.cjs` (read from template, write to sw.js)
3. `.gitignore` (add `public/sw.js`)
4. `src/App.tsx` (fix PWAUpdateBanner useEffect)

---

## ✅ COMMIT

```bash
bc7997d5 - fix: CRITICAL - fix all 5 bugs in PWA auto-update system
```

---

## 🎯 EXPECTED RESULT

Setelah fix ini:
- ✅ `sw.js` byte berubah setiap deploy (Git SHA injected)
- ✅ Browser detect perubahan
- ✅ `reg.waiting` terisi
- ✅ Popup muncul
- ✅ User klik update → reload → versi terbaru
- ✅ **AUTO-UPDATE BERFUNGSI 100%!**
