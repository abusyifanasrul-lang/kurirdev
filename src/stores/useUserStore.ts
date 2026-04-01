import { create } from 'zustand'
import { supabase } from '@/lib/supabaseClient'
import { User, UserRole } from '@/types'

interface UserState {
  users: User[]
  isLoading: boolean
  fetchUsers: () => Promise<void>
  subscribeUsers: () => () => void
  addUser: (user: User) => Promise<void>
  updateUser: (id: string, data: Partial<User>) => Promise<void>
  removeUser: (id: string) => Promise<void>
  updateUserQueuePosition: (id: string, position: number) => Promise<void>
  initQueuePositions: () => Promise<void>
  reset: () => void
}

// Helper to map Supabase profiles row to app User type
const mapProfileToUser = (profile: any): User => ({
  id: profile.id,
  name: profile.name,
  email: '', // Usually not loaded directly from profiles except during login
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

  fetchUsers: async () => {
    const { data: profiles, error } = await supabase.from('profiles').select('*')
    if (error) {
      console.error('fetchUsers error:', error)
      set({ isLoading: false })
      return
    }
    set({ users: profiles.map(p => mapProfileToUser(p)), isLoading: false })
  },

  subscribeUsers: () => {
    // Initial fetch
    get().fetchUsers()

    // Listen to realtime changes on profiles
    const channel = supabase.channel('public:profiles')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          const { eventType, new: newRec, old: oldRec } = payload
          const users = [...get().users]
          
          if (eventType === 'INSERT') {
            users.push(mapProfileToUser(newRec))
          } else if (eventType === 'UPDATE') {
            const idx = users.findIndex(u => u.id === newRec.id)
            if (idx !== -1) {
               users[idx] = { ...users[idx], ...mapProfileToUser(newRec) }
            } else {
               users.push(mapProfileToUser(newRec))
            }
          } else if (eventType === 'DELETE') {
            const idx = users.findIndex(u => u.id === oldRec.id)
            if (idx !== -1) users.splice(idx, 1)
          }
          set({ users })
        }
      )
      .subscribe()
      
    // Return unsubscribe function
    return () => {
      supabase.removeChannel(channel)
    }
  },

  addUser: async (user) => {
    // Get current session for authentication
    const { data: { session } } = await supabase.auth.getSession()
    
    // Uses Edge Function to bypass RLS and create a new auth user
    const { data, error } = await supabase.functions.invoke('create-staff-user', {
      headers: {
        Authorization: `Bearer ${session?.access_token}`
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
      console.error('Failed to add user via Edge Function:', error)
      throw error
    }
    
    console.log('User created:', data)
  },

  updateUser: async (id, data) => {
    // Remove local state fields that shouldn't go to DB directly
    const { email, password, ...dbData } = data as any
    await supabase.from('profiles')
      .update({ ...dbData, updated_at: new Date().toISOString() })
      .eq('id', id)
  },

  removeUser: async (id) => {
    if (id === '1') return Promise.resolve() // Protect system admin
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
      (max, c) => Math.max(max, c.queue_position ?? 0), 0
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

  reset: () => set({ users: [], isLoading: false }),
}))
