import { create } from 'zustand'
import { supabase } from '@/lib/supabaseClient'
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
    const result = await useUserStore.getState().addUser({ ...courier, password })
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
    const { error } = await supabase.rpc('rotate_courier_queue', {
      p_courier_id: assignedCourierId
    })
    
    if (error) {
      console.error('Failed to rotate queue:', error)
      // Fallback to fetch latest to stay in sync if RPC fails
      await useUserStore.getState().fetchUsers()
    }
  },

  setCourierOffline: async (courierId, reason) => {
    const userStore = useUserStore.getState()
    
    // Trigger in DB will handle queue exit logic
    await userStore.updateUser(courierId, {
      is_online: false,
      courier_status: 'off',
      off_reason: reason,
    })
  },

  setCourierOnline: async (courierId, status) => {
    const userStore = useUserStore.getState()
    
    // Trigger in DB will handle queue entry (FIFO timestamp)
    await userStore.updateUser(courierId, {
      is_online: true,
      courier_status: status,
      off_reason: '',
    })

    // Priority 2: Record attendance check-in
    if (status === 'on' || status === 'stay') {
      await supabase.rpc('record_courier_checkin', { 
        p_courier_id: courierId 
      });
      // Silent fail, attendance can be manually added by admin if needed
    }
  },
}))
