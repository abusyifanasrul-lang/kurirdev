import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleAuth } from 'https://esm.sh/google-auth-library@8'

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET')
  
  const supabaseClient = createClient(supabaseUrl, supabaseServiceRole)

  try {
    // 1. Security Check
    const xSecret = req.headers.get('X-Webhook-Secret')
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '')
    const providedSecret = (xSecret || authHeader || '').trim()
    const expectedSecret = (webhookSecret || '').trim()

    if (webhookSecret && providedSecret !== expectedSecret) {
      console.error(`Unauthorized: Secret mismatch.`)
      // Diagnostic logging (safe to log lengths)
      console.log(`Diag: Provided len=${providedSecret.length}, Expected len=${expectedSecret.length}`)
      return new Response(JSON.stringify({ error: "Unauthorized", message: "Secret mismatch" }), { status: 401 })
    }

    const payload = await req.json()
    console.log('Notification payload received:', JSON.stringify(payload, null, 2))

    // Expecting trigger from 'notifications' table INSERT
    if (payload.type !== 'INSERT' || payload.table !== 'notifications') {
      return new Response(JSON.stringify({ message: "Not a notification insert, ignoring." }), { status: 200 })
    }

    const notification = payload.record
    const notificationId = notification.id

    // 2. Get Courier's FCM Token
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('fcm_token')
      .eq('id', notification.user_id)
      .single()

    if (profileError || !profile?.fcm_token) {
      console.log(`Courier ${notification.user_id} has no valid FCM token, skipping push.`)
      await supabaseClient
        .from('notifications')
        .update({ fcm_status: 'skipped', fcm_error: 'No FCM token' })
        .eq('id', notificationId)
      return new Response(JSON.stringify({ message: "Skipped: No FCM token" }), { status: 200 })
    }

    // 3. Initialize FCM Auth
    const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
    if (!serviceAccountJson) throw new Error('FIREBASE_SERVICE_ACCOUNT not set')
    
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
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`

    // 4. Send FCM v1 Request with TTL (2 hours = 7200s)
    const fcmMessage = {
      message: {
        token: profile.fcm_token,
        notification: {
          title: notification.title,
          body: notification.message
        },
        data: notification.data || {},
        android: {
          ttl: "7200s",
          priority: "high"
        },
        apns: {
          headers: {
            "apns-expiration": Math.floor(Date.now() / 1000 + 7200).toString()
          }
        }
      }
    }

    const response = await fetch(fcmUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fcmMessage)
    })

    const result = await response.json()
    
    // 5. Handle Results and Cleanup
    if (response.ok) {
      console.log('✅ FCM Send Success:', result)
      await supabaseClient
        .from('notifications')
        .update({ fcm_status: 'sent' })
        .eq('id', notificationId)
    } else {
      console.error('❌ FCM Send Error:', JSON.stringify(result, null, 2))
      const errorMsg = result.error?.message || 'Unknown FCM error'
      const ErrorCode = result.error?.status
      
      await supabaseClient
        .from('notifications')
        .update({ fcm_status: 'failed', fcm_error: errorMsg })
        .eq('id', notificationId)

      // Token Cleanup for UNREGISTERED or NOT_FOUND
      if (ErrorCode === 'UNREGISTERED' || ErrorCode === 'NOT_FOUND' || errorMsg.includes('unregistered')) {
        console.log('🗑️ Clearing invalid/stale token for user:', notification.user_id)
        await supabaseClient
          .from('profiles')
          .update({ fcm_token: null, fcm_token_updated_at: null })
          .eq('id', notification.user_id)
      }
    }

    return new Response(JSON.stringify({ status: "processed", result }), { status: 200 })

  } catch (err: any) {
    console.error('Edge Function Fatal Error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
