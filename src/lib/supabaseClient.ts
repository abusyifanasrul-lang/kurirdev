import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase' // We will generate this next or manually type it

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase configuration error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be defined in your .env file.')
}

// Create a single supabase client for interacting with your database
export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.sessionStorage,
      storageKey: 'kurirdev-auth-token',
    }
  }
)

// Global auth state listener
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    // Stores will be reset in AuthContext logout logic
    console.log('User signed out from Supabase');
  }
})
