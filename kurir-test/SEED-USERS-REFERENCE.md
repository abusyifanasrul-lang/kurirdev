# Referensi Seed Users untuk Testing

File ini berisi daftar lengkap seed users dari `temp/Seed_Users_Review.md` untuk referensi testing.

## 🎯 Users yang Digunakan untuk Testing

### Admin (1)
| Nama | Email | Password | Role |
|------|-------|----------|------|
| Super Admin | admin@kurirme.com | admin123 | admin |

### Kurir (8 dari 40)
| No | Nama | Email | Password | Role |
|----|------|-------|----------|------|
| 1 | Andi | andi@kurirme.com | courier123 | courier |
| 2 | Baso | baso@kurirme.com | courier123 | courier |
| 3 | Daeng | daeng@kurirme.com | courier123 | courier |
| 4 | Tenri | tenri@kurirme.com | courier123 | courier |
| 5 | Faisal | faisal@kurirme.com | courier123 | courier |
| 6 | Ahmad | ahmad@kurirme.com | courier123 | courier |
| 7 | Budi | budi@kurirme.com | courier123 | courier |
| 8 | Anto | anto@kurirme.com | courier123 | courier |

**Total**: 9 windows (1 admin + 8 kurir)

---

## 📋 Daftar Lengkap Seed Users (46 Total)

### Admin & Management (6)
| No | Nama | Email | Role | Password |
|---|---|---|---|---|
| 1 | Super Admin | admin@kurirme.com | admin | admin123 |
| 2 | Owner | owner@kurirme.com | owner | admin123 |
| 3 | Finance | finance@kurirme.com | finance | admin123 |
| 4 | Rina | rina@kurirme.com | admin_kurir | admin123 |
| 5 | Susi | susi@kurirme.com | admin_kurir | admin123 |
| 6 | Maya | maya@kurirme.com | admin_kurir | admin123 |

### Kurir (40)
| No | Nama | Email | Password |
|---|---|---|---|
| 7 | Andi | andi@kurirme.com | courier123 |
| 8 | Baso | baso@kurirme.com | courier123 |
| 9 | Daeng | daeng@kurirme.com | courier123 |
| 10 | Tenri | tenri@kurirme.com | courier123 |
| 11 | Faisal | faisal@kurirme.com | courier123 |
| 12 | Ahmad | ahmad@kurirme.com | courier123 |
| 13 | Budi | budi@kurirme.com | courier123 |
| 14 | Anto | anto@kurirme.com | courier123 |
| 15 | Iwan | iwan@kurirme.com | courier123 |
| 16 | Rudi | rudi@kurirme.com | courier123 |
| 17 | Ali | ali@kurirme.com | courier123 |
| 18 | Isal | isal@kurirme.com | courier123 |
| 19 | Amir | amir@kurirme.com | courier123 |
| 20 | Jufri | jufri@kurirme.com | courier123 |
| 21 | Syamsul | syamsul@kurirme.com | courier123 |
| 22 | Akbar | akbar@kurirme.com | courier123 |
| 23 | Ridwan | ridwan@kurirme.com | courier123 |
| 24 | Firman | firman@kurirme.com | courier123 |
| 25 | Hamzah | hamzah@kurirme.com | courier123 |
| 26 | Yusuf | yusuf@kurirme.com | courier123 |
| 27 | Aris | aris@kurirme.com | courier123 |
| 28 | Hendra | hendra@kurirme.com | courier123 |
| 29 | Putra | putra@kurirme.com | courier123 |
| 30 | Wahyu | wahyu@kurirme.com | courier123 |
| 31 | Agung | agung@kurirme.com | courier123 |
| 32 | Bayu | bayu@kurirme.com | courier123 |
| 33 | Adit | adit@kurirme.com | courier123 |
| 34 | Dimas | dimas@kurirme.com | courier123 |
| 35 | Eko | eko@kurirme.com | courier123 |
| 36 | Fajar | fajar@kurirme.com | courier123 |
| 37 | Galang | galang@kurirme.com | courier123 |
| 38 | Heru | heru@kurirme.com | courier123 |
| 39 | Indra | indra@kurirme.com | courier123 |
| 40 | Joko | joko@kurirme.com | courier123 |
| 41 | Lucky | lucky@kurirme.com | courier123 |
| 42 | Nanang | nanang@kurirme.com | courier123 |
| 43 | Oki | oki@kurirme.com | courier123 |
| 44 | Puji | puji@kurirme.com | courier123 |
| 45 | Soni | soni@kurirme.com | courier123 |
| 46 | Taufiq | taufiq@kurirme.com | courier123 |

---

## 🔄 Mengganti Kurir untuk Testing

Jika ingin testing dengan kurir yang berbeda, edit `users.config.js`:

```javascript
COURIERS: [
  // Ganti dengan kurir lain dari daftar di atas
  { name: 'Iwan', loginEmail: 'iwan@kurirme.com', loginPassword: 'courier123' },
  { name: 'Rudi', loginEmail: 'rudi@kurirme.com', loginPassword: 'courier123' },
  { name: 'Ali', loginEmail: 'ali@kurirme.com', loginPassword: 'courier123' },
  // ... dst
],
```

---

## 📊 Testing dengan Lebih Banyak Kurir

Untuk testing dengan 10-15 kurir, tambahkan lebih banyak entry di `COURIERS[]`:

```javascript
COURIERS: [
  { name: 'Andi', loginEmail: 'andi@kurirme.com', loginPassword: 'courier123' },
  { name: 'Baso', loginEmail: 'baso@kurirme.com', loginPassword: 'courier123' },
  { name: 'Daeng', loginEmail: 'daeng@kurirme.com', loginPassword: 'courier123' },
  { name: 'Tenri', loginEmail: 'tenri@kurirme.com', loginPassword: 'courier123' },
  { name: 'Faisal', loginEmail: 'faisal@kurirme.com', loginPassword: 'courier123' },
  { name: 'Ahmad', loginEmail: 'ahmad@kurirme.com', loginPassword: 'courier123' },
  { name: 'Budi', loginEmail: 'budi@kurirme.com', loginPassword: 'courier123' },
  { name: 'Anto', loginEmail: 'anto@kurirme.com', loginPassword: 'courier123' },
  { name: 'Iwan', loginEmail: 'iwan@kurirme.com', loginPassword: 'courier123' },
  { name: 'Rudi', loginEmail: 'rudi@kurirme.com', loginPassword: 'courier123' },
  { name: 'Ali', loginEmail: 'ali@kurirme.com', loginPassword: 'courier123' },
  { name: 'Isal', loginEmail: 'isal@kurirme.com', loginPassword: 'courier123' },
  { name: 'Amir', loginEmail: 'amir@kurirme.com', loginPassword: 'courier123' },
  { name: 'Jufri', loginEmail: 'jufri@kurirme.com', loginPassword: 'courier123' },
  { name: 'Syamsul', loginEmail: 'syamsul@kurirme.com', loginPassword: 'courier123' },
],
```

**Catatan**: Semakin banyak window, semakin kecil ukuran tiap window (grid layout otomatis).

---

## 🎯 Rekomendasi Testing

### Testing Ringan (3-5 kurir)
Cukup untuk testing basic queue flow dan tier system.

### Testing Sedang (6-10 kurir)
Ideal untuk testing queue rotation dan multiple concurrent orders.

### Testing Berat (15-20 kurir)
Untuk stress testing dan observasi performa sistem antrian.

---

**Referensi**: `temp/Seed_Users_Review.md`  
**Tanggal**: 8 Mei 2026
