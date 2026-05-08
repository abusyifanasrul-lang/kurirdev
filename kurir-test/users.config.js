/**
 * Konfigurasi Akun untuk Testing Multi-User
 * 
 * PENTING: Akun-akun ini sesuai dengan Seed_Users_Review.md
 * 
 * Seed users sudah dibuat di Supabase dengan credentials:
 * - Super Admin: admin@kurirme.com / admin123
 * - Couriers: [nama]@kurirme.com / courier123
 * 
 * Total: 1 Super Admin + 8 Kurir untuk testing
 */

module.exports = {
  // URL aplikasi yang akan ditest
  APP_URL: 'http://localhost:5173', // Ganti dengan URL dev Anda (atau https://kurirdev.vercel.app)

  // ═══════════════════════════════════════════════════════════════════════════
  // AKUN ADMIN
  // ═══════════════════════════════════════════════════════════════════════════
  ADMIN: {
    name: 'Super Admin',
    route: '/admin', // Path dashboard admin setelah login
    loginEmail: 'admin@kurirme.com',
    loginPassword: 'admin123',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AKUN KURIR (8 Kurir untuk Testing)
  // ═══════════════════════════════════════════════════════════════════════════
  // Dipilih dari 40 kurir seed untuk testing sistem antrian
  COURIERS: [
    { 
      name: 'Andi', 
      loginEmail: 'andi@kurirme.com',
      loginPassword: 'courier123'
    },
    { 
      name: 'Baso', 
      loginEmail: 'baso@kurirme.com',
      loginPassword: 'courier123'
    },
    { 
      name: 'Daeng', 
      loginEmail: 'daeng@kurirme.com',
      loginPassword: 'courier123'
    },
    { 
      name: 'Tenri', 
      loginEmail: 'tenri@kurirme.com',
      loginPassword: 'courier123'
    },
    { 
      name: 'Faisal', 
      loginEmail: 'faisal@kurirme.com',
      loginPassword: 'courier123'
    },
    { 
      name: 'Ahmad', 
      loginEmail: 'ahmad@kurirme.com',
      loginPassword: 'courier123'
    },
    { 
      name: 'Budi', 
      loginEmail: 'budi@kurirme.com',
      loginPassword: 'courier123'
    },
    { 
      name: 'Anto', 
      loginEmail: 'anto@kurirme.com',
      loginPassword: 'courier123'
    },
  ],
};
