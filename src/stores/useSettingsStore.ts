import { persist, createJSONStorage } from 'zustand/middleware'
import { create } from 'zustand'
import { supabase } from '@/lib/supabaseClient'
import { RealtimeChannel } from '@supabase/supabase-js'
import { CourierInstruction } from '@/types'

let settingsResyncTime = 0
const settingsChannels = new Map<string, RealtimeChannel>()
const settingsStates = new Map<string, string>()
const settingsRefs = new Map<string, number>()

export type { CourierInstruction }

interface BusinessSettings {
  commission_rate: number
  commission_threshold: number
  commission_type: 'percentage' | 'flat'
  operational_area: string
  operational_timezone: string
  courier_instructions: CourierInstruction[]
}

interface SettingsStore extends BusinessSettings {
  updateSettings: (data: Partial<BusinessSettings>) => void
  addCourierInstruction: (instruction: Omit<CourierInstruction, 'id'>) => void
  updateCourierInstruction: (id: string, instruction: Partial<CourierInstruction>) => void
  deleteCourierInstruction: (id: string) => void
  fetchSettings: () => Promise<void>
  subscribeSettings: () => (() => void)
  unsubscribeSettings: () => void
  resyncRealtime: (options?: { force?: boolean }) => Promise<void>
  reset: () => void
  _resyncLock: Promise<void> | null
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
      commission_type: 'percentage',
      operational_area: 'Sengkang, Wajo',
      operational_timezone: 'Asia/Jakarta',
      courier_instructions: DEFAULT_INSTRUCTIONS,
      realtimeStatus: {},
      _resyncLock: null,

      updateSettings: (data) => set((state) => ({ ...state, ...data })),

      addCourierInstruction: (instruction) => set((state) => ({
        courier_instructions: [...state.courier_instructions, { ...instruction, id: crypto.randomUUID() }]
      })),

      updateCourierInstruction: (id, instruction) => set((state) => ({
        courier_instructions: state.courier_instructions.map(item =>
          item.id === id ? { ...item, ...instruction } : item
        )
      })),

      deleteCourierInstruction: (id) => set((state) => ({
        courier_instructions: state.courier_instructions.filter(item => item.id !== id)
      })),

      fetchSettings: async () => {
        const { data, error } = await supabase.from('settings').select('*').single() as { data: any, error: any }
        if (error || !data) return
        set((state) => ({
          ...state,
          commission_rate: data.commission_rate,
          commission_threshold: data.commission_threshold,
          commission_type: data.commission_type || 'percentage',
          operational_area: data.operational_area || 'Sengkang, Wajo',
          operational_timezone: data.operational_timezone || 'Asia/Jakarta',
          courier_instructions: data.courier_instructions || DEFAULT_INSTRUCTIONS
        }))
      },

      subscribeSettings: () => {
        const channelId = 'public:settings'
        
        // 1. ATOMIC INCREMENT & SYNC GUARD
        const currentRef = settingsRefs.get(channelId) || 0
        settingsRefs.set(channelId, currentRef + 1)

        const existing = settingsChannels.get(channelId)
        // Synchronously check both joined and joining
        if (existing && (settingsStates.get(channelId) === 'joined' || settingsStates.get(channelId) === 'joining')) {
          return () => get().unsubscribeSettings()
        }

        // 2. SYNCHRONOUS JOIN STATE
        settingsStates.set(channelId, 'joining')

        // 3. INTERNAL ASYNC INIT
        ;(async () => {
          if (existing) {
            console.log(`♻️ Cleaning up existing channel for ${channelId}...`)
            await supabase.removeChannel(existing)
            settingsChannels.delete(channelId)
          }

          // Safeguard: Check if we are still supposed to be joining
          if (settingsStates.get(channelId) !== 'joining') return;

          const channel = supabase.channel(channelId)

          channel
            .on('postgres_changes',
              { event: '*', schema: 'public', table: 'settings' },
              () => {
                // Settings berubah — fetch langsung, ini adalah perubahan nyata
                useSettingsStore.getState().fetchSettings()
              }
            )
          // Set map BEFORE subscribe to allow stale guard to work correctly
          settingsChannels.set(channelId, channel)

          channel.subscribe(async (status, err) => {
            // STALE GUARD: Ignore callbacks from superseded channels
            if (settingsChannels.get(channelId) !== channel) return

            if (status === 'SUBSCRIBED') {
              const prevState = settingsStates.get(channelId)
              const wasCleanReconnect = prevState === 'closed'
              console.log(`✅ [SettingsStore] Settings channel ${wasCleanReconnect ? 'Reconnected (clean)' : 'Connected/Recovered'}`)
              settingsStates.set(channelId, 'joined')
              set(state => ({ realtimeStatus: { ...state.realtimeStatus, [channelId]: 'joined' } }))

              if (wasCleanReconnect) {
                console.log(`📡 [SettingsStore] Reconnect detected — skipping snapshot`)
              } else {
                console.log(`📡 [SettingsStore] First connect — fetching settings snapshot...`)
                get().fetchSettings().catch(err => console.error('Snapshot fetch error:', err))
              }
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              if (status === 'CLOSED' && !err) {
                console.info(`ℹ️ [SettingsStore] Realtime ${channelId} closed gracefully.`)
              } else {
                console.warn(`⚠️ [SettingsStore] Realtime ${channelId} ${status} — letting Supabase auto-reconnect.`, err || '')
              }
              const finalStatus = status === 'CLOSED' ? 'closed' : 'errored'
              settingsStates.set(channelId, finalStatus)
              set(state => ({ realtimeStatus: { ...state.realtimeStatus, [channelId]: finalStatus } }))
              // PENTING: Jangan delete channel di sini
            }
          })
        })()

        return () => get().unsubscribeSettings()
      },

      unsubscribeSettings: () => {
        const channelId = 'public:settings'
        const currentRef = settingsRefs.get(channelId) || 0
        if (currentRef <= 1) {
          const channel = settingsChannels.get(channelId)
          if (channel) {
            supabase.removeChannel(channel).catch(() => {})
            settingsChannels.delete(channelId)
            settingsStates.delete(channelId)

            // Cleanup health status
            set(state => {
              const next = { ...state.realtimeStatus }
              delete next[channelId]
              return { realtimeStatus: next }
            })
          }
          settingsRefs.set(channelId, 0)
        } else {
          settingsRefs.set(channelId, currentRef - 1)
        }
      },

      resyncRealtime: async (options) => {
        if (get()._resyncLock) {
          return get()._resyncLock as Promise<void>
        }

        const resyncPromise = (async () => {
          try {
            const now = Date.now()
            if (!options?.force && (now - settingsResyncTime < 30_000)) return
            settingsResyncTime = now

            await get().fetchSettings()

            const channelId = 'public:settings'
            if (!settingsChannels.has(channelId)) {
              console.warn(`⚠️ Channel ${channelId} not found in map — re-subscribing...`)
              get().subscribeSettings()
            } else {
              console.log(`ℹ️ Channel ${channelId} exists (state: ${settingsStates.get(channelId)}) — trusting Supabase auto-reconnect`)
            }
          } finally {
            set({ _resyncLock: null })
          }
        })()

        set({ _resyncLock: resyncPromise })
        return resyncPromise
      },

      reset: () => set((state) => ({
        ...state,
        commission_rate: 80,
        commission_threshold: 5000,
        commission_type: 'percentage',
        operational_area: 'Sengkang, Wajo',
        operational_timezone: 'Asia/Jakarta',
        courier_instructions: DEFAULT_INSTRUCTIONS,
        realtimeStatus: {},
      }))
    }),
    {
      name: 'business-settings',
      storage: createJSONStorage(() => localStorage),
      version: 6,
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
        if (version < 6) {
          persistedState.operational_timezone = persistedState.operational_timezone || 'Asia/Jakarta'
        }
        return persistedState
      }
    }
  )
)
