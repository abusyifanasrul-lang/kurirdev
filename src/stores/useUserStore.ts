import { create } from 'zustand'
import { supabase } from '@/lib/supabaseClient'
import { User, UserRole, CreateUserInput } from '@/types'
import { logger } from '@/lib/logger'
import { cacheProfiles, getCachedProfiles, saveProfileSyncTime } from '@/lib/orderCache'

interface UserState {
  users: User[]
  isLoading: boolean
  isLoaded: boolean
  error: string | null
  loadFromLocal: () => Promise<void>
  syncFromServer: () => Promise<void>
  fetchUsers: () => Promise<void>
  fetchProfile: (id: string) => Promise<void>
  subscribeUsers: () => () => void
  addUser: (data: CreateUserInput) => Promise<{ success: boolean; error?: string }>
  updateUser: (id: string, data: Partial<User>) => Promise<void>
  removeUser: (id: string) => Promise<void>
  updateUserQueuePosition: (id: string, position: number) => Promise<void>
  subscribeProfile: (id: string) => () => void
  initQueuePositions: () => Promise<void>
  reset: () => void
}

const mapProfileToUser = (profile: any): User => ({
  id: profile.id,
  name: profile.name,
  email: profile.email || '', 
  role: profile.role as UserRole,
  phone: profile.phone || undefined,
  is_active: profile.is_active ?? true,
  is_online: profile.is_online,
  fcm_token: profile.fcm_token || undefined,
  courier_status: profile.courier_status,
  off_reason: profile.off_reason,
  vehicle_type: profile.vehicle_type,
  plate_number: profile.plate_number,
  queue_position: profile.queue_position,
  created_at: profile.created_at || new Date().toISOString(),
  updated_at: profile.updated_at || new Date().toISOString(),
  total_deliveries_alltime: profile.total_deliveries_alltime,
  total_earnings_alltime: profile.total_earnings_alltime,
  unpaid_count: profile.unpaid_count,
  unpaid_amount: profile.unpaid_amount,
})

export const useUserStore = create<UserState>()((set, get) => ({
  users: [],
  isLoading: true,
  isLoaded: false,
  error: null,

  loadFromLocal: async () => {
    try {
      const cached = await getCachedProfiles()
      if (cached.length > 0) {
        set({ users: cached, isLoaded: true })
      }
    } catch (err) {
      console.error('Failed to load users from local storage', err)
    }
  },

  syncFromServer: async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('*')
      if (error) throw error
      if (data) {
        const users = data.map(p => mapProfileToUser(p))
        await cacheProfiles(users)
        set({ users, isLoaded: true })
        saveProfileSyncTime()
      }
    } catch (err) {
      console.error('Failed to sync users from server', err)
    }
  },

  fetchUsers: async () => {
    set({ isLoading: true })
    const { data: profiles, error } = await supabase.from('profiles').select('*')
    if (error) {
      console.error('fetchUsers error:', error)
      set({ isLoading: false })
      return
    }
    set({ users: profiles.map(p => mapProfileToUser(p)), isLoading: false })
  },
  
  fetchProfile: async (id: string) => {
    const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', id).single()
    if (error || !profile) return
    
    const user = mapProfileToUser(profile)
    set(state => ({
      users: state.users.some(u => u.id === id)
        ? state.users.map(u => u.id === id ? user : u)
        : [...state.users, user]
    }))
  },

  subscribeUsers: () => {
    get().fetchUsers()

    const channelId = `users_list_${Math.random().toString(36).substring(7)}`
    const channel = supabase.channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          const { eventType, new: newRec, old: oldRec } = payload
          const currentUsers = [...get().users]
          const { profiles } = require('@/lib/orderCache').localDB // Reach into DB for atomic updates

          if (eventType === 'INSERT') {
            const newUser = mapProfileToUser(newRec)
            set({ users: [...currentUsers, newUser] })
            profiles.put(newUser)
          } else if (eventType === 'UPDATE') {
            const updatedUser = mapProfileToUser(newRec)
            const updatedUsers = currentUsers.map(u => 
              u.id === newRec.id ? updatedUser : u
            )
            set({ users: updatedUsers })
            profiles.put(updatedUser)
          } else if (eventType === 'DELETE') {
            set({ users: currentUsers.filter(u => u.id !== oldRec.id) })
            profiles.delete(oldRec.id)
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          logger.error(`Realtime subscription error for ${channelId}`, err)
        }
      })
      
    return () => {
      supabase.removeChannel(channel)
    }
  },

  subscribeProfile: (id: string) => {
    // Initial fetch for this specific profile
    get().fetchProfile(id)

    const channelId = `profile_${id}_${Math.random().toString(36).substring(7)}`
    const channel = supabase.channel(channelId)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${id}` },
        (payload) => {
          const user = mapProfileToUser(payload.new)
          set(state => ({
            users: state.users.map(u => u.id === id ? user : u)
          }))
        }
      )
      .subscribe()
      
    return () => {
      supabase.removeChannel(channel)
    }
  },

  addUser: async (data: CreateUserInput) => {
    set({ isLoading: true, error: null })
    try {
      const { name, email, password, role, phone } = data
      // 1. Proactive Frontend Validation
      if (!name || !email || !password || !role) {
        throw new Error('❌ Data tidak lengkap! Pastikan Nama, Email, Password, dan Role terisi.')
      }
      if (password.length < 8) {
        throw new Error('❌ Password minimal harus 8 karakter.')
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        throw new Error('Session expired. Please log in again.')
      }

      const invokePromise = supabase.functions.invoke('create-staff-user', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          email,
          password,
          name,
          role,
          phone
        }
      })

      const timeoutPromise = new Promise<{ data: null; error: Error }>((_, reject) => 
        setTimeout(() => reject(new Error('Koneksi terputus. Server terlalu lama merespon.')), 15000)
      )

      const response = await Promise.race([invokePromise, timeoutPromise]) as any

      if (response.error) {
        let detailedMessage = response.error.message || 'Gagal menambahkan user'
        
        try {
          if (response.error.context) {
            const body = await response.error.context.json()
            if (body && (body.error || body.details)) {
              const rawError = `${body.error || ''} ${body.details || ''}`.toLowerCase()
              
              if (rawError.includes('already registered')) {
                detailedMessage = '❌ Email ini sudah pernah didaftarkan. Gunakan email lain.'
              } else if (rawError.includes('password should be at least')) {
                detailedMessage = '❌ Password terlalu pendek (Minimal 8 karakter).'
              } else if (rawError.includes('missing required fields')) {
                detailedMessage = '❌ Server menolak: Data penting ada yang kosong.'
              } else if (rawError.includes('permission denied')) {
                detailedMessage = '❌ Gagal menyimpan profil karena masalah hak akses database (Permission Denied).'
              } else if (rawError.includes('violates check constraint')) {
                detailedMessage = '❌ Gagal: Tipe Role yang dipilih tidak valid di database.'
              } else {
                detailedMessage = `❌ Gagal: ${body.error || ''} ${body.details ? `(${body.details})` : ''}`
              }
            }
          }
        } catch (parseErr) {
          // ignore parse errors
        }

        throw new Error(detailedMessage)
      }

      await get().fetchUsers()
      return { success: true }
    } catch (e: any) {
      console.error('addUser error:', e)
      set({ error: e.message })
      return { success: false, error: e.message }
    } finally {
      set({ isLoading: false })
    }
  },

  updateUser: async (id, data) => {
    const { email, password, ...dbData } = data as any
    
    // Optimistic update
    const currentUser = get().users.find(u => u.id === id)
    if (currentUser) {
      const updatedUser = { ...currentUser, ...data }
      set(state => ({
        users: state.users.map(u => u.id === id ? updatedUser : u)
      }))
    }

    const { error } = await (supabase.from('profiles') as any)
      .update({ ...dbData, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      // Rollback if needed or fetch latest
      get().fetchProfile(id)
      throw error
    }
  },

  removeUser: async (id) => {
    if (id === '1') return
    await (supabase.from('profiles') as any).update({ is_active: false }).eq('id', id)
  },

  updateUserQueuePosition: async (id, position) => {
    // Optimistic update
    set(state => ({
      users: state.users.map(u => u.id === id ? { ...u, queue_position: position } : u)
    }))

    const { error } = await (supabase.from('profiles') as any).update({
      queue_position: position,
      updated_at: new Date().toISOString()
    }).eq('id', id)

    if (error) {
      get().fetchProfile(id)
      throw error
    }
  },

  initQueuePositions: async () => {
    const { data: profiles, error } = await supabase.from('profiles')
      .select('*')
      .eq('role', 'courier')
      
    if (error || !profiles) return

    const alreadyHasPosition = (profiles as any[]).filter(c => c.queue_position != null)
    const needsPosition = (profiles as any[]).filter(c => c.queue_position == null)

    if (needsPosition.length === 0) return

    const maxExisting = alreadyHasPosition.reduce(
      (max, c) => Math.max(max, (c.queue_position as number) ?? 0), 0
    )

    const sorted = [...needsPosition].sort(
      (a, b) => new Date((a as any).created_at || 0).getTime() - new Date((b as any).created_at || 0).getTime()
    )

    for (let i = 0; i < sorted.length; i++) {
        await (supabase.from('profiles') as any).update({
            queue_position: maxExisting + i + 1,
            updated_at: new Date().toISOString()
        }).eq('id', (sorted[i] as any).id)
    }
  },

  reset: () => set({ users: [], isLoading: false, error: null }),
}))
