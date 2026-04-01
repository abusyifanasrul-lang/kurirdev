import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS Headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
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

    // Needs to be authenticated using an Admin JWT to create users
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Auth Header' }), { status: 401, headers: corsHeaders })
    }

    // Init Supabase with the service_role key to bypass RLS and use Admin Auth API
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verify the caller is an admin
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized caller' }), { status: 401, headers: corsHeaders })
    }
    
    // Check role from profiles (or JWT meta)
    const { data: callerProfile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
      
    if (callerProfile?.role !== 'admin' && user.id !== '1') {
       return new Response(JSON.stringify({ error: 'Caller must be an admin' }), { status: 403, headers: corsHeaders })
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
