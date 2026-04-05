import { create } from 'zustand'
import { supabase } from '@/lib/supabaseClient'
import { User, UserRole, CreateUserInput } from '@/types'
import { logger } from '@/lib/logger'
import { cacheProfiles, getCachedProfiles, saveProfileSyncTime, localDB } from '@/lib/orderCache'

// Module-level tracker for active channels
const activeChannels = new Map<string, any>()

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
  updateUser: (id: string, data: Partial<User>) => Promise<{ success: boolean; error?: string }>
  removeUser: (id: string) => Promise<void>
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

    const channelId = 'users:list'
    
    // Deduplication check
    if (activeChannels.has(channelId)) {
      console.log(`♻️ Reusing existing realtime channel for ${channelId}`)
      return () => {}
    }

    const channel = supabase.channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          const { eventType, new: newRec, old: oldRec } = payload
          const currentUsers = [...get().users]
          const { profiles } = localDB

          if (eventType === 'INSERT') {
            const newUser = mapProfileToUser(newRec)
            set({ users: [...currentUsers, newUser] })
            profiles.put(newUser)
          } else if (eventType === 'UPDATE') {
            const updatedUser = mapProfileToUser(newRec)
            set({ users: currentUsers.map(u => u.id === newRec.id ? updatedUser : u) })
            profiles.put(updatedUser)
          } else if (eventType === 'DELETE') {
            set({ users: currentUsers.filter(u => u.id !== oldRec.id) })
            profiles.delete(oldRec.id)
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Realtime subscription failed for ${channelId}:`, err)
          logger.error(`Realtime subscription error for ${channelId}`, err)
          activeChannels.delete(channelId)
        } else if (status === 'SUBSCRIBED') {
          console.log(`✅ Realtime subscription active for ${channelId}`)
          activeChannels.set(channelId, channel)
        }
      })
      
    return () => {
      supabase.removeChannel(channel)
      activeChannels.delete(channelId)
    }
  },

  subscribeProfile: (id: string) => {
    // Initial fetch for this specific profile
    get().fetchProfile(id)

    const channelId = `profile:single:${id}`
    
    if (activeChannels.has(channelId)) {
      console.log(`♻️ Reusing existing realtime channel for ${channelId}`)
      return () => {}
    }

    const channel = supabase.channel(channelId)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${id}` },
        (payload) => {
          const existingUsers = get().users
          const existingUser = existingUsers.find(u => u.id === id)
          
          let updatedUser: User
          if (existingUser) {
             // Merge partial update and deep clone for safety
             updatedUser = JSON.parse(JSON.stringify(existingUser))
             Object.keys(payload.new).forEach(key => {
               if (payload.new[key] !== undefined) {
                  (updatedUser as any)[key] = payload.new[key]
               }
             })
          } else {
             updatedUser = mapProfileToUser(payload.new)
          }

          set(state => ({
            users: state.users.map(u => u.id === id ? updatedUser : u)
          }))
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          activeChannels.set(channelId, channel)
        }
      })
      
    return () => {
      supabase.removeChannel(channel)
      activeChannels.delete(channelId)
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
    // Hapus queue_position dari payload jika ada, agar database yang mengaturnya secara eksklusif
    const { queue_position, ...restData } = data as any
    const { email, password, name, phone, role, vehicle_type, plate_number } = restData

    try {
      // Jika email atau password diubah, kita HARUS menggunakan Edge Function
      // karena ini melibatkan Auth Admin API (Service Role)
      if (email || password) {
        const { data: response, error: fnError } = await supabase.functions.invoke('update-user-management', {
          body: {
            userId: id,
            email,
            password,
            name,
            phone,
            role,
            vehicle_type,
            plate_number
          }
        })

        if (fnError || !response?.success) {
          throw new Error(fnError?.message || response?.error || 'Gagal memperbarui data user (Auth)')
        }
      } else {
        // Jika hanya data profil standar, gunakan update langsung (lebih cepat & hemat resource)
        const { error } = await (supabase.from('profiles') as any)
          .update({ ...restData, updated_at: new Date().toISOString() })
          .eq('id', id)

        if (error) throw error
      }

      // Sync local state optimistically or re-fetch
      await get().fetchProfile(id)
      return { success: true }
    } catch (error: any) {
      console.error('updateUser error:', error)
      return { success: false, error: error.message || 'Gagal memperbarui data user' }
    }
  },

  removeUser: async (id) => {
    if (id === '1') return
    await (supabase.from('profiles') as any).update({ is_active: false }).eq('id', id)
  },

  reset: () => set({ users: [], isLoading: false, error: null }),
}))
