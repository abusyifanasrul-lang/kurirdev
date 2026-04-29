import { useEffect, useRef } from 'react'
import { stayNative, StayNativeEvent } from '@/lib/stayMonitoring'
import { supabase } from '@/lib/supabaseClient'
import { useUserStore } from '@/stores/useUserStore'
import { useToastStore } from '@/stores/useToastStore'

interface UseStayMonitorOptions {
  courierId: string
  isStay: boolean
  onRevoked?: () => void
}

// Explicit types for DB columns not yet in generated Supabase types
interface BasecampRow {
  lat: number
  lng: number
  stay_radius_meters: number
}

export function useStayMonitor({ courierId, isStay, onRevoked }: UseStayMonitorOptions) {
  const outCounterRef = useRef(0)

  useEffect(() => {
    if (!isStay || !courierId) return

    // Auto-resume: jika app restart tapi status masih STAY
    const checkResume = async () => {
      try {
        const running = await stayNative.isRunning()
        if (running) return

        const { data: profile } = await supabase
          .from('profiles')
          .select('stay_basecamp_id')
          .eq('id', courierId)
          .single() as { data: { stay_basecamp_id: string | null } | null; error: any }

        if (!profile?.stay_basecamp_id) return

        const [bcResult, settingsResult] = await Promise.all([
          supabase
            .from('basecamps' as any)
             .select('lat, lng, stay_radius_meters')
            .eq('id', profile.stay_basecamp_id)
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
            basecampId: profile.stay_basecamp_id,
            supabaseUrl,
            supabaseAnonKey,
            serviceSecret: settings.service_secret,
            courierId,
          })
        }
      } catch (err) {
        console.error('[useStayMonitor] auto-resume failed:', err)
      }
    }

    checkResume()

    const unsubscribe = stayNative.onUpdate(async (evt: StayNativeEvent) => {
      if (evt.type === 'update') {
        outCounterRef.current = evt.counter
        return
      }

      if (evt.type === 'revoked') {
        try {
          const { error } = await supabase
            .from('profiles')
            .update({
              courier_status: 'on',
              stay_basecamp_id: null,
              gps_consecutive_out: 0,
            } as any)
            .eq('id', courierId)

          if (error) throw error

          // Refresh user data in store
          await useUserStore.getState().fetchUsers()

          useToastStore.getState().addToast(
            'Status STAY dicabut — kamu terdeteksi keluar area basecamp 5 menit berturut-turut',
            'warning',
          )

          onRevoked?.()
        } catch (err) {
          console.error('[useStayMonitor] gagal cabut STAY:', err)
        }
      }
    })

    return () => {
      unsubscribe()
      outCounterRef.current = 0
    }
  }, [courierId, isStay, onRevoked])
}
