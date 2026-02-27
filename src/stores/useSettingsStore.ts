import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface BusinessSettings {
  commission_rate: number        // default 80 (%)
  commission_threshold: number   // default 5000 (Rp)
}

interface SettingsStore extends BusinessSettings {
  updateSettings: (data: Partial<BusinessSettings>) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      commission_rate: 80,
      commission_threshold: 5000,
      updateSettings: (data) => set((state) => ({ ...state, ...data })),
    }),
    { name: 'business-settings', storage: createJSONStorage(() => localStorage) }
  )
)
