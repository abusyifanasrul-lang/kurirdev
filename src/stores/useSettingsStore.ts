import { persist, createJSONStorage } from 'zustand/middleware'
import { create } from 'zustand'
import { supabase } from '@/lib/supabaseClient'
import { RealtimeChannel } from '@supabase/supabase-js'
import { CourierInstruction } from '@/types'
// import { logger } from '@/lib/logger'

let settingsResyncTime = 0
const settingsChannels = new Map<string, RealtimeChannel>()
const settingsStates = new Map<string, string>()

export type { CourierInstruction }

interface BusinessSettings {
  commission_rate: number
  commission_threshold: number
  operational_area: string
  courier_instructions: CourierInstruction[]
}

interface SettingsStore extends BusinessSettings {
  updateSettings: (data: Partial<BusinessSettings>) => void
  addCourierInstruction: (instruction: Omit<CourierInstruction, 'id'>) => void
  updateCourierInstruction: (id: string, instruction: Partial<CourierInstruction>) => void
  deleteCourierInstruction: (id: string) => void
  fetchSettings: () => Promise<void>
  subscribeSettings: () => (() => void)
  resyncRealtime: (options?: { force?: boolean }) => Promise<void>
  reset: () => void
  
  // Internal lock for resync operations (helps with HMR stability)
  _resyncLock: Promise<void> | null
  // Real-time Subscriptions Status
  realtimeStatus: Record<string, string>
}

const DEFAULT_INSTRUCTIONS: CourierInstruction[] = [
  { id: '1', label: '[SLS] Barang Selesai (Siap Ambil)', instruction: 'Barang sudah selesai & tinggal diambil di penjual.', icon: '✅' },
  { id: '2', label: 'Cek Langsung ke Penjual', instruction: 'Sudah admin pesan, mohon cek langsung di penjual apakah sudah selesai dibuat atau belum.', icon: '🔍' },
  { id: '3', label: 'Pesan Langsung di Tempat', instruction: 'Mohon pesan langsung di tempat penjual.', icon: '🛒' },
  { id: '4', label: '[PSS] Update Posisi Sekarang', instruction: 'Mohon komunikasikan posisi Anda saat ini ke Admin.', icon: '📍' },
]

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      commission_rate: 80,
      commission_threshold: 5000,
      operational_area: 'Sengkang, Wajo',
      courier_instructions: DEFAULT_INSTRUCTIONS,
      realtimeStatus: {},
      _resyncLock: null,
      updateSettings: (data: Partial<BusinessSettings>) => set((state: SettingsStore) => ({ ...state, ...data })),
      addCourierInstruction: (instruction: Omit<CourierInstruction, 'id'>) => set((state: SettingsStore) => ({
        courier_instructions: [...state.courier_instructions, { ...instruction, id: crypto.randomUUID() }]
      })),
      updateCourierInstruction: (id: string, instruction: Partial<CourierInstruction>) => set((state: SettingsStore) => ({
        courier_instructions: state.courier_instructions.map(item =>
          item.id === id ? { ...item, ...instruction } : item
        )
      })),
      deleteCourierInstruction: (id: string) => set((state: SettingsStore) => ({
        courier_instructions: state.courier_instructions.filter(item => item.id !== id)
      })),
      fetchSettings: async () => {
        const { data, error } = await supabase.from('settings').select('*').single() as { data: any, error: any }
        if (error || !data) return
        set((state: SettingsStore) => ({
          ...state,
          commission_rate: data.commission_rate,
          commission_threshold: data.commission_threshold,
          operational_area: data.operational_area || 'Sengkang, Wajo',
          courier_instructions: data.courier_instructions || DEFAULT_INSTRUCTIONS
        }))
      },
      subscribeSettings: () => {
        const channelId = 'public:settings'
        
        // 1. FAST DEDUPLICATION
        const existing = settingsChannels.get(channelId)
        if (existing && (settingsStates.get(channelId) === 'joined' || settingsStates.get(channelId) === 'joining')) {
          return () => {} // Already active or connecting
        }

        // 2. INTERNAL ASYNC INIT
        (async () => {
          if (existing) {
            console.log(`♻️ Cleaning up existing settings channel...`)
            await supabase.removeChannel(existing)
            settingsChannels.delete(channelId)
          }

          const channel = supabase.channel(channelId)

          channel
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'settings' },
              () => {
                (useSettingsStore.getState() as any).fetchSettings()
              }
            )
            .subscribe((status, err) => {
              if (status === 'SUBSCRIBED') {
                 console.log(`✅ Settings realtime active: ${channelId}`)
                 settingsStates.set(channelId, 'joined')
                 set(state => ({ realtimeStatus: { ...state.realtimeStatus, [channelId]: 'joined' } }))

                 // SNAPSHOT REPLACEMENT: Always fetch fresh data on (re)connect
                 console.log(`📡 [SettingsStore] Snapshot replacement...`)
                 get().fetchSettings().catch(err => console.error('Settings snapshot error:', err))
              } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                 console.warn(`❌ Settings realtime ${channelId} ${status}:`, err)
                 const finalStatus = status === 'CLOSED' ? 'closed' : 'errored'
                 settingsStates.set(channelId, finalStatus)
                 set(state => ({ realtimeStatus: { ...state.realtimeStatus, [channelId]: finalStatus } }))
                 settingsChannels.delete(channelId)
              }
            })

          settingsChannels.set(channelId, channel)
        })()

        return () => {
          const current = settingsChannels.get(channelId)
          if (current) {
            supabase.removeChannel(current).catch(() => {})
            settingsChannels.delete(channelId)
            settingsStates.delete(channelId)
          }
        }
      },
      resyncRealtime: async (options) => {
        // 1. Operation Lock: Prevent parallel resyncs (HMR friendly)
        if (get()._resyncLock) {
          console.log('⏳ Settings store resync already in progress, skipping duplicate call.')
          return get()._resyncLock as Promise<void>
        }

        const resyncPromise = (async () => {
          try {
            const now = Date.now()
            if (!options?.force && (now - settingsResyncTime < 30000)) return
            settingsResyncTime = now

            if (options?.force) {
              console.log('🔄 Forced settings resync triggered...')
            } else {
              console.log('🔄 Throttled settings resync triggered...')
            }

            await get().fetchSettings()

            const channelId = 'public:settings'
            const channelState = settingsStates.get(channelId)
            if (channelState === 'closed' || channelState === 'errored' || !settingsChannels.has(channelId)) {
              console.warn(`⚠️ [SettingsStore] Connection dead (${channelState}). Re-subscribing...`)
              await get().subscribeSettings()
            }
          } finally {
            set({ _resyncLock: null })
          }
        })()

        set({ _resyncLock: resyncPromise })
        return resyncPromise
      },
      reset: () => set((state: SettingsStore) => ({
        ...state,
        commission_rate: 80,
        commission_threshold: 5000,
        operational_area: 'Sengkang, Wajo',
        courier_instructions: DEFAULT_INSTRUCTIONS
      }))
    }),
    {
      name: 'business-settings',
      storage: createJSONStorage(() => localStorage),
      version: 5,
      migrate: (persistedState: any, version: number) => {
        const iconNameToEmoji: Record<string, string> = {
          'CheckCircle': '✅', 'Search': '🔍', 'ShoppingCart': '🛒',
          'MapPin': '📍', 'Truck': '🚚', 'Package': '📦',
          'Clock': '⏰', 'AlertTriangle': '⚠️', 'MessageCircle': '💬',
          'Phone': '📞', 'Navigation': '🧭', 'X': '❌',
        }

        if (version < 4) {
          const instructions = persistedState.courier_instructions
          if (Array.isArray(instructions) && instructions.length > 0) {
            persistedState.courier_instructions = instructions.map((inst: any) => ({
              ...inst,
              icon: inst.icon || iconNameToEmoji[inst.iconName] || '📋',
            }))
          } else {
            persistedState.courier_instructions = DEFAULT_INSTRUCTIONS
          }
        }
        return persistedState
      }
    }
  )
)
