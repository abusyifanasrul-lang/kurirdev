import { create } from 'zustand'
import { supabase } from '@/lib/supabaseClient'
import { User, UserRole } from '@/types'

interface UserState {
  users: User[]
  isLoading: boolean
  error: string | null
  fetchUsers: () => Promise<void>
  subscribeUsers: () => () => void
  addUser: (user: User) => Promise<{ success: boolean; error?: string }>
  updateUser: (id: string, data: Partial<User>) => Promise<void>
  removeUser: (id: string) => Promise<void>
  updateUserQueuePosition: (id: string, position: number) => Promise<void>
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
  error: null,

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

  subscribeUsers: () => {
    get().fetchUsers()

    const channel = supabase.channel('public:profiles')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          const { eventType, new: newRec, old: oldRec } = payload
          const currentUsers = [...get().users]
          
          if (eventType === 'INSERT') {
            set({ users: [...currentUsers, mapProfileToUser(newRec)] })
          } else if (eventType === 'UPDATE') {
            const updatedUsers = currentUsers.map(u => 
              u.id === newRec.id ? { ...u, ...mapProfileToUser(newRec) } : u
            )
            set({ users: updatedUsers })
          } else if (eventType === 'DELETE') {
            set({ users: currentUsers.filter(u => u.id !== oldRec.id) })
          }
        }
      )
      .subscribe()
      
    return () => {
      supabase.removeChannel(channel)
    }
  },

  addUser: async (user: User) => {
    set({ isLoading: true, error: null })
    try {
      // 1. Proactive Frontend Validation
      if (!user.name || !user.email || !user.password || !user.role) {
        throw new Error('❌ Data tidak lengkap! Pastikan Nama, Email, Password, dan Role terisi.')
      }
      if (user.password.length < 8) {
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
          email: user.email,
          password: user.password,
          name: user.name,
          role: user.role,
          phone: user.phone
        }
      })

      const timeoutPromise = new Promise<{ data: null; error: Error }>((_, reject) => 
        setTimeout(() => reject(new Error('Koneksi terputus. Server terlalu lama merespon.')), 15000)
      )

      const response = await Promise.race([invokePromise, timeoutPromise]) as any

      if (response.error) {
        // Supabase functions might wrap the actual error response body
        // We can extract custom error details thrown by our edge function
        let detailedMessage = response.error.message || 'Gagal menambahkan user'
        
        try {
          if (response.error.context) {
            const body = await response.error.context.json()
            if (body && (body.error || body.details)) {
              
              const rawError = `${body.error || ''} ${body.details || ''}`.toLowerCase()
              
              // Friendly Indonesian Error Mapping
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
    await (supabase.from('profiles') as any)
      .update({ ...dbData, updated_at: new Date().toISOString() })
      .eq('id', id)
  },

  removeUser: async (id) => {
    if (id === '1') return
    await (supabase.from('profiles') as any).update({ is_active: false }).eq('id', id)
  },

  updateUserQueuePosition: async (id, position) => {
    await (supabase.from('profiles') as any).update({
      queue_position: position,
      updated_at: new Date().toISOString()
    }).eq('id', id)
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
