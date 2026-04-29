import { create } from 'zustand'
import { supabase } from '@/lib/supabaseClient'
import { Courier } from '@/types'
import { useUserStore } from './useUserStore'
import { stayNative } from '@/lib/stayMonitoring'

// Explicit types for DB columns not yet in generated Supabase types
interface BasecampRow {
  lat: number
  lng: number
  stay_radius_meters: number
}

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
    // Check-in recorded via DB trigger — no need for separate RPC
    if (status === 'on') stayNative.stop()
  },

  setCourierStay: async (courierId, qrToken) => {
    // Get current GPS position for stay verification
    // Explicit initialization to avoid "used before assigned" TypeScript error in strict mode
    let coords: GeolocationCoordinates = undefined!

    try {
      // Use Capacitor Geolocation plugin for native GPS access
      // Destructure coords directly to avoid intermediate position variable
      const { coords: positionCoords } = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      })
      coords = positionCoords
    } catch (geoError: any) {
      console.error('Failed to get GPS position:', geoError)
      // Handle permission denied error specifically
      if (geoError?.message?.toLowerCase().includes('permission')) {
        throw new Error('Izin lokasi ditolak. Mohon izinkan akses lokasi di pengaturan aplikasi.')
      }
      throw new Error('Gagal mendapatkan lokasi GPS. Pastikan GPS aktif dan izin lokasi diberikan.')
    }

    // Call RPC with correct parameters matching SQL function signature
    const { data, error } = await supabase.rpc('verify_stay_qr', {
      p_courier_id: courierId,
      p_qr_token: qrToken,
      p_courier_lat: coords.latitude,
      p_courier_lng: coords.longitude,
    })
    if (error) throw error

    const result = data as { success: boolean; basecamp_id: string | null; error?: string }
    if (!result.success) throw new Error(result.error || 'QR tidak valid')

    if (result.basecamp_id) {
      // Ambil koordinat basecamp + service_secret untuk native service
      const [bcResult, settingsResult] = await Promise.all([
        supabase
          .from('basecamps' as any)
          .select('lat, lng, stay_radius_meters')
          .eq('id', result.basecamp_id)
          .single() as unknown as Promise<{ data: BasecampRow | null; error: any }>,
        supabase
          .from('settings' as any)
          .select('service_secret')
          .eq('id', 'global')
          .single() as unknown as Promise<{ data: { service_secret: string } | null; error: any }>,
      ])

      const bc = bcResult.data
      const settings = settingsResult.data
      const { supabaseUrl, supabaseAnonKey } = await import('@/lib/supabaseClient')

      if (bc && settings) {
        stayNative.start({
          lat: bc.lat,
          lng: bc.lng,
          radius: bc.stay_radius_meters,
          basecampId: result.basecamp_id,
          supabaseUrl,
          supabaseAnonKey,
          serviceSecret: settings.service_secret,
          courierId,
        })
      }
    }

    await useUserStore.getState().fetchUsers()
    return { success: true, basecamp_id: result.basecamp_id }
  },
}))
