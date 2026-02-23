import { db } from './firebase'
import { collection, doc, setDoc, getDocs } from 'firebase/firestore'

const INITIAL_USERS = [
  { id: "1", name: "Super Admin", email: "admin@delivery.com", password: "admin123", role: "admin", is_active: true, commission_rate: 0, created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },
  { id: "2", name: "Admin Operational", email: "ops@delivery.com", password: "admin123", role: "admin", is_active: true, commission_rate: 0, created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },
  { id: "3", name: "Budi Santoso", email: "budi@courier.com", password: "courier123", role: "courier", is_active: true, is_online: false, commission_rate: 80, vehicle_type: "motorcycle", plate_number: "B 1234 ABC", phone: "+6281298765432", created_at: "2024-01-15T00:00:00Z", updated_at: "2024-01-15T00:00:00Z" },
  { id: "4", name: "Siti Aminah", email: "siti@courier.com", password: "courier123", role: "courier", is_active: true, is_online: false, commission_rate: 80, vehicle_type: "motorcycle", plate_number: "B 5678 DEF", phone: "+6281345678901", created_at: "2024-01-20T00:00:00Z", updated_at: "2024-01-20T00:00:00Z" },
  { id: "5", name: "Agus Pratama", email: "agus@courier.com", password: "courier123", role: "courier", is_active: true, is_online: false, commission_rate: 80, vehicle_type: "bicycle", plate_number: "-", phone: "+6281876543210", created_at: "2024-02-10T00:00:00Z", updated_at: "2024-02-10T00:00:00Z" },
]

export const seedFirestore = async () => {
  try {
    // Cek apakah sudah pernah di-seed
    const existing = await getDocs(collection(db, 'users'))
    if (!existing.empty) {
      console.log('⏭️ Firestore already seeded, skipping')
      return
    }

    // Seed users
    for (const user of INITIAL_USERS) {
      await setDoc(doc(db, 'users', user.id), user)
    }
    console.log('✅ Firestore seeded successfully')
  } catch (error) {
    console.error('❌ Seeding failed:', error)
  }
}
