import { Capacitor, registerPlugin } from '@capacitor/core'

interface StayMonitorNative {
  startMonitoring(options: {
    lat: number
    lng: number
    radius: number
    basecampId: string
    supabaseUrl: string
    supabaseAnonKey: string
    serviceSecret: string
    courierId: string
  }): Promise<void>
  stopMonitoring(): Promise<void>
  isRunning(): Promise<{ running: boolean }>
}

const StayMonitor = registerPlugin<StayMonitorNative>('StayMonitor')

export interface StayNativeEvent {
  type: 'update' | 'revoked'
  inZone: boolean
  counter: number
  distance: number
  basecampId: string
  timestamp: number
}

class StayNativeBridge {
  private listener: ((evt: StayNativeEvent) => void) | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      ;(window as any).__STAY_NATIVE_CALLBACK = (data: StayNativeEvent) => {
        this.listener?.(data)
      }
    }
  }

  start(options: {
    lat: number
    lng: number
    radius: number
    basecampId: string
    supabaseUrl: string
    supabaseAnonKey: string
    serviceSecret: string
    courierId: string
  }): void {
    if (Capacitor.getPlatform() !== 'android') return
    StayMonitor.startMonitoring(options).catch(err =>
      console.error('[StayNative] start error:', err)
    )
  }

  stop(): void {
    if (Capacitor.getPlatform() !== 'android') return
    StayMonitor.stopMonitoring().catch(err =>
      console.error('[StayNative] stop error:', err)
    )
  }

  async isRunning(): Promise<boolean> {
    if (Capacitor.getPlatform() !== 'android') return false
    const { running } = await StayMonitor.isRunning()
    return running
  }

  onUpdate(callback: (evt: StayNativeEvent) => void): () => void {
    this.listener = callback
    return () => { this.listener = null }
  }
}

export const stayNative = new StayNativeBridge()