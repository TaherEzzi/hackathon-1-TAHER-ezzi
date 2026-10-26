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
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          affiliate_disclosure: string | null
          attribution_required: string
          daily_request_cap: number | null
          id: number
          max_horizon_days: number | null
          primary_provider: string | null
          show_buy_points: boolean
          show_hotel_accelerators: boolean
          stripe_price_id: string | null
          test_persona: Json
          updated_at: string
        }
        Insert: {
          affiliate_disclosure?: string | null
          attribution_required?: string
          daily_request_cap?: number | null
          id?: number
          max_horizon_days?: number | null
          primary_provider?: string | null
          show_buy_points?: boolean
          show_hotel_accelerators?: boolean
          stripe_price_id?: string | null
          test_persona?: Json
          updated_at?: string
        }
        Update: {
          affiliate_disclosure?: string | null
          attribution_required?: string
          daily_request_cap?: number | null
          id?: number
          max_horizon_days?: number | null
          primary_provider?: string | null
          show_buy_points?: boolean
          show_hotel_accelerators?: boolean
          stripe_price_id?: string | null
          test_persona?: Json
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          details: Json
          entity: string
          id: string
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          details?: Json
          entity: string
          id?: string
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          details?: Json
          entity?: string
          id?: string
        }
        Relationships: []
      }
      itineraries: {
        Row: {
          badges: string[]
          breakdown: Json
          cabin: string
          cash_amount: number | null
          cash_currency: string | null
          created_at: string
          depart_date: string | null
          destination: string
          explanation: string | null
          id: string
          is_test_persona: boolean
          miles: number | null
          mode: string
          origin: string
          pax: number
          range_high: number | null
          range_low: number | null
          return_date: string | null
          savings_eur: number | null
          savings_pct: number | null
          taxes_amount: number | null
          taxes_currency: string | null
          updated_at: string
          user_id: string
          verdict: string | null
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          badges?: string[]
          breakdown?: Json
          cabin: string
          cash_amount?: number | null
          cash_currency?: string | null
          created_at?: string
          depart_date?: string | null
          destination: string
          explanation?: string | null
          id?: string
          is_test_persona?: boolean
          miles?: number | null
          mode: string
          origin: string
          pax?: number
          range_high?: number | null
          range_low?: number | null
          return_date?: string | null
          savings_eur?: number | null
          savings_pct?: number | null
          taxes_amount?: number | null
          taxes_currency?: string | null
          updated_at?: string
          user_id: string
          verdict?: string | null
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          badges?: string[]
          breakdown?: Json
          cabin?: string
          cash_amount?: number | null
          cash_currency?: string | null
          created_at?: string
          depart_date?: string | null
          destination?: string
          explanation?: string | null
          id?: string
          is_test_persona?: boolean
          miles?: number | null
          mode?: string
          origin?: string
          pax?: number
          range_high?: number | null
          range_low?: number | null
          return_date?: string | null
          savings_eur?: number | null
          savings_pct?: number | null
          taxes_amount?: number | null
          taxes_currency?: string | null
          updated_at?: string
          user_id?: string
          verdict?: string | null
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: []
      }
      pair_valuations: {
        Row: {
          cpp_high: number
          cpp_low: number
          currency: string
          from_code: string
          id: string
          source_url: string
          to_code: string
          verified_at: string
        }
        Insert: {
          cpp_high: number
          cpp_low: number
          currency?: string
          from_code: string
          id?: string
          source_url: string
          to_code: string
          verified_at: string
        }
        Update: {
          cpp_high?: number
          cpp_low?: number
          currency?: string
          from_code?: string
          id?: string
          source_url?: string
          to_code?: string
          verified_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          is_test_persona: boolean
          locale: string
        }
        Insert: {
          created_at?: string
          id: string
          is_test_persona?: boolean
          locale?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_test_persona?: boolean
          locale?: string
        }
        Relationships: []
      }
      programs: {
        Row: {
          code: string
          currency_name: string
          id: string
          is_active: boolean
          kind: string
          name: string
        }
        Insert: {
          code: string
          currency_name: string
          id?: string
          is_active?: boolean
          kind: string
          name: string
        }
        Update: {
          code?: string
          currency_name?: string
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
        }
        Relationships: []
      }
      revolut_plans: {
        Row: {
          credit_points_per_eur: number | null
          debit_points_per_eur: number
          monthly_fee_eur: number
          note: string | null
          plan: string
          source_url: string
          verified_at: string
        }
        Insert: {
          credit_points_per_eur?: number | null
          debit_points_per_eur: number
          monthly_fee_eur: number
          note?: string | null
          plan: string
          source_url: string
          verified_at: string
        }
        Update: {
          credit_points_per_eur?: number | null
          debit_points_per_eur?: number
          monthly_fee_eur?: number
          note?: string | null
          plan?: string
          source_url?: string
          verified_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transfer_partners: {
        Row: {
          bonus_pct: number | null
          from_program_id: string
          ratio: number
          step: number | null
          to_program_id: string
          verified_at: string | null
        }
        Insert: {
          bonus_pct?: number | null
          from_program_id: string
          ratio: number
          step?: number | null
          to_program_id: string
          verified_at?: string | null
        }
        Update: {
          bonus_pct?: number | null
          from_program_id?: string
          ratio?: number
          step?: number | null
          to_program_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transfer_partners_from_program_id_fkey"
            columns: ["from_program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_partners_to_program_id_fkey"
            columns: ["to_program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_plans: {
        Row: {
          amount: number
          checks: Json
          created_at: string
          from_program_id: string
          id: string
          itinerary_id: string | null
          status: string
          to_program_id: string
          user_id: string
        }
        Insert: {
          amount: number
          checks?: Json
          created_at?: string
          from_program_id: string
          id?: string
          itinerary_id?: string | null
          status?: string
          to_program_id: string
          user_id: string
        }
        Update: {
          amount?: number
          checks?: Json
          created_at?: string
          from_program_id?: string
          id?: string
          itinerary_id?: string | null
          status?: string
          to_program_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_plans_from_program_id_fkey"
            columns: ["from_program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_plans_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_plans_to_program_id_fkey"
            columns: ["to_program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      usage: {
        Row: {
          calls: number
          day: string
          provider: string
          user_id: string
        }
        Insert: {
          calls?: number
          day?: string
          provider: string
          user_id: string
        }
        Update: {
          calls?: number
          day?: string
          provider?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_balances: {
        Row: {
          account_age_days: number | null
          balance: number
          id: string
          program_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_age_days?: number | null
          balance?: number
          id?: string
          program_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_age_days?: number | null
          balance?: number
          id?: string
          program_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_balances_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_app_admin: { Args: never; Returns: boolean }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
