import { create } from 'zustand'
import { supabase } from '@/lib/supabaseClient'
import { User, UserRole, CreateUserInput } from '@/types'
import { cacheProfiles, getCachedProfiles, saveProfileSyncTime, localDB } from '@/lib/orderCache'

// Module-level tracker for active channels
// Module-level tracker for active channels
const activeChannels = new Map<string, any>()
const channelStates = new Map<string, 'joining' | 'joined' | 'errored' | 'closed'>()

interface UserState {
  users: User[]
  isLoading: boolean
  isLoaded: boolean
  error: string | null
  loadFromLocal: () => Promise<void>
  syncFromServer: () => Promise<void>
  fetchUsers: () => Promise<void>
  fetchProfile: (id: string) => Promise<void>
  resyncRealtime: (id?: string) => Promise<void>
  subscribeUsers: () => () => void
  subscribeProfile: (id: string) => () => void
  addUser: (data: CreateUserInput) => Promise<{ success: boolean; error?: string }>
  updateUser: (id: string, data: Partial<User>) => Promise<{ success: boolean; error?: string }>
  removeUser: (id: string) => Promise<void>
  reset: () => void
}

const mapProfileToUser = (profile: any, existingUser?: User): User => {
  const base = existingUser ? { ...existingUser } : {} as User;
  
  return {
    ...base,
    id: profile.id || base.id,
    name: profile.name !== undefined ? profile.name : base.name,
    email: profile.email !== undefined ? profile.email : (base.email || ''),
    role: profile.role !== undefined ? profile.role as UserRole : base.role,
    phone: profile.phone !== undefined ? profile.phone : base.phone,
    is_active: profile.is_active !== undefined ? profile.is_active : (base.is_active ?? true),
    is_online: profile.is_online !== undefined ? profile.is_online : base.is_online,
    fcm_token: profile.fcm_token !== undefined ? profile.fcm_token : base.fcm_token,
    courier_status: profile.courier_status !== undefined ? profile.courier_status : base.courier_status,
    off_reason: profile.off_reason !== undefined ? profile.off_reason : base.off_reason,
    vehicle_type: profile.vehicle_type !== undefined ? profile.vehicle_type : base.vehicle_type,
    plate_number: profile.plate_number !== undefined ? profile.plate_number : base.plate_number,
    queue_position: profile.queue_position !== undefined ? profile.queue_position : base.queue_position,
    created_at: profile.created_at || base.created_at || new Date().toISOString(),
    updated_at: profile.updated_at || base.updated_at || new Date().toISOString(),
    total_deliveries_alltime: profile.total_deliveries_alltime !== undefined ? profile.total_deliveries_alltime : base.total_deliveries_alltime,
    total_earnings_alltime: profile.total_earnings_alltime !== undefined ? profile.total_earnings_alltime : base.total_earnings_alltime,
    unpaid_count: profile.unpaid_count !== undefined ? profile.unpaid_count : base.unpaid_count,
    unpaid_amount: profile.unpaid_amount !== undefined ? profile.unpaid_amount : base.unpaid_amount,
  };
};

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
        
        // Use a functional update to avoid stale closure issues during initial sync
        set(() => ({ 
          users: users, 
          isLoaded: true,
          error: null
        }))
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

  resyncRealtime: async (id) => {
    // 1. Force fetch data
    try {
      if (id) {
        await get().fetchProfile(id)
      } else {
        await get().fetchUsers()
      }
    } catch(err) {
      console.error('[resyncRealtime_user] Failed to patch data', err)
    }
    
    // 2. Check channel state and self-heal if necessary
    const channelId = id ? `profile:single:${id}` : 'users:list'
    const currentState = channelStates.get(channelId)
    
    if (!currentState || currentState === 'errored' || currentState === 'closed') {
      console.warn(`[useUserStore] Channel ${channelId} dead (state: ${currentState}). Resyncing...`)
      const existing = activeChannels.get(channelId)
      if (existing) supabase.removeChannel(existing)
      activeChannels.delete(channelId)
      channelStates.delete(channelId)
      
      setTimeout(() => {
        if (id) {
          get().subscribeProfile(id)
        } else {
          get().subscribeUsers()
        }
      }, 500)
    }
  },

  subscribeUsers: () => {
    const channelId = 'users:list'
    
    // 1. Singleton pattern: return existing active channel if already established
    const currentState = channelStates.get(channelId)
    const existing = activeChannels.get(channelId)
    if (existing && currentState !== 'errored' && currentState !== 'closed') {
      if (currentState === 'joined' || currentState === 'joining') {
        console.log(`♻️ Reusing active realtime channel for ${channelId}`)
        get().fetchUsers()
        return () => {
          // No-op if someone else is still using it? 
          // Actually, for simplicity, we don't handle reference counting yet, 
          // but we avoid the 'postgres_changes after subscribe' crash.
        }
      }
      // If it exists but is broken/closed, clean it up before recreating
      supabase.removeChannel(existing)
      activeChannels.delete(channelId)
    }

    const channel = supabase.channel(channelId)
    // IMPORTANT: Register before subscribe
    channel
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
            const existingUser = currentUsers.find(u => u.id === newRec.id)
            const updatedUser = mapProfileToUser(newRec, existingUser)
            
            set({ users: currentUsers.map(u => u.id === newRec.id ? updatedUser : u) })
            profiles.put(updatedUser)
            
            if (newRec.courier_status || newRec.is_online !== undefined) {
              console.log(`✅ Courier ${updatedUser.name} status updated: ${updatedUser.is_online ? 'Online' : 'Offline'} (${updatedUser.courier_status})`)
            }
          } else if (eventType === 'DELETE') {
            set({ users: currentUsers.filter(u => u.id !== oldRec.id) })
            profiles.delete(oldRec.id)
          }
        }
      )

    // Set map BEFORE subscribe to lock other callers
    activeChannels.set(channelId, channel)

    channel.subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.error(`❌ Realtime subscription failed for ${channelId}:`, err)
        channelStates.set(channelId, 'errored')
        
        // Self-healing
        setTimeout(() => {
          if (channelStates.get(channelId) === 'errored') {
            console.log(`♻️ Auto-reconnecting channel ${channelId}...`)
            const existing = activeChannels.get(channelId)
            if (existing) supabase.removeChannel(existing)
            activeChannels.delete(channelId)
            channelStates.delete(channelId)
            get().subscribeUsers()
          }
        }, 5000)
      } else if (status === 'SUBSCRIBED') {
        console.log(`✅ Realtime connection active: ${channelId}. Syncing state...`)
        activeChannels.set(channelId, channel)
        channelStates.set(channelId, 'joined')
        get().fetchUsers()
      } else if (status === 'CLOSED') {
        console.log(`🔌 Realtime connection closed: ${channelId}`)
        channelStates.set(channelId, 'closed')
      }
    })
      
    return () => {
      console.log(`🧼 Cleaning up channel: ${channelId}`)
      supabase.removeChannel(channel)
      activeChannels.delete(channelId)
    }
  },

  subscribeProfile: (id: string) => {
    const channelId = `profile:single:${id}`
    
    // 1. Singleton pattern: return existing active channel if already established
    const currentState = channelStates.get(channelId)
    const existing = activeChannels.get(channelId)
    if (existing && currentState !== 'errored' && currentState !== 'closed') {
      if (currentState === 'joined' || currentState === 'joining') {
        get().fetchProfile(id)
        return () => {
           // We keep it alive as long as at least one component needs it
           // In this simplified version, we just let it be reused.
        }
      }
      supabase.removeChannel(existing)
      activeChannels.delete(channelId)
    }

    const channel = supabase.channel(channelId)
    
    // IMPORTANT: Setup listeners BEFORE subscribe
    channel
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

    // Set map BEFORE subscribe to lock other callers
    activeChannels.set(channelId, channel)

    channel.subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.error(`❌ Realtime profile subscription failed for ${channelId}:`, err)
        channelStates.set(channelId, 'errored')
        
        setTimeout(() => {
          if (channelStates.get(channelId) === 'errored') {
             console.log(`♻️ Auto-reconnecting profile channel ${id}...`)
             const existing = activeChannels.get(channelId)
             if (existing) supabase.removeChannel(existing)
             activeChannels.delete(channelId)
             channelStates.delete(channelId)
             get().subscribeProfile(id)
          }
        }, 5000)
      } else if (status === 'SUBSCRIBED') {
        console.log(`✅ Realtime profile sync active: ${id}`)
        activeChannels.set(channelId, channel)
        channelStates.set(channelId, 'joined')
        get().fetchProfile(id)
      } else if (status === 'CLOSED') {
        channelStates.set(channelId, 'closed')
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
