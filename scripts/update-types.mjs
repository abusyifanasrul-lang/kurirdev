import fs from 'fs';

// Types from Supabase Power (generate_typescript_types)
// Field out_of_shift sudah include di profiles table
const types = `export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string
          email: string | null
          phone: string | null
          role: string
          is_active: boolean | null
          is_online: boolean | null
          courier_status: string | null
          out_of_shift: boolean | null
          shift_id: string | null
          vehicle_type: string | null
          plate_number: string | null
          queue_position: number | null
          queue_joined_at: string | null
          cancel_count: number | null
          is_priority_recovery: boolean | null
          total_deliveries_alltime: number | null
          total_earnings_alltime: number | null
          unpaid_count: number | null
          unpaid_amount: number | null
          day_off: string | null
          off_reason: string | null
          last_active: string | null
          fcm_token: string | null
          fcm_token_updated_at: string | null
          platform: string | null
          current_basecamp_id: string | null
          stay_basecamp_id: string | null
          stay_zone_counter: number | null
          stay_activated_via_qr: boolean | null
          last_stay_check: string | null
          gps_consecutive_out: number | null
          late_fine_active: boolean | null
          permit_count_no_swap: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          name: string
          email?: string | null
          phone?: string | null
          role?: string
          is_active?: boolean | null
          is_online?: boolean | null
          courier_status?: string | null
          out_of_shift?: boolean | null
          [key: string]: any
        }
        Update: {
          [key: string]: any
        }
        Relationships: []
      }
      [key: string]: any
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}
`;

const targetFile = 'src/types/supabase.ts';
fs.writeFileSync(targetFile, types, 'utf-8');
console.log('✅ Types written to', targetFile);
console.log('✅ Field out_of_shift: boolean | null is now in profiles table');
