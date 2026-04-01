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

    console.log('Function Invoked. Env Check:', { 
      hasUrl: !!supabaseUrl, 
      hasServiceKey: !!serviceRoleKey,
    })

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('CRITICAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
      return new Response(JSON.stringify({ 
        error: 'Edge Function misconfigured',
        details: 'Missing environment variables on server',
        step: 'init_env'
      }), { status: 500, headers: corsHeaders })
    }

    // Init Admin client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // 1. Authenticate the caller
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
    console.log('Auth Header Present:', !!authHeader)
    
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        error: 'Missing Authorization header',
        debug: { headerFound: false }
      }), { status: 401, headers: corsHeaders })
    }

    // Extract JWT token and verify directly via admin client
    const token = authHeader.replace(/^[Bb]earer\s+/, '').trim()
    
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !caller) {
      console.error('Authentication Error:', authError?.message || 'No user found')
      return new Response(JSON.stringify({ 
        error: 'Unauthorized: Invalid session', 
        details: authError?.message || 'User not found in session',
        debug: { 
          tokenLength: token.length,
          tokenPrefix: token.substring(0, 5),
          authError: authError?.message,
          hasCaller: !!caller
        },
        step: 'auth_check'
      }), { status: 401, headers: corsHeaders })
    }

    console.log('Caller Authenticated:', caller.id)

    // 2. Check caller's role in DB
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle() // Use maybeSingle to avoid 406 errors if missing

    // Special case for a known internal admin if they haven't set up their profile yet
    const isInternalAdmin = caller.id === '2b3cb9f5-924f-4627-9877-1f7e1e16a401'

    if (!isInternalAdmin && (profileError || !profile)) {
      console.error('RBAC Check Failed:', { id: caller.id, error: profileError })
      return new Response(JSON.stringify({ 
        error: 'Forbidden: Admin profile required', 
        details: profileError?.message || 'Current user has no profile record',
        userId: caller.id 
      }), { status: 403, headers: corsHeaders })
    }

    const callerRole = isInternalAdmin ? 'admin' : profile?.role
    console.log('Role authorization check:', { id: caller.id, role: callerRole })
    
    const allowedRoles = ['admin', 'admin_kurir', 'owner']
    if (!allowedRoles.includes(callerRole)) {
      console.warn('Insufficient permissions:', callerRole)
      return new Response(JSON.stringify({ error: 'Forbidden: Insufficient permissions', role: callerRole }), { status: 403, headers: corsHeaders })
    }

    // 3. Process Request
    const body = await req.json().catch(() => ({}))
    const { email, password, name, phone, role } = body
    
    if (!email || !password || !role) {
      return new Response(JSON.stringify({ error: 'Missing required fields (email, password, role)' }), { status: 400, headers: corsHeaders })
    }

    console.log('Step 4: Creating Auth User:', email)
    // 4. Create Auth User
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role, phone }
    })

    if (createError) {
      console.error('Step 4 Failed: Auth creation error:', createError.message)
      return new Response(JSON.stringify({ 
        error: createError.message, 
        step: 'auth_create',
        code: createError.status 
      }), { status: 400, headers: corsHeaders })
    }

    const newUserId = newUser.user.id
    console.log('Step 5: Auth User created successfully:', newUserId)

    // 5. Create Profile (Upsert)
    console.log('Step 6: Syncing profile to DB for:', email)
    const profileData = { 
      id: newUserId, 
      role, 
      name, 
      email,
      phone: phone || null,
      updated_at: new Date().toISOString(),
      is_active: true,
      queue_position: 0
    }

    const { error: upsertError } = await supabaseAdmin
      .from('profiles')
      .upsert(profileData, { onConflict: 'id' })
    
    if (upsertError) {
      console.error('Step 6 Failed: Profile upsert error:', upsertError)
      return new Response(JSON.stringify({ 
        error: 'Auth user created, but profile failed', 
        details: upsertError.message,
        hint: upsertError.hint,
        step: 'profile_upsert' 
      }), { status: 500, headers: corsHeaders })
    }

    console.log('Step 7: Profile linked successfully')

    return new Response(JSON.stringify({ 
      message: 'User and profile created successfully', 
      user: { id: newUserId, email } 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error('Global Crash:', err)
    return new Response(JSON.stringify({ 
      error: err.message || 'Unknown internal error', 
      stack: err.stack,
      step: 'global' 
    }), { status: 500, headers: corsHeaders })
  }
})

