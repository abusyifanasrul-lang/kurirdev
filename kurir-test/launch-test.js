/**
 * KurirMe Multi-User Testing Script
 * 
 * Script ini membuka multiple browser windows dengan profil terisolasi
 * untuk mensimulasikan banyak kurir + admin secara bersamaan.
 * 
 * Setiap window memiliki:
 * - IndexedDB terpisah
 * - Service Worker terpisah
 * - localStorage terpisah
 * - Cookie terpisah
 * 
 * Ini penting untuk PWA testing!
 */

const { chromium } = require('playwright');
const { APP_URL, ADMIN, COURIERS } = require('./users.config');

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN FUNCTION
// ═══════════════════════════════════════════════════════════════════════════
async function doLogin(page, email, password, userName) {
  try {
    console.log(`  🔐 Mencoba login: ${email}`);
    
    // Tunggu form login muncul
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    
    // Isi form
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    
    // Klik tombol "Masuk Sekarang"
    await page.getByRole('button', { name: 'Masuk Sekarang' }).click();
    
    // Tunggu navigasi selesai (redirect ke dashboard)
    await page.waitForNavigation({ timeout: 10000 });
    
    console.log(`  ✅ Login berhasil: ${userName}`);
    return true;
  } catch (e) {
    console.log(`  ⚠️  Login gagal atau sudah masuk: ${e.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN FUNCTION
// ═══════════════════════════════════════════════════════════════════════════
(async () => {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  KurirMe Multi-User Testing — Playwright Launcher         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  const total = COURIERS.length + 1; // +1 untuk admin
  
  console.log(`📊 Total windows: ${total} (1 Admin + ${COURIERS.length} Kurir)`);
  console.log(`🌐 Target URL: ${APP_URL}\n`);
  
  // Launch browser
  const browser = await chromium.launch({
    headless: false,  // Tampilkan jendela browser
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',  // Hide automation detection
    ],
  });

  // ─────────────────────────────────────────────────────────────────────────
  // WINDOW 1: ADMIN (Normal Window)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Membuka dashboard Admin...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const adminCtx = await browser.newContext({
    ignoreHTTPSErrors: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    permissions: ['notifications'],  // Enable notifications
  });
  
  const adminPage = await adminCtx.newPage();
  
  // Navigate ke halaman admin
  await adminPage.goto(`${APP_URL}${ADMIN.route}`);
  
  // Login
  await doLogin(adminPage, ADMIN.loginEmail, ADMIN.loginPassword, ADMIN.name);
  
  // Set title untuk mudah identifikasi
  await adminPage.evaluate((name) => { 
    document.title = `👑 ${name}`; 
  }, ADMIN.name);
  
  console.log('  ✅ Admin window siap (normal window, bisa di-resize)\n');

  // ─────────────────────────────────────────────────────────────────────────
  // WINDOWS 2-N: COURIERS (Normal Windows)
  // ─────────────────────────────────────────────────────────────────────────
  for (let i = 0; i < COURIERS.length; i++) {
    const kurir = COURIERS[i];

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🚴 Membuka dashboard ${kurir.name}...`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // CRITICAL: newContext() = profil baru = IndexedDB + SW + localStorage TERISOLASI
    const ctx = await browser.newContext({
      ignoreHTTPSErrors: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      viewport: null,
      permissions: ['notifications', 'geolocation'],  // Enable notifications and geolocation
      geolocation: { latitude: -5.1477, longitude: 119.4327 },  // Makassar coordinates
    });
    
    const page = await ctx.newPage();
    
    // Navigate ke halaman login
    await page.goto(`${APP_URL}`);
    
    // Login
    await doLogin(page, kurir.loginEmail, kurir.loginPassword, kurir.name);
    
    // CRITICAL: Inject viewport meta tag untuk PWA responsive behavior
    await page.evaluate(() => {
      // Set viewport meta tag
      let meta = document.querySelector('meta[name="viewport"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'viewport';
        document.head.appendChild(meta);
      }
      meta.content = 'width=device-width, initial-scale=1.0';
      
      // Enable QR/STAY for testing
      localStorage.setItem('qr_stay_enabled', 'true');
      window.__QR_STAY_ENABLED = true;
      
      // Log realtime connection status periodically
      let checkCount = 0;
      const monitorInterval = setInterval(() => {
        checkCount++;
        const stores = window.__ZUSTAND_STORES__;
        if (stores?.orderStore) {
          const state = stores.orderStore.getState();
          console.log(`[RT-Monitor ${checkCount}] Status:`, state.realtimeStatus, '| Active Orders:', state.activeOrdersByCourier.length);
        }
        if (checkCount >= 20) clearInterval(monitorInterval);  // Stop after 20 checks (100s)
      }, 5000);
    });
    
    // Reload to apply viewport changes
    await page.reload({ waitUntil: 'networkidle' });
    
    // Set title
    await page.evaluate((k) => { 
      document.title = `🚴 ${k.name}`; 
    }, kurir);

    console.log(`  ✅ ${kurir.name} window siap\n`);
    
    // Stagger launch to reduce concurrent load and race conditions
    await page.waitForTimeout(2500);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DONE
  // ─────────────────────────────────────────────────────────────────────────
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    🎉 SETUP SELESAI! 🎉                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  console.log(`✅ ${total} windows berhasil dibuka dan terisolasi`);
  console.log('📱 Setiap window memiliki IndexedDB, SW, dan localStorage terpisah');
  console.log('🔍 Cek title bar tiap window untuk identifikasi (👑 Admin, 🚴 Kurir)');
  console.log('🔔 Notifications dan Geolocation permissions sudah diaktifkan');
  console.log('\n💡 Tips Testing:');
  console.log('   • Admin: Buat order baru dan assign ke kurir');
  console.log('   • Kurir: Ubah status (ON/STAY/OFF) untuk testing antrian');
  console.log('   • Dashboard admin akan update real-time via Supabase');
  console.log('   • Resize window sesuai kebutuhan (tidak ada constraint)');
  console.log('   • Buka Console (F12) untuk melihat [RT-Monitor] logs');
  console.log('\n📊 Monitoring:');
  console.log('   • Setiap 5 detik akan muncul log [RT-Monitor] di console');
  console.log('   • Check "Status" untuk realtime connection state');
  console.log('   • Check "Active Orders" untuk jumlah order aktif');
  console.log('\n⚠️  Tutup terminal ini (Ctrl+C) untuk menutup semua window\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Jaga proses tetap hidup
  await new Promise(() => {});
})();
