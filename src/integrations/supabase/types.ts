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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      coach_uploads: {
        Row: {
          category: string
          coach_id: string
          created_at: string
          enterprise_id: string
          file_size: number | null
          filename: string
          id: string
          storage_path: string
        }
        Insert: {
          category: string
          coach_id: string
          created_at?: string
          enterprise_id: string
          file_size?: number | null
          filename: string
          id?: string
          storage_path: string
        }
        Update: {
          category?: string
          coach_id?: string
          created_at?: string
          enterprise_id?: string
          file_size?: number | null
          filename?: string
          id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_uploads_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      data_room_documents: {
        Row: {
          category: string
          created_at: string | null
          deliverable_type: string | null
          enterprise_id: string
          evidence_level: number | null
          file_size: number | null
          filename: string
          id: string
          is_generated: boolean | null
          label: string
          storage_path: string
          updated_at: string | null
          uploaded_by: string
        }
        Insert: {
          category: string
          created_at?: string | null
          deliverable_type?: string | null
          enterprise_id: string
          evidence_level?: number | null
          file_size?: number | null
          filename: string
          id?: string
          is_generated?: boolean | null
          label: string
          storage_path: string
          updated_at?: string | null
          uploaded_by: string
        }
        Update: {
          category?: string
          created_at?: string | null
          deliverable_type?: string | null
          enterprise_id?: string
          evidence_level?: number | null
          file_size?: number | null
          filename?: string
          id?: string
          is_generated?: boolean | null
          label?: string
          storage_path?: string
          updated_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_room_documents_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      data_room_shares: {
        Row: {
          access_token: string | null
          can_download: boolean | null
          created_at: string | null
          enterprise_id: string
          expires_at: string | null
          id: string
          investor_email: string | null
          investor_name: string | null
          viewed_at: string | null
        }
        Insert: {
          access_token?: string | null
          can_download?: boolean | null
          created_at?: string | null
          enterprise_id: string
          expires_at?: string | null
          id?: string
          investor_email?: string | null
          investor_name?: string | null
          viewed_at?: string | null
        }
        Update: {
          access_token?: string | null
          can_download?: boolean | null
          created_at?: string | null
          enterprise_id?: string
          expires_at?: string | null
          id?: string
          investor_email?: string | null
          investor_name?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_room_shares_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverables: {
        Row: {
          ai_generated: boolean | null
          coach_id: string | null
          created_at: string
          data: Json | null
          enterprise_id: string
          file_url: string | null
          generated_by: string | null
          html_content: string | null
          id: string
          score: number | null
          shared_at: string | null
          type: Database["public"]["Enums"]["deliverable_type"]
          updated_at: string
          version: number
          visibility: string | null
        }
        Insert: {
          ai_generated?: boolean | null
          coach_id?: string | null
          created_at?: string
          data?: Json | null
          enterprise_id: string
          file_url?: string | null
          generated_by?: string | null
          html_content?: string | null
          id?: string
          score?: number | null
          shared_at?: string | null
          type: Database["public"]["Enums"]["deliverable_type"]
          updated_at?: string
          version?: number
          visibility?: string | null
        }
        Update: {
          ai_generated?: boolean | null
          coach_id?: string | null
          created_at?: string
          data?: Json | null
          enterprise_id?: string
          file_url?: string | null
          generated_by?: string | null
          html_content?: string | null
          id?: string
          score?: number | null
          shared_at?: string | null
          type?: Database["public"]["Enums"]["deliverable_type"]
          updated_at?: string
          version?: number
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliverables_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_modules: {
        Row: {
          created_at: string
          data: Json | null
          enterprise_id: string
          id: string
          module: Database["public"]["Enums"]["module_code"]
          progress: number | null
          status: Database["public"]["Enums"]["module_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          enterprise_id: string
          id?: string
          module: Database["public"]["Enums"]["module_code"]
          progress?: number | null
          status?: Database["public"]["Enums"]["module_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          enterprise_id?: string
          id?: string
          module?: Database["public"]["Enums"]["module_code"]
          progress?: number | null
          status?: Database["public"]["Enums"]["module_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_modules_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprises: {
        Row: {
          city: string | null
          coach_id: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          creation_date: string | null
          data_room_enabled: boolean | null
          data_room_slug: string | null
          description: string | null
          employees_count: number | null
          id: string
          last_activity: string | null
          legal_form: string | null
          logo_url: string | null
          name: string
          operating_mode: Database["public"]["Enums"]["operating_mode"] | null
          phase: string | null
          score_ir: number | null
          sector: string | null
          updated_at: string
          uploaded_files: Json | null
          user_id: string
        }
        Insert: {
          city?: string | null
          coach_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          creation_date?: string | null
          data_room_enabled?: boolean | null
          data_room_slug?: string | null
          description?: string | null
          employees_count?: number | null
          id?: string
          last_activity?: string | null
          legal_form?: string | null
          logo_url?: string | null
          name: string
          operating_mode?: Database["public"]["Enums"]["operating_mode"] | null
          phase?: string | null
          score_ir?: number | null
          sector?: string | null
          updated_at?: string
          uploaded_files?: Json | null
          user_id: string
        }
        Update: {
          city?: string | null
          coach_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          creation_date?: string | null
          data_room_enabled?: boolean | null
          data_room_slug?: string | null
          description?: string | null
          employees_count?: number | null
          id?: string
          last_activity?: string | null
          legal_form?: string | null
          logo_url?: string | null
          name?: string
          operating_mode?: Database["public"]["Enums"]["operating_mode"] | null
          phase?: string | null
          score_ir?: number | null
          sector?: string | null
          updated_at?: string
          uploaded_files?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      knowledge_base: {
        Row: {
          category: string
          content: string
          country: string | null
          created_at: string
          id: string
          metadata: Json | null
          sector: string | null
          source: string | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          content: string
          country?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          sector?: string | null
          source?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          country?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          sector?: string | null
          source?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      programme_criteria: {
        Row: {
          country_filter: string[] | null
          created_at: string | null
          created_by: string
          custom_criteria: Json | null
          description: string | null
          id: string
          is_active: boolean | null
          max_debt_ratio: number | null
          max_score_ir: number | null
          min_margin: number | null
          min_revenue: number | null
          min_score_ir: number | null
          name: string
          required_deliverables: string[] | null
          sector_filter: string[] | null
          updated_at: string | null
        }
        Insert: {
          country_filter?: string[] | null
          created_at?: string | null
          created_by: string
          custom_criteria?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_debt_ratio?: number | null
          max_score_ir?: number | null
          min_margin?: number | null
          min_revenue?: number | null
          min_score_ir?: number | null
          name: string
          required_deliverables?: string[] | null
          sector_filter?: string[] | null
          updated_at?: string | null
        }
        Update: {
          country_filter?: string[] | null
          created_at?: string | null
          created_by?: string
          custom_criteria?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_debt_ratio?: number | null
          max_score_ir?: number | null
          min_margin?: number | null
          min_revenue?: number | null
          min_score_ir?: number | null
          name?: string
          required_deliverables?: string[] | null
          sector_filter?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      score_history: {
        Row: {
          created_at: string
          enterprise_id: string
          id: string
          score: number
          scores_detail: Json | null
        }
        Insert: {
          created_at?: string
          enterprise_id: string
          id?: string
          score: number
          scores_detail?: Json | null
        }
        Update: {
          created_at?: string
          enterprise_id?: string
          id?: string
          score?: number
          scores_detail?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "score_history_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      link_enterprise_to_coach_by_email: {
        Args: { enterprise_email: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "coach" | "entrepreneur" | "super_admin"
      deliverable_type:
        | "bmc_analysis"
        | "bmc_html"
        | "sic_analysis"
        | "sic_html"
        | "inputs_data"
        | "inputs_html"
        | "framework_data"
        | "framework_html"
        | "framework_excel"
        | "diagnostic_data"
        | "diagnostic_html"
        | "diagnostic_analyses"
        | "plan_ovo"
        | "business_plan"
        | "odd_analysis"
        | "plan_ovo_excel"
        | "odd_excel"
        | "screening_report"
        | "pre_screening"
        | "valuation"
        | "onepager"
        | "pitch_deck"
        | "investment_memo"
      module_code:
        | "bmc"
        | "sic"
        | "inputs"
        | "framework"
        | "diagnostic"
        | "plan_ovo"
        | "business_plan"
        | "odd"
        | "valuation"
        | "onepager"
        | "pitch_deck"
        | "investment_memo"
      module_status: "not_started" | "in_progress" | "completed"
      operating_mode: "reconstruction" | "due_diligence"
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
    Enums: {
      app_role: ["coach", "entrepreneur", "super_admin"],
      deliverable_type: [
        "bmc_analysis",
        "bmc_html",
        "sic_analysis",
        "sic_html",
        "inputs_data",
        "inputs_html",
        "framework_data",
        "framework_html",
        "framework_excel",
        "diagnostic_data",
        "diagnostic_html",
        "diagnostic_analyses",
        "plan_ovo",
        "business_plan",
        "odd_analysis",
        "plan_ovo_excel",
        "odd_excel",
        "screening_report",
        "pre_screening",
        "valuation",
        "onepager",
        "pitch_deck",
        "investment_memo",
      ],
      module_code: [
        "bmc",
        "sic",
        "inputs",
        "framework",
        "diagnostic",
        "plan_ovo",
        "business_plan",
        "odd",
        "valuation",
        "onepager",
        "pitch_deck",
        "investment_memo",
      ],
      module_status: ["not_started", "in_progress", "completed"],
      operating_mode: ["reconstruction", "due_diligence"],
    },
  },
} as const
