// Edge Function: process-scheduled-notifications
// This function runs periodically (via cron or manual trigger) to send scheduled notifications

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get all scheduled notifications that are due and not sent yet
    const now = new Date().toISOString()
    const { data: scheduledNotifs, error: fetchError } = await supabase
      .from('scheduled_notifications')
      .select('*')
      .lte('scheduled_at', now)
      .eq('sent', false)
      .order('scheduled_at', { ascending: true })
      .limit(100) // Process max 100 at a time

    if (fetchError) {
      console.error('Error fetching scheduled notifications:', fetchError)
      throw fetchError
    }

    if (!scheduledNotifs || scheduledNotifs.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No scheduled notifications to process',
          processed: 0
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    console.log(`Processing ${scheduledNotifs.length} scheduled notifications...`)

    const results = []

    // Process each scheduled notification
    for (const schedNotif of scheduledNotifs) {
      try {
        // Insert into notifications table (this will trigger FCM via database trigger)
        const { error: insertError } = await supabase
          .from('notifications')
          .insert({
            user_id: schedNotif.user_id,
            user_name: '', // Will be filled by trigger if needed
            title: schedNotif.title,
            message: schedNotif.message,
            type: schedNotif.type,
            data: schedNotif.data,
            is_read: false,
            fcm_status: 'pending'
          })

        if (insertError) {
          console.error(`Error inserting notification for user ${schedNotif.user_id}:`, insertError)
          results.push({
            id: schedNotif.id,
            success: false,
            error: insertError.message
          })
          continue
        }

        // Mark as sent
        const { error: updateError } = await supabase
          .from('scheduled_notifications')
          .update({ 
            sent: true, 
            sent_at: new Date().toISOString() 
          })
          .eq('id', schedNotif.id)

        if (updateError) {
          console.error(`Error marking notification ${schedNotif.id} as sent:`, updateError)
        }

        results.push({
          id: schedNotif.id,
          success: true,
          user_id: schedNotif.user_id,
          title: schedNotif.title
        })

        console.log(`✅ Sent scheduled notification ${schedNotif.id} to user ${schedNotif.user_id}`)
      } catch (error) {
        console.error(`Error processing notification ${schedNotif.id}:`, error)
        results.push({
          id: schedNotif.id,
          success: false,
          error: error.message
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Processed ${scheduledNotifs.length} scheduled notifications`,
        processed: scheduledNotifs.length,
        sent: successCount,
        failed: failCount,
        results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error in process-scheduled-notifications:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
