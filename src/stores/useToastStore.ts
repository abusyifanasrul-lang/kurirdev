import { create } from 'zustand'

export type ToastType = 'info' | 'success' | 'error' | 'warning' | 'loading'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastState {
  toasts: Toast[]
  addToast: (message: string, type: ToastType, duration?: number) => string
  removeToast: (id: string) => void
  updateToast: (id: string, updates: Partial<Toast>) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type, duration = 3000) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast: Toast = { id, message, type, duration }
    
    set((state) => ({
      toasts: [...state.toasts, newToast]
    }))

    if (type !== 'loading' && duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id)
        }))
      }, duration)
    }

    return id
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }))
  },
  updateToast: (id, updates) => {
    set((state) => ({
      toasts: state.toasts.map((t) => (t.id === id ? { ...t, ...updates } : t))
    }))
  }
}))
