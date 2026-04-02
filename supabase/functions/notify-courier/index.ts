import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { GoogleAuth } from "npm:google-auth-library@8.7.0"

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
      console.error(`Status 401: Secret mismatch.`)
      // Diagnostic logging (safe to log lengths)
      console.log(`[AUTH] Provided len=${providedSecret.length}, Expected len=${expectedSecret.length}`)
      return new Response(JSON.stringify({ error: "Unauthorized", message: "Secret mismatch" }), { status: 401 })
    }

    const payload = await req.json()
    console.log('[NOTIF] Payload received:', JSON.stringify(payload, null, 2))

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
      console.log(`[NOTIF] Courier ${notification.user_id} has no valid FCM token, skipping push.`)
      await supabaseClient
        .from('notifications')
        .update({ fcm_status: 'skipped', fcm_error: 'No FCM token found in profiles' })
        .eq('id', notificationId)
      return new Response(JSON.stringify({ message: "Skipped: No FCM token" }), { status: 200 })
    }

    // 3. Initialize FCM Auth
    const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
    if (!serviceAccountJson) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set')
    }
    
    let serviceAccount
    try {
      serviceAccount = JSON.parse(serviceAccountJson)
    } catch (e) {
      console.error('[FATAL] FIREBASE_SERVICE_ACCOUNT JSON parse failure. Token likely malformed.')
      throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON. Please re-save the secret in Supabase.')
    }

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
        },
        webpush: {
          headers: {
            "Urgency": "high"
          },
          notification: {
            "requireInteraction": true,
            "icon": "/icons/android/android-launchericon-192-192.png"
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
      console.log('[NOTIF] ✅ FCM Send Success:', result)
      await supabaseClient
        .from('notifications')
        .update({ fcm_status: 'sent' })
        .eq('id', notificationId)
    } else {
      console.error('[NOTIF] ❌ FCM Send Error:', JSON.stringify(result, null, 2))
      const errorMsg = result.error?.message || 'Unknown FCM error'
      const fcmStatus = result.error?.status
      
      await supabaseClient
        .from('notifications')
        .update({ fcm_status: 'failed', fcm_error: errorMsg })
        .eq('id', notificationId)

      // Token Cleanup for UNREGISTERED or NOT_FOUND
      if (fcmStatus === 'UNREGISTERED' || fcmStatus === 'NOT_FOUND' || errorMsg.includes('unregistered')) {
        console.log('[CLEANUP] Clearing invalid token for user:', notification.user_id)
        await supabaseClient
          .from('profiles')
          .update({ fcm_token: null, fcm_token_updated_at: null })
          .eq('id', notification.user_id)
      }
    }

    return new Response(JSON.stringify({ status: "processed", result }), { status: 200 })

  } catch (err: any) {
    console.error('[FATAL ERROR]:', err.message)
    return new Response(JSON.stringify({ 
      error: "Internal Server Error", 
      message: err.message,
      hint: "Check if FIREBASE_SERVICE_ACCOUNT or WEBHOOK_SECRET are correctly set in Supabase Dashboard -> Edge Functions -> Secrets"
    }), { status: 500 })
  }
})
