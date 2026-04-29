import { create } from 'zustand'
import { supabase } from '@/lib/supabaseClient'
import { Courier } from '@/types'
import { useUserStore } from './useUserStore'
import { stayNative } from '@/lib/stayMonitoring'

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
  setCourierStay: (courierId: string, qrToken: string) => Promise<{ success: boolean; basecamp_id: string | null }>
  reset: () => void
}

export const useCourierStore = create<CourierState>()((_set, get) => ({
  get couriers() {
    return useUserStore.getState().users.filter(u => u.role === 'courier') as Courier[]
  },

  reset: () => {},

  addCourier: async (courier, password) => {
    const result = await useUserStore.getState().addUser({ ...courier, password })
    if (!result.success) throw new Error(result.error || 'Gagal membuat akun kurir')
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
    return users.filter(u => u.role === 'courier' && u.is_active && u.is_online) as Courier[]
  },

  rotateQueue: async (assignedCourierId) => {
    const { error } = await supabase.rpc('rotate_courier_queue', {
      p_courier_id: assignedCourierId
    })
    if (error) {
      console.error('Failed to rotate queue:', error)
      await useUserStore.getState().fetchUsers()
    }
  },

  setCourierOffline: async (courierId, reason) => {
    // is_online diurus trigger — cukup kirim courier_status
    await useUserStore.getState().updateUser(courierId, {
      courier_status: 'off',
      off_reason: reason,
    })
    stayNative.stop()
  },

  setCourierOnline: async (courierId, status) => {
    // is_online diurus trigger — cukup kirim courier_status
    await useUserStore.getState().updateUser(courierId, {
      courier_status: status,
      off_reason: '',
    })
    await supabase.rpc('record_courier_checkin', { p_courier_id: courierId })
    if (status === 'on') stayNative.stop()
  },

  setCourierStay: async (courierId, qrToken) => {
    // Signature benar: hanya p_token dan p_courier_id
    const { data, error } = await supabase.rpc('verify_stay_qr', {
      p_token: qrToken,
      p_courier_id: courierId,
    })
    if (error) throw error

    const result = data as { success: boolean; basecamp_id: string | null; error?: string }
    if (!result.success) throw new Error(result.error || 'QR tidak valid')

    if (result.basecamp_id) {
      // Ambil koordinat basecamp + service_secret untuk native service
      const [{ data: bc }, { data: settings }] = await Promise.all([
        supabase.from('basecamps').select('lat, lng, radius_m').eq('id', result.basecamp_id).single(),
        supabase.from('settings').select('service_secret').eq('id', 'global').single(),
      ])

      const { supabaseUrl, supabaseAnonKey } = await import('@/lib/supabaseClient')

      if (bc && settings) {
        stayNative.start({
          lat: bc.lat,
          lng: bc.lng,
          radius: bc.radius_m,
          basecampId: result.basecamp_id,
          supabaseUrl,
          supabaseAnonKey,
          serviceSecret: settings.service_secret,
          courierId,
        })
      }
    }

    await useUserStore.getState().fetchProfile(courierId)
    return { success: true, basecamp_id: result.basecamp_id }
  },
}))
