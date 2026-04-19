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
      storageKey: 'kurirdev-auth-token',
    },
    realtime: {
      params: { eventsPerSecond: 10 },
      worker: true,
      workerUrl: '/worker.js',
      heartbeatIntervalMs: 20000,
      timeout: 15000
    }
  }
)

// Global auth state listener
// Centralized auth listener moved to AuthContext.tsx
