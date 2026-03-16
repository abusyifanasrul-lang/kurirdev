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
  rotateQueue: (assignedCourierId: string) => Promise<void>
  setCourierOffline: (courierId: string, reason: string) => Promise<void>
  setCourierOnline: (courierId: string, status: 'on' | 'stay') => Promise<void>
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

      rotateQueue: async (assignedCourierId) => {
        const userStore = useUserStore.getState()
        const allCouriers = userStore.users.filter(u => u.role === 'courier') as (Courier & { queue_position?: number })[]
        if (allCouriers.length === 0) return
        const sorted = [...allCouriers].sort((a, b) =>
          (a.queue_position ?? 999) - (b.queue_position ?? 999)
        )
        const maxPosition = sorted.reduce((max, c) => Math.max(max, c.queue_position ?? 0), 0)
        const assignedCourier = sorted.find(c => c.id === assignedCourierId)
        if (!assignedCourier) return
        const assignedCurrentPos = assignedCourier.queue_position ?? 1
        const updatePromises = sorted
          .filter(c => c.id !== assignedCourierId && (c.queue_position ?? 999) > assignedCurrentPos)
          .map(c => userStore.updateUserQueuePosition(c.id, (c.queue_position ?? 999) - 1))
        updatePromises.push(userStore.updateUserQueuePosition(assignedCourierId, maxPosition))
        await Promise.all(updatePromises)
        set((state) => {
          const index = state.queue.findIndex(c => c.id === assignedCourierId)
          if (index === -1) return state
          const newQueue = [...state.queue]
          const [courier] = newQueue.splice(index, 1)
          newQueue.push(courier)
          return { queue: newQueue }
        })
      },

      setCourierOffline: async (courierId, reason) => {
        const userStore = useUserStore.getState()
        const allCouriers = userStore.users.filter(u => u.role === 'courier') as (Courier & { queue_position?: number })[]

        // Set kurir ini offline dan hapus queue_position
        await userStore.updateUser(courierId, {
          is_online: false,
          courier_status: 'off',
          off_reason: reason,
          queue_position: null as any,
        })

        // Kurir yang posisinya di belakang kurir ini → geser maju 1
        const offCourier = allCouriers.find(c => c.id === courierId)
        if (offCourier?.queue_position != null) {
          const updatePromises = allCouriers
            .filter(c => c.id !== courierId && (c.queue_position ?? 0) > (offCourier.queue_position ?? 0))
            .map(c => userStore.updateUserQueuePosition(c.id, (c.queue_position ?? 0) - 1))
          await Promise.all(updatePromises)
        }
      },

      setCourierOnline: async (courierId, status) => {
        const userStore = useUserStore.getState()
        const allCouriers = userStore.users.filter(u => u.role === 'courier') as (Courier & { queue_position?: number })[]

        const thisCourier = allCouriers.find(c => c.id === courierId)
        const alreadyHasPosition = (thisCourier?.queue_position ?? 0) > 0

        await userStore.updateUser(courierId, {
          is_online: true,
          courier_status: status,
          off_reason: '',
        })

        // Hanya assign posisi baru jika kurir belum punya posisi
        // (kurir baru online dari OFF, bukan sekadar ganti ON ↔ STAY)
        if (!alreadyHasPosition) {
          const maxPos = allCouriers.reduce((max, c) => Math.max(max, c.queue_position ?? 0), 0)
          await userStore.updateUserQueuePosition(courierId, maxPos + 1)
        }
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
