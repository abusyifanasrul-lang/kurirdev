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
  private listeners: Set<(evt: StayNativeEvent) => void> = new Set()

  constructor() {
    if (typeof window !== 'undefined') {
      ;(window as any).__STAY_NATIVE_CALLBACK = (data: StayNativeEvent) => {
        // Broadcast to ALL listeners
        this.listeners.forEach(listener => {
          try {
            listener(data)
          } catch (error) {
            console.error('[StayNative] Listener error:', error)
          }
        })
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
    
    // CRITICAL: Stop any existing service first
    console.log('[StayNative] Stopping existing service before starting new one...')
    this.stop()
    
    // Small delay to ensure stop completes
    setTimeout(() => {
      console.log('[StayNative] Starting new service...')
      StayMonitor.startMonitoring(options).catch(err =>
        console.error('[StayNative] start error:', err)
      )
    }, 500)
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
    this.listeners.add(callback)
    console.log(`[StayNative] Listener added. Total listeners: ${this.listeners.size}`)
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback)
      console.log(`[StayNative] Listener removed. Total listeners: ${this.listeners.size}`)
    }
  }
}

export const stayNative = new StayNativeBridge()