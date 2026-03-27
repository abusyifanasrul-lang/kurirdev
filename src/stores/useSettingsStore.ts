import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface CourierInstruction {
  id: string;
  label: string;        // untuk display di dropdown (contoh: "Barang sudah siap, langsung ambil")
  instruction: string;  // untuk notifikasi ke kurir (contoh: "Barang sudah siap, langsung ambil!")
  icon: string;     // emoji untuk instruksi (contoh: "✅", "🔍", "🛒")
}

interface BusinessSettings {
  commission_rate: number        // default 80 (%)
  commission_threshold: number   // default 5000 (Rp)
  courier_instructions: CourierInstruction[]
}

interface SettingsStore extends BusinessSettings {
  updateSettings: (data: Partial<BusinessSettings>) => void
  addCourierInstruction: (instruction: Omit<CourierInstruction, 'id'>) => void
  updateCourierInstruction: (id: string, instruction: Partial<CourierInstruction>) => void
  deleteCourierInstruction: (id: string) => void
}

const DEFAULT_INSTRUCTIONS: CourierInstruction[] = [
  { id: '1', label: 'Barang sudah siap, langsung ambil', instruction: 'Barang sudah siap, langsung ambil!', icon: '✅' },
  { id: '2', label: 'Cek dulu ke penjual sebelum ambil', instruction: 'Cek dulu ke penjual sebelum ambil', icon: '🔍' },
  { id: '3', label: 'Kurir yang pesan di tempat', instruction: 'Kamu yang pesan di tempat', icon: '🛒' },
  { id: '4', label: 'Minta kurir update posisi', instruction: 'Admin minta update posisimu', icon: '📍' },
]

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      commission_rate: 80,
      commission_threshold: 5000,
      courier_instructions: DEFAULT_INSTRUCTIONS,
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
      }))
    }),
    {
      name: 'business-settings',
      storage: createJSONStorage(() => localStorage),
      version: 4,
      migrate: (persistedState: any, version: number) => {
        // Mapping iconName lama → emoji
        const iconNameToEmoji: Record<string, string> = {
          'CheckCircle': '✅', 'Search': '🔍', 'ShoppingCart': '🛒',
          'MapPin': '📍', 'Truck': '🚚', 'Package': '📦',
          'Clock': '⏰', 'AlertTriangle': '⚠️', 'MessageCircle': '💬',
          'Phone': '📞', 'Navigation': '🧭', 'X': '❌',
        }

        if (version < 4) {
          const instructions = persistedState.courier_instructions
          if (Array.isArray(instructions) && instructions.length > 0) {
            // Konversi setiap instruksi: iconName → icon (jika belum ada)
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
