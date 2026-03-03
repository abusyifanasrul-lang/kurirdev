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
    await setDoc(doc(db, 'users', user.id), {
      ...user,
      queue_position: user.role === 'courier' ? maxPos + 1 : undefined,
    })
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
    const couriers = snapshot.docs
      .map(d => d.data())
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    for (let i = 0; i < couriers.length; i++) {
      await updateDoc(doc(db, 'users', couriers[i].id), {
        queue_position: i + 1,
        updated_at: new Date().toISOString(),
      })
    }
  },
}))
