export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      client_logs: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          level: string
          message: string
          stack_trace: string | null
          url: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          level: string
          message: string
          stack_trace?: string | null
          url?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          level?: string
          message?: string
          stack_trace?: string | null
          url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      customer_change_requests: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          customer_id: string | null
          id: string
          old_data: Json
          order_id: string | null
          requested_data: Json
          requester_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          old_data: Json
          order_id?: string | null
          requested_data: Json
          requester_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          old_data?: Json
          order_id?: string | null
          requested_data?: Json
          requester_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_change_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_change_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_change_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_change_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          addresses: Json | null
          created_at: string | null
          id: string
          last_order_at: string | null
          name: string
          order_count: number | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          addresses?: Json | null
          created_at?: string | null
          id?: string
          last_order_at?: string | null
          name: string
          order_count?: number | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          addresses?: Json | null
          created_at?: string | null
          id?: string
          last_order_at?: string | null
          name?: string
          order_count?: number | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          data: Json | null
          fcm_error: string | null
          fcm_status: string | null
          id: string
          idempotency_key: string | null
          is_read: boolean | null
          message: string
          sent_at: string | null
          title: string
          type: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          data?: Json | null
          fcm_error?: string | null
          fcm_status?: string | null
          id?: string
          idempotency_key?: string | null
          is_read?: boolean | null
          message: string
          sent_at?: string | null
          title: string
          type?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          data?: Json | null
          fcm_error?: string | null
          fcm_status?: string | null
          id?: string
          idempotency_key?: string | null
          is_read?: boolean | null
          message?: string
          sent_at?: string | null
          title?: string
          type?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          actual_delivery_time: string | null
          actual_pickup_time: string | null
          applied_commission_rate: number | null
          applied_commission_threshold: number | null
          assigned_at: string | null
          beban: Json | null
          cancel_reason_type: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          courier_id: string | null
          created_at: string | null
          created_by: string | null
          customer_address: string
          customer_address_id: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string
          estimated_delivery_time: string | null
          id: string
          is_waiting: boolean | null
          item_name: string | null
          item_price: number | null
          items: Json | null
          notes: string | null
          order_number: string
          payment_status: string | null
          status: string | null
          titik: number | null
          total_biaya_beban: number | null
          total_biaya_titik: number | null
          total_fee: number | null
          updated_at: string | null
        }
        Insert: {
          actual_delivery_time?: string | null
          actual_pickup_time?: string | null
          applied_commission_rate?: number | null
          applied_commission_threshold?: number | null
          assigned_at?: string | null
          beban?: Json | null
          cancel_reason_type?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          courier_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_address: string
          customer_address_id?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          estimated_delivery_time?: string | null
          id?: string
          is_waiting?: boolean | null
          item_name?: string | null
          item_price?: number | null
          items?: Json | null
          notes?: string | null
          order_number: string
          payment_status?: string | null
          status?: string | null
          titik?: number | null
          total_biaya_beban?: number | null
          total_biaya_titik?: number | null
          total_fee?: number | null
          updated_at?: string | null
        }
        Update: {
          actual_delivery_time?: string | null
          actual_pickup_time?: string | null
          applied_commission_rate?: number | null
          applied_commission_threshold?: number | null
          assigned_at?: string | null
          beban?: Json | null
          cancel_reason_type?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          courier_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_address?: string
          customer_address_id?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          estimated_delivery_time?: string | null
          id?: string
          is_waiting?: boolean | null
          item_name?: string | null
          item_price?: number | null
          items?: Json | null
          notes?: string | null
          order_number?: string
          payment_status?: string | null
          status?: string | null
          titik?: number | null
          total_biaya_beban?: number | null
          total_biaya_titik?: number | null
          total_fee?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          courier_status: string | null
          created_at: string | null
          email: string | null
          fcm_token: string | null
          fcm_token_updated_at: string | null
          id: string
          is_active: boolean | null
          is_online: boolean | null
          last_active: string | null
          name: string
          off_reason: string | null
          phone: string | null
          plate_number: string | null
          platform: string | null
          queue_position: number | null
          role: string
          total_deliveries_alltime: number | null
          total_earnings_alltime: number | null
          unpaid_amount: number | null
          unpaid_count: number | null
          updated_at: string | null
          vehicle_type: string | null
        }
        Insert: {
          courier_status?: string | null
          created_at?: string | null
          email?: string | null
          fcm_token?: string | null
          fcm_token_updated_at?: string | null
          id: string
          is_active?: boolean | null
          is_online?: boolean | null
          last_active?: string | null
          name: string
          off_reason?: string | null
          phone?: string | null
          plate_number?: string | null
          platform?: string | null
          queue_position?: number | null
          role?: string
          total_deliveries_alltime?: number | null
          total_earnings_alltime?: number | null
          unpaid_amount?: number | null
          unpaid_count?: number | null
          updated_at?: string | null
          vehicle_type?: string | null
        }
        Update: {
          courier_status?: string | null
          created_at?: string | null
          email?: string | null
          fcm_token?: string | null
          fcm_token_updated_at?: string | null
          id?: string
          is_active?: boolean | null
          is_online?: boolean | null
          last_active?: string | null
          name?: string
          off_reason?: string | null
          phone?: string | null
          plate_number?: string | null
          platform?: string | null
          queue_position?: number | null
          role?: string
          total_deliveries_alltime?: number | null
          total_earnings_alltime?: number | null
          unpaid_amount?: number | null
          unpaid_count?: number | null
          updated_at?: string | null
          vehicle_type?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          commission_rate: number
          commission_threshold: number
          courier_instructions: Json | null
          operational_area: string | null
          operational_timezone: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          commission_rate?: number
          commission_threshold?: number
          courier_instructions?: Json | null
          operational_area?: string | null
          operational_timezone?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          commission_rate?: number
          commission_threshold?: number
          courier_instructions?: Json | null
          operational_area?: string | null
          operational_timezone?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tracking_logs: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          changed_by_name: string | null
          id: string
          notes: string | null
          order_id: string | null
          status: string
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          changed_by_name?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          status: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          changed_by_name?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_logs_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_order_number: { Args: never; Returns: string }
      get_auth_user_role: { Args: never; Returns: string }
      rotate_courier_queue: {
        Args: { target_user_id: string }
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
