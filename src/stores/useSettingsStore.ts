import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from '@/lib/supabaseClient'
import { CourierInstruction } from '@/types'

export type { CourierInstruction }

interface BusinessSettings {
  commission_rate: number
  commission_threshold: number
  courier_instructions: CourierInstruction[]
}

interface SettingsStore extends BusinessSettings {
  updateSettings: (data: Partial<BusinessSettings>) => void
  addCourierInstruction: (instruction: Omit<CourierInstruction, 'id'>) => void
  updateCourierInstruction: (id: string, instruction: Partial<CourierInstruction>) => void
  deleteCourierInstruction: (id: string) => void
  fetchSettings: () => Promise<void>
  reset: () => void
}

const DEFAULT_INSTRUCTIONS: CourierInstruction[] = [
  { id: '1', label: 'Barang sudah siap, langsung ambil', instruction: 'Barang sudah siap, langsung ambil!', icon: '✅' },
  { id: '2', label: 'Cek dulu ke penjual sebelum ambil', instruction: 'Cek dulu ke penjual sebelum ambil', icon: '🔍' },
  { id: '3', label: 'Kurir yang pesan di tempat', instruction: 'Kamu yang pesan di tempat', icon: '🛒' },
  { id: '4', label: 'Minta kurir update posisi', instruction: 'Admin minta update posisimu', icon: '📍' },
  { id: '5', label: 'Hubungi admin', instruction: 'Hubungi Admin untuk data detail konsumen', icon: '📞' },
  { id: '6', label: 'Periksa kondisi barang', instruction: 'Periksa kondisi barang saat serah terima', icon: '📦' },
]

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      commission_rate: 80,
      commission_threshold: 5000,
      courier_instructions: DEFAULT_INSTRUCTIONS,
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
          courier_instructions: data.courier_instructions || DEFAULT_INSTRUCTIONS
        }))
      },
      reset: () => set((state: SettingsStore) => ({
        ...state,
        commission_rate: 80,
        commission_threshold: 5000,
        courier_instructions: DEFAULT_INSTRUCTIONS
      }))
    }),
    {
      name: 'business-settings',
      storage: createJSONStorage(() => localStorage),
      version: 4,
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
