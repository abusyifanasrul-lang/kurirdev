/**
 * Shared timezone utilities for Edge Functions
 * 
 * CRITICAL: All Edge Functions MUST use these utilities to ensure
 * consistent timezone handling across the entire application.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface TimeData {
  current_date: string        // YYYY-MM-DD in operational timezone
  current_time: string        // HH:MM:SS in operational timezone
  current_timestamp: Date     // Full timestamp in operational timezone
  day_name: string           // Day name (e.g., "Monday")
  timezone: string           // Timezone name (e.g., "Asia/Jakarta")
}

/**
 * Get current time in operational timezone from database settings.
 * 
 * This is the ONLY way Edge Functions should get current time.
 * Never use `new Date()` directly for business logic!
 * 
 * @param supabase - Supabase client instance
 * @returns TimeData object with all time information in operational timezone
 * 
 * @example
 * const timeData = await getCurrentTime(supabase)
 * console.log(`Current date: ${timeData.current_date}`) // 2026-05-10
 * console.log(`Current time: ${timeData.current_time}`) // 14:30:45
 */
export async function getCurrentTime(supabase: SupabaseClient): Promise<TimeData> {
  // Get operational timezone from settings
  const { data: settings } = await supabase
    .from('settings')
    .select('operational_timezone')
    .eq('id', 'global')
    .single()

  const timezone = settings?.operational_timezone || 'Asia/Jakarta'
  
  // Get current time in operational timezone using PostgreSQL
  const { data: timeData, error } = await supabase.rpc('execute_sql', {
    query: `
      SELECT 
        (NOW() AT TIME ZONE '${timezone}')::date as current_date,
        (NOW() AT TIME ZONE '${timezone}')::time as current_time,
        NOW() AT TIME ZONE '${timezone}' as current_timestamp,
        TRIM(TO_CHAR(NOW() AT TIME ZONE '${timezone}', 'Day')) as day_name
    `
  })

  if (error || !timeData || timeData.length === 0) {
    throw new Error(`Failed to get current time: ${error?.message || 'No data returned'}`)
  }

  return {
    current_date: timeData[0].current_date,
    current_time: timeData[0].current_time.slice(0, 8), // HH:MM:SS
    current_timestamp: new Date(timeData[0].current_timestamp),
    day_name: timeData[0].day_name,
    timezone: timezone
  }
}

/**
 * Convert a date string to operational timezone.
 * 
 * @param supabase - Supabase client instance
 * @param dateStr - ISO date string (e.g., "2026-05-10T14:30:00Z")
 * @returns Date object in operational timezone
 */
export async function toOperationalTimezone(
  supabase: SupabaseClient,
  dateStr: string
): Promise<Date> {
  const { data: settings } = await supabase
    .from('settings')
    .select('operational_timezone')
    .eq('id', 'global')
    .single()

  const timezone = settings?.operational_timezone || 'Asia/Jakarta'
  
  const { data, error } = await supabase.rpc('execute_sql', {
    query: `SELECT ('${dateStr}'::timestamptz AT TIME ZONE '${timezone}') as local_time`
  })

  if (error || !data || data.length === 0) {
    throw new Error(`Failed to convert timezone: ${error?.message || 'No data returned'}`)
  }

  return new Date(data[0].local_time)
}

/**
 * Get date range for "today" in operational timezone.
 * 
 * @param supabase - Supabase client instance
 * @returns Object with start and end timestamps for today
 */
export async function getTodayRange(supabase: SupabaseClient): Promise<{
  start: Date
  end: Date
  date: string
}> {
  const timeData = await getCurrentTime(supabase)
  
  const start = new Date(`${timeData.current_date}T00:00:00`)
  const end = new Date(`${timeData.current_date}T23:59:59.999`)
  
  return {
    start,
    end,
    date: timeData.current_date
  }
}
