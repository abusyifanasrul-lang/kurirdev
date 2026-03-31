import { create } from 'zustand'
import { db } from '@/lib/firebase'
import { collection, doc, setDoc, updateDoc, onSnapshot, getDocs, query, where } from 'firebase/firestore'
import { User } from '@/types'

interface UserState {
  users: User[]
  isLoading: boolean
  subscribeUsers: () => () => void
  addUser: (user: User) => Promise<void>
  updateUser: (id: string, data: Partial<User>) => Promise<void>
  removeUser: (id: string) => Promise<void>
  updateUserQueuePosition: (id: string, position: number) => Promise<void>
  initQueuePositions: () => Promise<void>
}

export const useUserStore = create<UserState>()((set, get) => ({
  users: [],
  isLoading: true,

  subscribeUsers: () => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const users = snapshot.docs.map(d => d.data() as User)
      set({ users, isLoading: false })
    })
    return unsub
  },

  addUser: async (user) => {
    const couriers = get().users.filter(u => u.role === 'courier')
    const maxPos = couriers.reduce((max, c) => Math.max(max, (c as any).queue_position ?? 0), 0)
    const dataToSave: any = { ...user }
    if (user.role === 'courier') {
      dataToSave.queue_position = maxPos + 1
    }
    await setDoc(doc(db, 'users', user.id), dataToSave)
  },

  updateUser: async (id, data) => {
    await updateDoc(doc(db, 'users', id), { ...data, updated_at: new Date().toISOString() })
  },

  removeUser: async (id) => {
    if (id === '1') return Promise.resolve()
    await updateDoc(doc(db, 'users', id), { is_active: false })
  },

  updateUserQueuePosition: async (id, position) => {
    await updateDoc(doc(db, 'users', id), {
      queue_position: position,
      updated_at: new Date().toISOString(),
    })
  },

  initQueuePositions: async () => {
    const snapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'courier')))
    if (snapshot.empty) return

    const allCouriers = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[]

    // Pisahkan: yang sudah punya queue_position vs yang belum
    const alreadyHasPosition = allCouriers.filter(c => c.queue_position != null)
    const needsPosition = allCouriers.filter(c => c.queue_position == null)

    // Jika semua sudah punya position, tidak perlu lakukan apapun
    if (needsPosition.length === 0) return

    // Posisi baru dimulai dari angka setelah posisi tertinggi yang sudah ada
    // Kurir lama yang sudah punya posisi tidak disentuh sama sekali
    const maxExisting = alreadyHasPosition.reduce(
      (max, c) => Math.max(max, c.queue_position ?? 0), 0
    )

    // Kurir baru (belum punya posisi) diurutkan by created_at
    const sorted = [...needsPosition].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    // Set posisi hanya untuk kurir yang belum punya
    for (let i = 0; i < sorted.length; i++) {
      await updateDoc(doc(db, 'users', sorted[i].id), {
        queue_position: maxExisting + i + 1,
        updated_at: new Date().toISOString(),
      })
    }
  },
}))
