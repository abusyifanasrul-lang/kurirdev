import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleAuth } from 'https://esm.sh/google-auth-library@8'

serve(async (req) => {
  try {
    const payload = await req.json()
    console.log('Webhook payload received:', JSON.stringify(payload, null, 2))

    // Only process UPDATE or INSERT events
    if (payload.type !== 'UPDATE' && payload.type !== 'INSERT') {
      return new Response(JSON.stringify({ message: "Not an UPDATE or INSERT event" }), { status: 200 })
    }

    const { record, old_record } = payload
    
    // Check if status changed to 'assigned' or if a new order is assigned immediately
    const isNewAssignment = (payload.type === 'INSERT' && record.status === 'assigned') ||
                            (payload.type === 'UPDATE' && old_record?.status !== 'assigned' && record.status === 'assigned')

    if (!isNewAssignment) {
      return new Response(JSON.stringify({ message: "Not a new assignment, ignoring." }), { status: 200 })
    }

    if (!record.courier_id) {
       return new Response(JSON.stringify({ message: "No courier_id assigned." }), { status: 200 })
    }

    // Initialize Supabase Client to get courier's FCM token
    const authHeader = req.headers.get('Authorization')
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader || '' } } }
    )

    // Get the FCM token from profiles
    const { data: profile, error } = await supabaseClient
      .from('profiles')
      .select('fcm_token')
      .eq('id', record.courier_id)
      .single()

    if (error || !profile?.fcm_token) {
      console.log(`Courier ${record.courier_id} has no valid FCM token or error:`, error)
      return new Response(JSON.stringify({ message: "Courier has no FCM token." }), { status: 200 })
    }

    const fcmToken = profile.fcm_token

    // Initialize Google Auth
    const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
    if (!serviceAccountJson) {
       throw new Error('FIREBASE_SERVICE_ACCOUNT is not set in Edge Function secrets')
    }
    
    const serviceAccount = JSON.parse(serviceAccountJson)
    const googleAuth = new GoogleAuth({
      credentials: {
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key,
      },
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
      projectId: serviceAccount.project_id
    })
    
    const accessToken = await googleAuth.getAccessToken()

    // Send FCM v1 Request
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`
    const message = {
      message: {
        token: fcmToken,
        notification: {
          title: "Order Baru Masuk!",
          body: `Order ${record.order_number} sebesar Rp ${record.total_fee.toLocaleString('id-ID')} menunggumu!`
        },
        data: {
          orderId: record.id,
          type: "NEW_ASSIGNMENT"
        }
      }
    }

    const response = await fetch(fcmUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message)
    })

    const result = await response.json()
    console.log('FCM Send Result:', result)

    return new Response(JSON.stringify({ message: "Notification sent", result }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err: any) {
    console.error('Edge Function Error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
