import { db } from '@/lib/firebase'
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore'
import { User } from '@/types'

const defaultUsers: User[] = [
    {
        id: '1',
        name: 'Admin',
        email: 'admin@delivery.com',
        role: 'admin',
        password: 'admin123',
        phone: '+6281000000001',
        is_active: true,
        is_online: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: '2',
        name: 'Siti Rahayu',
        email: 'siti@courier.com',
        role: 'courier',
        password: 'courier123',
        phone: '+6281000000002',
        is_active: true,
        is_online: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: '3',
        name: 'Budi Santoso',
        email: 'budi@courier.com',
        role: 'courier',
        password: 'courier123',
        phone: '+6281000000003',
        is_active: true,
        is_online: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: '4',
        name: 'Ahmad Fauzi',
        email: 'ahmad@courier.com',
        role: 'courier',
        password: 'courier123',
        phone: '+6281000000004',
        is_active: true,
        is_online: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: '5',
        name: 'Dewi Kusuma',
        email: 'dewi@courier.com',
        role: 'courier',
        password: 'courier123',
        phone: '+6281000000005',
        is_active: true,
        is_online: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
]

export const seedUsers = async (): Promise<void> => {
    const colRef = collection(db, 'users')
    const existing = await getDocs(colRef)
    if (!existing.empty) {
        console.debug('Users already seeded — skipping')
        return
    }

    const batch = writeBatch(db)
    defaultUsers.forEach(user => {
        batch.set(doc(db, 'users', user.id), user)
    })
    await batch.commit()
    console.log(`Seeded ${defaultUsers.length} users to Firestore`)
}
