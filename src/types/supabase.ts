export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string
          phone: string | null
          role: 'owner' | 'admin_kurir' | 'finance' | 'courier'
          is_online: boolean
          is_active: boolean
          queue_position: number | null
          fcm_token: string | null
          fcm_token_updated_at: string | null
          total_deliveries_alltime: number
          total_earnings_alltime: number
          unpaid_count: number
          unpaid_amount: number
          platform: string | null
          last_active: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          name: string
          phone?: string | null
          role?: 'owner' | 'admin_kurir' | 'finance' | 'courier'
          is_online?: boolean
          is_active?: boolean
          queue_position?: number | null
          fcm_token?: string | null
          fcm_token_updated_at?: string | null
          total_deliveries_alltime?: number
          total_earnings_alltime?: number
          unpaid_count?: number
          unpaid_amount?: number
          platform?: string | null
          last_active?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          phone?: string | null
          role?: 'owner' | 'admin_kurir' | 'finance' | 'courier'
          is_online?: boolean
          is_active?: boolean
          queue_position?: number | null
          fcm_token?: string | null
          fcm_token_updated_at?: string | null
          total_deliveries_alltime?: number
          total_earnings_alltime?: number
          unpaid_count?: number
          unpaid_amount?: number
          platform?: string | null
          last_active?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      customers: {
        Row: {
          id: string
          name: string
          phone: string | null
          addresses: Json
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          phone?: string | null
          addresses?: Json
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          phone?: string | null
          addresses?: Json
          created_at?: string | null
          updated_at?: string | null
        }
      }
      settings: {
        Row: {
          id: string
          commission_rate: number
          commission_threshold: number
          updated_at: string | null
        }
        Insert: {
          id?: string
          commission_rate?: number
          commission_threshold?: number
          updated_at?: string | null
        }
        Update: {
          id?: string
          commission_rate?: number
          commission_threshold?: number
          updated_at?: string | null
        }
      }
      orders: {
        Row: {
          id: string
          order_number: string
          customer_id: string | null
          customer_name: string
          customer_phone: string
          customer_address: string
          items: Json
          titik: number
          total_biaya_titik: number
          beban: Json
          total_biaya_beban: number
          total_fee: number
          status: string
          payment_status: string
          courier_id: string | null
          is_waiting: boolean
          notes: string | null
          applied_commission_rate: number | null
          applied_commission_threshold: number | null
          actual_pickup_time: string | null
          actual_delivery_time: string | null
          assigned_at: string | null
          cancelled_at: string | null
          cancellation_reason: string | null
          cancel_reason_type: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          order_number: string
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          customer_address: string
          items?: Json
          titik?: number
          total_biaya_titik?: number
          beban?: Json
          total_biaya_beban?: number
          total_fee?: number
          status?: string
          payment_status?: string
          courier_id?: string | null
          is_waiting?: boolean
          notes?: string | null
          applied_commission_rate?: number | null
          applied_commission_threshold?: number | null
          actual_pickup_time?: string | null
          actual_delivery_time?: string | null
          assigned_at?: string | null
          cancelled_at?: string | null
          cancellation_reason?: string | null
          cancel_reason_type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          order_number?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          customer_address?: string
          items?: Json
          titik?: number
          total_biaya_titik?: number
          beban?: Json
          total_biaya_beban?: number
          total_fee?: number
          status?: string
          payment_status?: string
          courier_id?: string | null
          is_waiting?: boolean
          notes?: string | null
          applied_commission_rate?: number | null
          applied_commission_threshold?: number | null
          actual_pickup_time?: string | null
          actual_delivery_time?: string | null
          assigned_at?: string | null
          cancelled_at?: string | null
          cancellation_reason?: string | null
          cancel_reason_type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      tracking_logs: {
        Row: {
          id: string
          order_id: string
          status: string
          changed_by: string | null
          changed_by_name: string | null
          notes: string | null
          changed_at: string | null
        }
        Insert: {
          id?: string
          order_id: string
          status: string
          changed_by?: string | null
          changed_by_name?: string | null
          notes?: string | null
          changed_at?: string | null
        }
        Update: {
          id?: string
          order_id?: string
          status?: string
          changed_by?: string | null
          changed_by_name?: string | null
          notes?: string | null
          changed_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_auth_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      complete_order: {
        Args: {
          p_order_id: string
          p_user_id: string
          p_user_name: string
          p_commission_rate: number
          p_commission_threshold: number
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
