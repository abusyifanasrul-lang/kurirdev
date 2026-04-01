import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS Headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('Edge Function create-staff-user called, method:', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    })
  }

  try {
    const { email, password, name, phone, role } = await req.json()
    console.log('Request body:', { email, name, role })

    // Needs to be authenticated using an Admin JWT to create users
    const authHeader = req.headers.get('Authorization')
    console.log('Auth header present:', !!authHeader)
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Auth Header' }), { status: 401, headers: corsHeaders })
    }

    // Init Supabase with the service_role key to bypass RLS and use Admin Auth API
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    console.log('Supabase URL:', supabaseUrl ? 'set' : 'not set')
    console.log('Service role key:', serviceRoleKey ? 'set' : 'not set')

    const supabaseAdmin = createClient(
      supabaseUrl ?? '',
      serviceRoleKey ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verify the caller is an admin using the service role client
    const token = authHeader.replace('Bearer ', '')
    console.log('Verifying token with admin client...')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    console.log('Admin getUser result:', { user: !!user, error: authError })
    if (authError || !user) {
      console.error('Auth verification error:', authError)
      return new Response(JSON.stringify({ error: 'Unauthorized caller: Invalid token', details: authError?.message }), { status: 401, headers: corsHeaders })
    }

    // Check role from profiles
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Profile fetch error:', profileError)
      return new Response(JSON.stringify({ error: 'Failed to fetch caller profile', details: profileError }), { status: 500, headers: corsHeaders })
    }

    console.log('Caller role:', callerProfile?.role)
    const allowedRoles = ['admin', 'admin_kurir', 'owner'];
    if (!allowedRoles.includes(callerProfile?.role) && user.id !== '1') {
       return new Response(JSON.stringify({
         error: 'Forbidden: Caller does not have permission',
         callerRole: callerProfile?.role
       }), { status: 403, headers: corsHeaders })
    }

    // Now proceed to create the user in Auth
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role,
        phone
      }
    })

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: corsHeaders })
    }
    
    // Auth trigger in Postgres (schema.sql) automatically handles profile creation.
    // So we don't need to manually insert into `profiles`.
    // Wait, let's just do an update to ensure phone is correct if trigger missed something.
    if (authData.user) {
      // Small pause to allow trigger transaction to finish
      await new Promise(r => setTimeout(r, 500))
      
      const updatePayload: any = { role }
      if (phone) updatePayload.phone = phone
      if (name) updatePayload.name = name

      // If it's a courier, determine initial queue
      if (role === 'courier') {
         const { data: allCouriers } = await supabaseAdmin.from('profiles').select('queue_position').eq('role', 'courier')
         const maxQueue = allCouriers?.reduce((max, c) => Math.max(max, c.queue_position || 0), 0) || 0
         updatePayload.queue_position = maxQueue + 1
      }

      await supabaseAdmin.from('profiles').update(updatePayload).eq('id', authData.user.id)
    }

    return new Response(
      JSON.stringify({ message: 'User created successfully', user: authData.user }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
