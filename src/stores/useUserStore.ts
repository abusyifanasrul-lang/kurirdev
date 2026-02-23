import { create } from 'zustand'
import { db } from '@/lib/firebase'
import { collection, doc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore'
import { User } from '@/types'

interface UserState {
  users: User[]
  isLoading: boolean
  subscribeUsers: () => () => void
  addUser: (user: User) => Promise<void>
  updateUser: (id: string, data: Partial<User>) => Promise<void>
  removeUser: (id: string) => Promise<void>
}

export const useUserStore = create<UserState>()((set) => ({
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
    await setDoc(doc(db, 'users', user.id), user)
  },

  updateUser: async (id, data) => {
    await updateDoc(doc(db, 'users', id), { ...data, updated_at: new Date().toISOString() })
  },

  removeUser: async (id) => {
    if (id === '1') return Promise.resolve()
    await updateDoc(doc(db, 'users', id), { is_active: false })
  },
}))
