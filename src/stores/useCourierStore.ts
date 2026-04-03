import { create } from 'zustand'
import { Courier } from '@/types'
import { useUserStore } from './useUserStore'

interface CourierState {
  readonly couriers: Courier[]
  addCourier: (courier: Courier, password: string) => Promise<void>
  updateCourier: (id: string, data: Partial<Courier>) => Promise<void>
  updateCourierStatus: (id: string, data: Partial<Courier>) => Promise<void>
  removeCourier: (id: string) => Promise<void>
  getAvailableCouriers: () => Courier[]
  rotateQueue: (assignedCourierId: string) => Promise<void>
  setCourierOffline: (courierId: string, reason: string) => Promise<void>
  setCourierOnline: (courierId: string, status: 'on' | 'stay') => Promise<void>
  reset: () => void
}

export const useCourierStore = create<CourierState>()((_set, get) => ({
  get couriers() {
    return useUserStore.getState().users.filter(u => u.role === 'courier') as Courier[]
  },

  reset: () => {
    // No local state to reset, data comes from useUserStore
  },

  addCourier: async (courier, password) => {
    const result = await useUserStore.getState().addUser(courier, password)
    if (!result.success) {
      throw new Error(result.error || 'Gagal membuat akun kurir')
    }
  },

  updateCourier: async (id, data) => {
    await useUserStore.getState().updateUser(id, data)
  },

  updateCourierStatus: async (id, data) => {
    await get().updateCourier(id, data)
  },

  removeCourier: async (id) => {
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
    
    // Shift others up and move assigned to the end
    const updatePromises = sorted
      .filter(c => c.id !== assignedCourierId && (c.queue_position ?? 999) > assignedCurrentPos)
      .map(c => userStore.updateUserQueuePosition(c.id, (c.queue_position ?? 999) - 1))
    
    updatePromises.push(userStore.updateUserQueuePosition(assignedCourierId, maxPosition))
    await Promise.all(updatePromises)
  },

  setCourierOffline: async (courierId, reason) => {
    const userStore = useUserStore.getState()
    const allCouriers = userStore.users.filter(u => u.role === 'courier') as (Courier & { queue_position?: number })[]
    const thisCourier = allCouriers.find(c => c.id === courierId)
    const currentPos = thisCourier?.queue_position ?? 0

    await userStore.updateUser(courierId, {
      is_online: false,
      courier_status: 'off',
      off_reason: reason,
      queue_position: null as any,
    })

    if (currentPos > 0) {
      const shiftPromises = allCouriers
        .filter(c => c.id !== courierId && (c.queue_position ?? 0) > currentPos)
        .map(c => userStore.updateUserQueuePosition(c.id, (c.queue_position ?? 0) - 1))
      await Promise.all(shiftPromises)
    }
  },

  setCourierOnline: async (courierId, status) => {
    const userStore = useUserStore.getState()
    const allCouriers = userStore.users.filter(u => u.role === 'courier') as (Courier & { queue_position?: number })[]
    
    const maxPos = allCouriers
      .filter(c => c.id !== courierId)
      .reduce((max, c) => Math.max(max, c.queue_position ?? 0), 0)

    await userStore.updateUser(courierId, {
      is_online: true,
      courier_status: status,
      off_reason: '',
    })

    await userStore.updateUserQueuePosition(courierId, maxPos + 1)
  },
}))
