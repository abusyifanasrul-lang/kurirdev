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
          .single()

        if (!profile?.stay_basecamp_id) return

        const [{ data: bc }, { data: settings }] = await Promise.all([
          supabase.from('basecamps').select('lat, lng, radius_m').eq('id', profile.stay_basecamp_id).single(),
          supabase.from('settings').select('service_secret').eq('id', 'global').single(),
        ])

        const { supabaseUrl, supabaseAnonKey } = await import('@/lib/supabaseClient')

        if (bc && settings) {
          stayNative.start({
            lat: bc.lat,
            lng: bc.lng,
            radius: bc.radius_m,
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
            })
            .eq('id', courierId)

          if (error) throw error

          await useUserStore.getState().fetchProfile(courierId)

          useToastStore.getState().addToast({
            type: 'warning',
            message: 'Status STAY dicabut — kamu terdeteksi keluar area basecamp 5 menit berturut-turut',
          })

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
