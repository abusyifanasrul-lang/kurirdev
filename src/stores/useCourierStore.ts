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

  setCourierOffline: async (courierId, reason) => {
    await useUserStore.getState().updateUser(courierId, {
      // is_online: false,  ← HAPUS INI, trigger security menolak
      courier_status: 'off',
      off_reason: reason,
    })
    stayNative.stop()
  },

  setCourierOnline: async (courierId, status) => {
    await useUserStore.getState().updateUser(courierId, {
      courier_status: status,
      off_reason: '',
    })
    if (status === 'on') stayNative.stop()

    // Catat kehadiran (silent fail — tidak blocking)
    await supabase.rpc('record_courier_checkin', {
      p_courier_id: courierId
    }).catch(() => {}) // jika gagal, admin bisa input manual
  },

  setCourierStay: async (courierId, qrToken) => {
    // Call RPC with correct parameters matching SQL function signature
    const { data, error } = await supabase.rpc('verify_stay_qr', {
      p_token: qrToken,
      p_courier_id: courierId,
    })
    if (error) throw error

    const result = data as { success: boolean; basecamp_id: string | null; error?: string }
    if (!result.success) throw new Error(result.error || 'QR tidak valid')

    if (result.basecamp_id) {
      // Ambil koordinat basecamp + service_secret untuk native service
      const [bcResult, settingsResult] = await Promise.all([
        supabase
          .from('basecamps')
          .select('lat, lng, radius_m')
          .eq('id', result.basecamp_id)
          .single(),
        supabase
          .from('settings')
          .select('service_secret')
          .eq('id', 'global')
          .single(),
      ])

      // Log errors for debugging
      if (bcResult.error) {
        console.error('[setCourierStay] Failed to fetch basecamp:', bcResult.error)
      }
      if (settingsResult.error) {
        console.error('[setCourierStay] Failed to fetch settings:', settingsResult.error)
      }

      const bc = bcResult.data
      const settings = settingsResult.data
      const { supabaseUrl, supabaseAnonKey } = await import('@/lib/supabaseClient')

      if (bc && settings) {
        console.log('[setCourierStay] Starting native service with basecamp:', {
          basecampId: result.basecamp_id,
          lat: bc.lat,
          lng: bc.lng,
          radius: bc.radius_m,
        })
        
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
      } else {
        console.error('[setCourierStay] Missing data - bc:', !!bc, 'settings:', !!settings)
      }
    }

    await useUserStore.getState().fetchUsers()
    return { success: true, basecamp_id: result.basecamp_id }
  },
}))
