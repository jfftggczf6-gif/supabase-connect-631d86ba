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
      deliverables: {
        Row: {
          ai_generated: boolean | null
          created_at: string
          data: Json | null
          enterprise_id: string
          file_url: string | null
          html_content: string | null
          id: string
          score: number | null
          type: Database["public"]["Enums"]["deliverable_type"]
          updated_at: string
          version: number
        }
        Insert: {
          ai_generated?: boolean | null
          created_at?: string
          data?: Json | null
          enterprise_id: string
          file_url?: string | null
          html_content?: string | null
          id?: string
          score?: number | null
          type: Database["public"]["Enums"]["deliverable_type"]
          updated_at?: string
          version?: number
        }
        Update: {
          ai_generated?: boolean | null
          created_at?: string
          data?: Json | null
          enterprise_id?: string
          file_url?: string | null
          html_content?: string | null
          id?: string
          score?: number | null
          type?: Database["public"]["Enums"]["deliverable_type"]
          updated_at?: string
          version?: number
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
          country: string | null
          created_at: string
          creation_date: string | null
          description: string | null
          employees_count: number | null
          id: string
          legal_form: string | null
          logo_url: string | null
          name: string
          sector: string | null
          updated_at: string
          uploaded_files: Json | null
          user_id: string
        }
        Insert: {
          city?: string | null
          coach_id?: string | null
          country?: string | null
          created_at?: string
          creation_date?: string | null
          description?: string | null
          employees_count?: number | null
          id?: string
          legal_form?: string | null
          logo_url?: string | null
          name: string
          sector?: string | null
          updated_at?: string
          uploaded_files?: Json | null
          user_id: string
        }
        Update: {
          city?: string | null
          coach_id?: string | null
          country?: string | null
          created_at?: string
          creation_date?: string | null
          description?: string | null
          employees_count?: number | null
          id?: string
          legal_form?: string | null
          logo_url?: string | null
          name?: string
          sector?: string | null
          updated_at?: string
          uploaded_files?: Json | null
          user_id?: string
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
    }
    Enums: {
      app_role: "coach" | "entrepreneur"
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
      module_code:
        | "bmc"
        | "sic"
        | "inputs"
        | "framework"
        | "diagnostic"
        | "plan_ovo"
        | "business_plan"
        | "odd"
      module_status: "not_started" | "in_progress" | "completed"
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
      app_role: ["coach", "entrepreneur"],
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
      ],
      module_status: ["not_started", "in_progress", "completed"],
    },
  },
} as const
