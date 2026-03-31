import { db, getSecondaryAuth } from './firebase'
import { collection, doc, setDoc, getDocs } from 'firebase/firestore'
import { createUserWithEmailAndPassword } from 'firebase/auth'

const INITIAL_USERS = [
  // Legacy Super Admin (backward compat)
  { id: "1", name: "Super Admin", email: "admin@delivery.com", password: "admin123", role: "admin", is_active: true, commission_rate: 0, created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },

  // Admin Kurir - handles operations
  { id: "10", name: "Rina Operasional", email: "rina@delivery.com", password: "admin123", role: "admin_kurir", is_active: true, commission_rate: 0, created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },

  // Owner - business overview
  { id: "11", name: "Bos Besar", email: "owner@delivery.com", password: "owner123", role: "owner", is_active: true, commission_rate: 0, created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },

  // Finance - keuangan & penagihan
  { id: "12", name: "Dewi Keuangan", email: "finance@delivery.com", password: "finance123", role: "finance", is_active: true, commission_rate: 0, created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },

  // Couriers
  { id: "3", name: "Budi Santoso", email: "budi@courier.com", password: "courier123", role: "courier", is_active: true, is_online: false, commission_rate: 80, vehicle_type: "motorcycle", plate_number: "B 1234 ABC", phone: "+6281298765432", created_at: "2024-01-15T00:00:00Z", updated_at: "2024-01-15T00:00:00Z" },
  { id: "4", name: "Siti Aminah", email: "siti@courier.com", password: "courier123", role: "courier", is_active: true, is_online: false, commission_rate: 80, vehicle_type: "motorcycle", plate_number: "B 5678 DEF", phone: "+6281345678901", created_at: "2024-01-20T00:00:00Z", updated_at: "2024-01-20T00:00:00Z" },
  { id: "5", name: "Agus Pratama", email: "agus@courier.com", password: "courier123", role: "courier", is_active: true, is_online: false, commission_rate: 80, vehicle_type: "bicycle", plate_number: "-", phone: "+6281876543210", created_at: "2024-02-10T00:00:00Z", updated_at: "2024-02-10T00:00:00Z" },
]

export const seedFirestore = async () => {
  try {
    // Cek apakah sudah pernah di-seed di Firestore
    const existing = await getDocs(collection(db, 'users'))
    if (!existing.empty) {
      console.log('⏭️ Firestore already seeded, skipping')
      return
    }

    const secondaryAuth = getSecondaryAuth();

    // Seed users
    for (const user of INITIAL_USERS) {
      // 1. Create in Firestore
      await setDoc(doc(db, 'users', user.id), user)

      // 2. Create in Firebase Auth (using secondaryAuth to not disrupt session)
      try {
        await createUserWithEmailAndPassword(secondaryAuth, user.email, user.password)
        console.log(`👤 Auth user created: ${user.email}`)
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-in-use') {
          console.log(`ℹ️ Auth user already exists: ${user.email}`)
        } else {
          console.error(`❌ Failed to create auth user ${user.email}:`, authError)
        }
      }
    }
    console.log('✅ Firestore and Auth seeded successfully')
  } catch (error) {
    console.error('❌ Seeding failed:', error)
  }
}
