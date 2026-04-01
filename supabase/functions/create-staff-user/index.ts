import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS Headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, x_client_info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('CRITICAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
      return new Response(JSON.stringify({ 
        error: 'Edge Function misconfigured: Missing environment variables',
        step: 'init_env'
      }), { status: 500, headers: corsHeaders })
    }

    // Init Admin client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // 1. Authenticate the caller
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: corsHeaders })
    }

    // Use regular client to verify the user's session
    const supabaseClient = createClient(supabaseUrl, anonKey || serviceRoleKey, {
      global: { headers: { Authorization: authHeader } }
    })
    
    const { data: { user: caller }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid session', details: authError }), { status: 401, headers: corsHeaders })
    }

    // 2. Check caller's role in DB
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()

    const isInternalAdmin = caller.id === '2b3cb9f5-924f-4627-9877-1f7e1e16a401'

    if (!isInternalAdmin && (profileError || !profile)) {
      console.error('Profile query failed for caller:', caller.id, profileError)
      return new Response(JSON.stringify({ error: 'Forbidden: Profile not found', userId: caller.id }), { status: 403, headers: corsHeaders })
    }

    const callerRole = isInternalAdmin ? 'admin' : profile?.role
    console.log('Caller identity confirmed:', { id: caller.id, role: callerRole })
    
    const allowedRoles = ['admin', 'admin_kurir', 'owner']
    if (!allowedRoles.includes(callerRole)) {
      console.warn('Caller unauthorized role:', callerRole)
      return new Response(JSON.stringify({ error: 'Forbidden: Insufficient permissions', role: callerRole }), { status: 403, headers: corsHeaders })
    }

    // 3. Process Request
    const body = await req.json().catch(() => ({}))
    const { email, password, name, phone, role } = body
    
    if (!email || !password || !role) {
      console.warn('Missing required fields:', { email: !!email, pw: !!password, role: !!role })
      return new Response(JSON.stringify({ error: 'Missing required fields (email, password, role)' }), { status: 400, headers: corsHeaders })
    }

    console.log('Step 4: Creating Auth User for', email)
    // 4. Create Auth User
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role, phone }
    })

    if (createError) {
      console.error('Step 4 Failed: Auth creation failed:', createError.message)
      return new Response(JSON.stringify({ error: createError.message, step: 'auth' }), { status: 400, headers: corsHeaders })
    }

    console.log('Step 5: Auth User created successfully:', newUser.user.id)

    // 5. Create or Update Profile (Upsert)
    if (newUser.user) {
      console.log('Step 5: Preparing profile data for user:', newUser.user.id)
      
      const profileData: any = { 
        id: newUser.user.id, 
        role, 
        name, 
        phone: phone || null,
        updated_at: new Date().toISOString(),
        is_active: true,
        queue_position: 0
      }

      console.log('Step 6: Upserting profile for user group:', role)
      const { error: upsertError } = await supabaseAdmin
        .from('profiles')
        .upsert(profileData)
      
      if (upsertError) {
        console.error('Step 6 Failed: Profile upsert failed:', upsertError)
        // If profile fails, we should technically delete the auth user, 
        // but for now we just report it clearly to the admin.
        return new Response(JSON.stringify({ 
          error: 'Auth user created, but profile failed', 
          details: upsertError, 
          step: 'profile' 
        }), { status: 500, headers: corsHeaders })
      }
      console.log('Step 7: Profile upserted successfully')
    }

    return new Response(JSON.stringify({ message: 'User and profile created successfully', user: newUser.user }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error('Global Function Error:', err.message)
    return new Response(JSON.stringify({ error: err.message, step: 'global' }), { status: 500, headers: corsHeaders })
  }
})

