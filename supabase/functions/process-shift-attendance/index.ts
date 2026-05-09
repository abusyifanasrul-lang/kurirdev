// Edge Function: process-shift-attendance
// Runs every minute to:
// 1. Create shift_attendance records for shifts that just started
// 2. Update late_minutes for couriers who haven't checked in yet

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

    // Get operational timezone from settings
    const { data: settings } = await supabase
      .from('settings')
      .select('operational_timezone')
      .eq('id', 'global')
      .single()

    const timezone = settings?.operational_timezone || 'Asia/Makassar'
    
    // Get current time (server time, will be converted in queries)
    const now = new Date()
    const currentTime = now.toTimeString().slice(0, 8) // HH:MM:SS
    const currentDate = now.toISOString().split('T')[0] // YYYY-MM-DD
    
    // Get day name for day_off checking
    const { data: dayNameData } = await supabase.rpc('execute_sql', {
      query: `SELECT TRIM(TO_CHAR(CURRENT_DATE, 'Day')) as day_name`
    })
    const currentDayName = dayNameData?.[0]?.day_name || 'Monday'

    console.log(`Processing attendance at ${currentTime} (${timezone})`)

    // Check if today is a holiday
    const { data: holiday } = await supabase
      .from('holidays')
      .select('*')
      .eq('date', currentDate)
      .eq('is_active', true)
      .single()

    if (holiday) {
      console.log(`Today is a holiday: ${holiday.name}. Skipping attendance processing.`)
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Today is a holiday: ${holiday.name}`,
          skipped: true
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Get all active shifts
    const { data: shifts, error: shiftsError } = await supabase
      .from('shifts')
      .select('*')
      .eq('is_active', true)

    if (shiftsError) {
      console.error('Error fetching shifts:', shiftsError)
      throw shiftsError
    }

    let recordsCreated = 0
    let recordsUpdated = 0

    // Process each shift
    for (const shift of shifts || []) {
      const shiftStartTime = shift.start_time.slice(0, 8) // HH:MM:SS
      
      // Check if this shift is starting now (within 1 minute window)
      const timeDiff = Math.abs(
        new Date(`1970-01-01T${currentTime}`).getTime() - 
        new Date(`1970-01-01T${shiftStartTime}`).getTime()
      ) / 1000 / 60 // difference in minutes

      // If shift is starting now (within 1 minute), create attendance records
      if (timeDiff <= 1) {
        console.log(`Shift ${shift.name} is starting now at ${shiftStartTime}`)

        // Get all couriers assigned to this shift
        const { data: couriers, error: couriersError } = await supabase
          .from('profiles')
          .select('id, name, is_online, day_off')
          .eq('role', 'courier')
          .eq('is_active', true)
          .eq('shift_id', shift.id)

        if (couriersError) {
          console.error(`Error fetching couriers for shift ${shift.name}:`, couriersError)
          continue
        }

        // Create attendance records for each courier
        for (const courier of couriers || []) {
          // Skip if today is courier's day off
          if (courier.day_off && courier.day_off.trim().toLowerCase() === currentDayName.toLowerCase()) {
            console.log(`Skipping ${courier.name} - today is their day off`)
            continue
          }

          // Check if attendance record already exists
          const { data: existing } = await supabase
            .from('shift_attendance')
            .select('id')
            .eq('courier_id', courier.id)
            .eq('date', currentDate)
            .single()

          if (existing) {
            console.log(`Attendance record already exists for ${courier.name}`)
            continue
          }

          // Determine status based on is_online
          const status = courier.is_online ? 'on_time' : 'late'
          const firstOnlineAt = courier.is_online ? now.toISOString() : null

          // Create attendance record
          const { error: insertError } = await supabase
            .from('shift_attendance')
            .insert({
              courier_id: courier.id,
              shift_id: shift.id,
              date: currentDate,
              first_online_at: firstOnlineAt,
              status: status,
              late_minutes: 0
            })

          if (insertError) {
            console.error(`Error creating attendance for ${courier.name}:`, insertError)
            continue
          }

          recordsCreated++
          console.log(`✅ Created ${status} attendance record for ${courier.name}`)
        }
      }

      // Update late_minutes for existing late records
      const { data: lateRecords, error: lateError } = await supabase
        .from('shift_attendance')
        .select('id, courier_id, late_minutes')
        .eq('date', currentDate)
        .eq('shift_id', shift.id)
        .eq('status', 'late')
        .is('first_online_at', null)

      if (lateError) {
        console.error(`Error fetching late records for shift ${shift.name}:`, lateError)
        continue
      }

      // Calculate late minutes for each late courier
      for (const record of lateRecords || []) {
        const shiftStartDateTime = new Date(`${currentDate}T${shiftStartTime}`)
        const lateMinutes = Math.floor((now.getTime() - shiftStartDateTime.getTime()) / 1000 / 60)

        if (lateMinutes > 0 && lateMinutes !== record.late_minutes) {
          const { error: updateError } = await supabase
            .from('shift_attendance')
            .update({ late_minutes: lateMinutes })
            .eq('id', record.id)

          if (updateError) {
            console.error(`Error updating late_minutes for record ${record.id}:`, updateError)
            continue
          }

          recordsUpdated++
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Attendance processing completed',
        timestamp: now.toISOString(),
        timezone: timezone,
        records_created: recordsCreated,
        records_updated: recordsUpdated
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error in process-shift-attendance:', error)
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
