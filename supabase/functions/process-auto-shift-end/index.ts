// Edge Function: process-auto-shift-end
// Runs every minute to auto-end shifts for couriers whose shift time has ended

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCurrentTime } from '../_shared/timezone.ts'

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

    // Get current time in operational timezone
    const timeData = await getCurrentTime(supabase)
    const { current_time, timezone } = timeData

    console.log(`[Auto Shift End] Processing at ${current_time} (${timezone})`)

    // Get all active shifts
    const { data: shifts, error: shiftsError } = await supabase
      .from('shifts')
      .select('*')
      .eq('is_active', true)

    if (shiftsError) {
      console.error('Error fetching shifts:', shiftsError)
      throw shiftsError
    }

    let processedCount = 0
    let successCount = 0
    let skipCount = 0

    // Check each shift to see if it just ended
    for (const shift of shifts || []) {
      const shiftEndTime = shift.end_time.slice(0, 8) // HH:MM:SS
      
      // Check if this shift ended in the last 1 minute
      const timeDiff = Math.abs(
        new Date(`1970-01-01T${current_time}`).getTime() - 
        new Date(`1970-01-01T${shiftEndTime}`).getTime()
      ) / 1000 / 60 // difference in minutes

      // If shift just ended (within 1 minute window)
      if (timeDiff <= 1) {
        console.log(`[Auto Shift End] Shift ${shift.name} ended at ${shiftEndTime}`)

        // Get all couriers in this shift
        const { data: couriers, error: couriersError } = await supabase
          .from('profiles')
          .select('id, name')
          .eq('role', 'courier')
          .eq('is_active', true)
          .eq('shift_id', shift.id)

        if (couriersError) {
          console.error(`Error fetching couriers for shift ${shift.name}:`, couriersError)
          continue
        }

        // Process each courier
        for (const courier of couriers || []) {
          processedCount++
          
          // Call auto_shift_end_if_ready function
          const { data: result, error: endError } = await supabase.rpc('auto_shift_end_if_ready', {
            p_courier_id: courier.id
          })

          if (endError) {
            console.error(`Error processing courier ${courier.name}:`, endError)
            continue
          }

          if (result?.success) {
            successCount++
            console.log(`✅ Auto shift end: ${courier.name}`)
          } else {
            skipCount++
            console.log(`⏭️ Skipped ${courier.name}: ${result?.reason}`)
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Auto shift end processing completed',
        timestamp: timeData.current_timestamp.toISOString(),
        timezone: timezone,
        processed: processedCount,
        success: successCount,
        skipped: skipCount
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error in process-auto-shift-end:', error)
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
