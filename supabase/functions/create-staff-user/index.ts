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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

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
    const supabaseClient = createClient(supabaseUrl, anonKey, {
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

    if (profileError || !profile) {
      console.error('Profile query failed for caller:', caller.id, profileError)
      return new Response(JSON.stringify({ error: 'Forbidden: Profile not found', userId: caller.id }), { status: 403, headers: corsHeaders })
    }

    console.log('Caller profile role from DB:', profile.role)
    const allowedRoles = ['admin', 'admin_kurir', 'owner']
    if (!allowedRoles.includes(profile.role)) {
      console.warn('Caller unauthorized role:', profile.role)
      return new Response(JSON.stringify({ error: 'Forbidden: Insufficient permissions', role: profile.role }), { status: 403, headers: corsHeaders })
    }

    // 3. Process Request
    const { email, password, name, phone, role } = await req.json()

    // 4. Create User
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role, phone }
    })

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: corsHeaders })
    }

    // 5. Update Profile
    if (newUser.user) {
      const updateData: any = { role, name, phone }
      
      // Initial queue for couriers
      if (role === 'courier') {
        const { data: couriers } = await supabaseAdmin.from('profiles').select('queue_position').eq('role', 'courier')
        const maxPos = couriers?.reduce((max, c) => Math.max(max, c.queue_position || 0), 0) || 0
        updateData.queue_position = maxPos + 1
      }

      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update(updateData)
        .eq('id', newUser.user.id)
      
      if (updateError) {
        console.error('Profile update error:', updateError)
      }
    }

    return new Response(JSON.stringify({ message: 'User created', user: newUser.user }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})

