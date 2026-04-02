import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from '@/lib/supabaseClient'

export interface CourierInstruction {
  id: string;
  label: string;        
  instruction: string;  
  icon: string;         
}

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
}

const DEFAULT_INSTRUCTIONS: CourierInstruction[] = [
  { id: '1', label: 'Barang sudah siap, langsung ambil', instruction: 'Barang sudah siap, langsung ambil!', icon: '✅' },
  { id: '2', label: 'Cek dulu ke penjual sebelum ambil', instruction: 'Cek dulu ke penjual sebelum ambil', icon: '🔍' },
  { id: '3', label: 'Kurir yang pesan di tempat', instruction: 'Kamu yang pesan di tempat', icon: '🛒' },
  { id: '4', label: 'Minta kurir update posisi', instruction: 'Admin minta update posisimu', icon: '📍' },
  { id: '5', label: 'Cek kondisi barang saat diterima', instruction: 'Cek kondisi barang saat diterima', icon: '🔍' },
]

export const useSettingsStore = create<any>()(
  persist(
    (set) => ({
      commission_rate: 80,
      commission_threshold: 5000,
      courier_instructions: DEFAULT_INSTRUCTIONS,
      updateSettings: (data: any) => set((state: any) => ({ ...state, ...data })),
      addCourierInstruction: (instruction: any) => set((state: any) => ({
        courier_instructions: [...state.courier_instructions, { ...instruction, id: crypto.randomUUID() }]
      })),
      updateCourierInstruction: (id: string, instruction: any) => set((state: any) => ({
        courier_instructions: (state.courier_instructions as any[]).map(item =>
          item.id === id ? { ...item, ...instruction } : item
        )
      })),
      deleteCourierInstruction: (id: string) => set((state: any) => ({
        courier_instructions: (state.courier_instructions as any[]).filter(item => item.id !== id)
      })),
      fetchSettings: async () => {
        const { data, error } = await supabase.from('settings').select('*').single()
        if (error || !data) return
        set({
          commission_rate: data.commission_rate,
          commission_threshold: data.commission_threshold
        })
      }
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
