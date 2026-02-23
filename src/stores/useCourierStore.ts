import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Courier } from '@/types'
import { useUserStore } from './useUserStore'

interface CourierState {
  _storeVersion: string
  queue: Courier[]
  readonly couriers: Courier[]

  resetStore: () => void
  addCourier: (courier: Courier) => Promise<void>
  updateCourier: (id: string, data: Partial<Courier>) => Promise<void>
  updateCourierStatus: (id: string, data: Partial<Courier>) => Promise<void>
  removeCourier: (id: string) => Promise<void>
  getAvailableCouriers: () => Courier[]
  rotateQueue: (id: string) => void
}

const INITIAL_QUEUE: Courier[] = [
  {
    id: "3",
    name: 'Budi Santoso',
    email: 'budi@courier.com',
    role: 'courier',
    password: 'courier123',
    phone: '+6281298765432',
    is_active: true,
    is_online: true,
    vehicle_type: 'motorcycle',
    plate_number: 'B 1234 ABC',
    commission_rate: 80,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  },
  {
    id: "4",
    name: 'Siti Aminah',
    email: 'siti@courier.com',
    role: 'courier',
    password: 'courier123',
    phone: '+6281345678901',
    is_active: true,
    is_online: true,
    vehicle_type: 'motorcycle',
    plate_number: 'B 5678 DEF',
    commission_rate: 80,
    created_at: '2024-01-20T00:00:00Z',
    updated_at: '2024-01-20T00:00:00Z',
  },
  {
    id: "5",
    name: 'Agus Pratama',
    email: 'agus@courier.com',
    role: 'courier',
    password: 'courier123',
    phone: '+6281876543210',
    is_active: true,
    is_online: false,
    vehicle_type: 'bicycle',
    plate_number: '-',
    commission_rate: 80,
    created_at: '2024-02-10T00:00:00Z',
    updated_at: '2024-02-10T00:00:00Z',
  },
]

const STORE_VERSION = '1.0.4'

export const useCourierStore = create<CourierState>()(
  persist(
    (set, get) => ({
      _storeVersion: STORE_VERSION,
      queue: INITIAL_QUEUE,

      get couriers() {
        return useUserStore.getState().users.filter(u => u.role === 'courier') as Courier[]
      },

      resetStore: () => set({
        queue: INITIAL_QUEUE,
        _storeVersion: STORE_VERSION
      }),

      addCourier: async (courier) => {
        set((state) => ({ queue: [...state.queue, courier] }))
        await useUserStore.getState().addUser(courier)
      },

      updateCourier: async (id, data) => {
        set((state) => ({
          queue: state.queue.map((c) =>
            c.id === id
              ? { ...c, ...data, updated_at: new Date().toISOString() }
              : c
          )
        }))
        await useUserStore.getState().updateUser(id, data)
      },

      updateCourierStatus: async (id, data) => {
        await get().updateCourier(id, data)
      },

      removeCourier: async (id) => {
        set((state) => ({
          queue: state.queue.filter((c) => c.id !== id)
        }))
        await useUserStore.getState().removeUser(id)
      },

      getAvailableCouriers: () => {
        const { users } = useUserStore.getState()
        return users.filter(u =>
          u.role === 'courier' && u.is_active && u.is_online
        ) as Courier[]
      },

      rotateQueue: (id) => {
        set((state) => {
          const index = state.queue.findIndex(c => c.id === id)
          if (index === -1) return state
          const newQueue = [...state.queue]
          const [courier] = newQueue.splice(index, 1)
          newQueue.push(courier)
          return { queue: newQueue }
        })
      },
    }),
    {
      name: 'courier-storage',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state && state._storeVersion !== STORE_VERSION) {
          console.warn('Store version mismatch — resetting courier-storage')
          state.resetStore()
        }
      }
    }
  )
)
