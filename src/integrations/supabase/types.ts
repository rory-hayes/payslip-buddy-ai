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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      anomalies: {
        Row: {
          created_at: string | null
          id: string
          message: string
          muted: boolean | null
          payslip_id: string
          severity: string | null
          snoozed_until: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          muted?: boolean | null
          payslip_id: string
          severity?: string | null
          snoozed_until?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          muted?: boolean | null
          payslip_id?: string
          severity?: string | null
          snoozed_until?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anomalies_payslip_id_fkey"
            columns: ["payslip_id"]
            isOneToOne: false
            referencedRelation: "payslips"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          created_at: string | null
          file_name: string
          file_size: number | null
          id: string
          s3_key_original: string
          s3_key_redacted: string | null
          sha256: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          s3_key_original: string
          s3_key_redacted?: string | null
          sha256?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          s3_key_original?: string
          s3_key_redacted?: string | null
          sha256?: string | null
          user_id?: string
        }
        Relationships: []
      }
      kb: {
        Row: {
          category: string
          created_at: string | null
          id: string
          link: string | null
          note: string | null
          region: string
          sort_order: number | null
          title: string
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          link?: string | null
          note?: string | null
          region: string
          sort_order?: number | null
          title: string
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          link?: string | null
          note?: string | null
          region?: string
          sort_order?: number | null
          title?: string
        }
        Relationships: []
      }
      payslips: {
        Row: {
          confidence_overall: number | null
          conflict: boolean | null
          country: string | null
          created_at: string | null
          currency: string | null
          employer_name: string | null
          explainer_text: string | null
          file_id: string
          gross: number | null
          id: string
          net: number | null
          ni_prsi: number | null
          other_deductions: Json | null
          pay_date: string | null
          pension_employee: number | null
          pension_employer: number | null
          period_end: string | null
          period_start: string | null
          period_type: string | null
          review_required: boolean | null
          student_loan: number | null
          tax_income: number | null
          updated_at: string | null
          user_id: string
          ytd: Json | null
        }
        Insert: {
          confidence_overall?: number | null
          conflict?: boolean | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          employer_name?: string | null
          explainer_text?: string | null
          file_id: string
          gross?: number | null
          id?: string
          net?: number | null
          ni_prsi?: number | null
          other_deductions?: Json | null
          pay_date?: string | null
          pension_employee?: number | null
          pension_employer?: number | null
          period_end?: string | null
          period_start?: string | null
          period_type?: string | null
          review_required?: boolean | null
          student_loan?: number | null
          tax_income?: number | null
          updated_at?: string | null
          user_id: string
          ytd?: Json | null
        }
        Update: {
          confidence_overall?: number | null
          conflict?: boolean | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          employer_name?: string | null
          explainer_text?: string | null
          file_id?: string
          gross?: number | null
          id?: string
          net?: number | null
          ni_prsi?: number | null
          other_deductions?: Json | null
          pay_date?: string | null
          pension_employee?: number | null
          pension_employer?: number | null
          period_end?: string | null
          period_start?: string | null
          period_type?: string | null
          review_required?: boolean | null
          student_loan?: number | null
          tax_income?: number | null
          updated_at?: string | null
          user_id?: string
          ytd?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "payslips_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string | null
          locale: string | null
          marketing_opt_in: boolean | null
          region: string | null
          retention_days: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          locale?: string | null
          marketing_opt_in?: boolean | null
          region?: string | null
          retention_days?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          locale?: string | null
          marketing_opt_in?: boolean | null
          region?: string | null
          retention_days?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
