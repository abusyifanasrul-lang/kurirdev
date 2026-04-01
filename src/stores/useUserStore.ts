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
  email: '', 
  role: profile.role as UserRole,
  phone: profile.phone || undefined,
  is_active: profile.is_active ?? true,
  is_online: profile.is_online,
  fcm_token: profile.fcm_token || undefined,
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
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        throw new Error('Session expired. Please log in again.')
      }

      const { data, error } = await supabase.functions.invoke('create-staff-user', {
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

      if (error) {
        throw new Error(error.message || 'Failed to create user')
      }

      await get().fetchUsers()
      set({ isLoading: false })
      return { success: true }
    } catch (e: any) {
      console.error('addUser error:', e)
      set({ error: e.message, isLoading: false })
      return { success: false, error: e.message }
    }
  },

  updateUser: async (id, data) => {
    const { email, password, ...dbData } = data as any
    await supabase.from('profiles')
      .update({ ...dbData, updated_at: new Date().toISOString() })
      .eq('id', id)
  },

  removeUser: async (id) => {
    if (id === '1') return
    await supabase.from('profiles').update({ is_active: false }).eq('id', id)
  },

  updateUserQueuePosition: async (id, position) => {
    await supabase.from('profiles').update({
      queue_position: position,
      updated_at: new Date().toISOString()
    }).eq('id', id)
  },

  initQueuePositions: async () => {
    const { data: profiles, error } = await supabase.from('profiles')
      .select('*')
      .eq('role', 'courier')
      
    if (error || !profiles) return

    const alreadyHasPosition = profiles.filter(c => c.queue_position != null)
    const needsPosition = profiles.filter(c => c.queue_position == null)

    if (needsPosition.length === 0) return

    const maxExisting = alreadyHasPosition.reduce(
      (max, c) => Math.max(max, (c.queue_position as number) ?? 0), 0
    )

    const sorted = [...needsPosition].sort(
      (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    )

    for (let i = 0; i < sorted.length; i++) {
        await supabase.from('profiles').update({
            queue_position: maxExisting + i + 1,
            updated_at: new Date().toISOString()
        }).eq('id', sorted[i].id)
    }
  },

  reset: () => set({ users: [], isLoading: false, error: null }),
}))
