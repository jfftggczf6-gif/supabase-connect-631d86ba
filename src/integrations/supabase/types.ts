export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          created_at: string | null
          deliverable_type: string | null
          enterprise_id: string
          id: string
          metadata: Json | null
          organization_id: string
          resource_id: string | null
          resource_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string | null
          deliverable_type?: string | null
          enterprise_id: string
          id?: string
          metadata?: Json | null
          organization_id: string
          resource_id?: string | null
          resource_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string | null
          deliverable_type?: string | null
          enterprise_id?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
          resource_id?: string | null
          resource_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      aggregated_benchmarks: {
        Row: {
          ca_mediane: number | null
          derniere_agregation: string | null
          effectifs_mediane: number | null
          id: string
          marge_brute_mediane: number | null
          marge_brute_p25: number | null
          marge_brute_p75: number | null
          marge_ebitda_mediane: number | null
          nb_entreprises: number | null
          organization_id: string
          pays: string
          secteur: string
        }
        Insert: {
          ca_mediane?: number | null
          derniere_agregation?: string | null
          effectifs_mediane?: number | null
          id?: string
          marge_brute_mediane?: number | null
          marge_brute_p25?: number | null
          marge_brute_p75?: number | null
          marge_ebitda_mediane?: number | null
          nb_entreprises?: number | null
          organization_id: string
          pays: string
          secteur: string
        }
        Update: {
          ca_mediane?: number | null
          derniere_agregation?: string | null
          effectifs_mediane?: number | null
          id?: string
          marge_brute_mediane?: number | null
          marge_brute_p25?: number | null
          marge_brute_p75?: number | null
          marge_ebitda_mediane?: number | null
          nb_entreprises?: number | null
          organization_id?: string
          pays?: string
          secteur?: string
        }
        Relationships: [
          {
            foreignKeyName: "aggregated_benchmarks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_cost_log: {
        Row: {
          cost_usd: number | null
          created_at: string | null
          duration_ms: number | null
          enterprise_id: string | null
          function_name: string
          id: string
          input_tokens: number | null
          model: string
          organization_id: string
          output_tokens: number | null
        }
        Insert: {
          cost_usd?: number | null
          created_at?: string | null
          duration_ms?: number | null
          enterprise_id?: string | null
          function_name: string
          id?: string
          input_tokens?: number | null
          model: string
          organization_id: string
          output_tokens?: number | null
        }
        Update: {
          cost_usd?: number | null
          created_at?: string | null
          duration_ms?: number | null
          enterprise_id?: string | null
          function_name?: string
          id?: string
          input_tokens?: number | null
          model?: string
          organization_id?: string
          output_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_cost_log_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_cost_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_team_members: {
        Row: {
          joined_at: string | null
          role_in_team: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string | null
          role_in_team?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          joined_at?: string | null
          role_in_team?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "bank_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_teams: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          lead_user_id: string
          name: string
          organization_id: string
          parent_team_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          lead_user_id: string
          name: string
          organization_id: string
          parent_team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          lead_user_id?: string
          name?: string
          organization_id?: string
          parent_team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_teams_parent_team_id_fkey"
            columns: ["parent_team_id"]
            isOneToOne: false
            referencedRelation: "bank_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      candidatures: {
        Row: {
          assigned_coach_id: string | null
          committee_date: string | null
          committee_decision: string | null
          committee_notes: string | null
          company_name: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          documents: Json | null
          enterprise_id: string | null
          form_data: Json | null
          id: string
          organization_id: string
          programme_id: string
          screening_data: Json | null
          screening_date: string | null
          screening_score: number | null
          status: string
          submitted_at: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_coach_id?: string | null
          committee_date?: string | null
          committee_decision?: string | null
          committee_notes?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          documents?: Json | null
          enterprise_id?: string | null
          form_data?: Json | null
          id?: string
          organization_id: string
          programme_id: string
          screening_data?: Json | null
          screening_date?: string | null
          screening_score?: number | null
          status?: string
          submitted_at?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_coach_id?: string | null
          committee_date?: string | null
          committee_decision?: string | null
          committee_notes?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          documents?: Json | null
          enterprise_id?: string | null
          form_data?: Json | null
          id?: string
          organization_id?: string
          programme_id?: string
          screening_data?: Json | null
          screening_date?: string | null
          screening_score?: number | null
          status?: string
          submitted_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidatures_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidatures_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidatures_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_uploads: {
        Row: {
          category: string
          coach_id: string
          created_at: string
          enterprise_id: string
          file_size: number | null
          filename: string
          id: string
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
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
          {
            foreignKeyName: "coach_uploads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_notes: {
        Row: {
          coach_id: string
          corrections_applied: Json | null
          created_at: string | null
          date_rdv: string | null
          enterprise_id: string
          file_name: string | null
          file_path: string | null
          id: string
          infos_extraites: Json | null
          input_type: string
          organization_id: string
          raw_content: string | null
          resume_ia: string | null
          titre: string | null
          visible_chef_programme: boolean | null
        }
        Insert: {
          coach_id: string
          corrections_applied?: Json | null
          created_at?: string | null
          date_rdv?: string | null
          enterprise_id: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          infos_extraites?: Json | null
          input_type?: string
          organization_id: string
          raw_content?: string | null
          resume_ia?: string | null
          titre?: string | null
          visible_chef_programme?: boolean | null
        }
        Update: {
          coach_id?: string
          corrections_applied?: Json | null
          created_at?: string | null
          date_rdv?: string | null
          enterprise_id?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          infos_extraites?: Json | null
          input_type?: string
          organization_id?: string
          raw_content?: string | null
          resume_ia?: string | null
          titre?: string | null
          visible_chef_programme?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "coaching_notes_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_dossiers: {
        Row: {
          analyste_id: string | null
          classification_diagnostic: string | null
          classification_monitoring: string | null
          conseiller_id: string | null
          created_at: string | null
          date_decaissement: string | null
          devise: string | null
          duree_mois: number | null
          encours_actuel: number | null
          enterprise_id: string
          funding_line_id: string | null
          id: string
          metadata: Json | null
          montant_decaisse: number | null
          montant_demande: number | null
          numero: string | null
          organization_id: string
          pipeline_status: string
          produit_retenu_code: string | null
          retard_jours: number | null
          type_credit: string | null
          updated_at: string | null
        }
        Insert: {
          analyste_id?: string | null
          classification_diagnostic?: string | null
          classification_monitoring?: string | null
          conseiller_id?: string | null
          created_at?: string | null
          date_decaissement?: string | null
          devise?: string | null
          duree_mois?: number | null
          encours_actuel?: number | null
          enterprise_id: string
          funding_line_id?: string | null
          id?: string
          metadata?: Json | null
          montant_decaisse?: number | null
          montant_demande?: number | null
          numero?: string | null
          organization_id: string
          pipeline_status?: string
          produit_retenu_code?: string | null
          retard_jours?: number | null
          type_credit?: string | null
          updated_at?: string | null
        }
        Update: {
          analyste_id?: string | null
          classification_diagnostic?: string | null
          classification_monitoring?: string | null
          conseiller_id?: string | null
          created_at?: string | null
          date_decaissement?: string | null
          devise?: string | null
          duree_mois?: number | null
          encours_actuel?: number | null
          enterprise_id?: string
          funding_line_id?: string | null
          id?: string
          metadata?: Json | null
          montant_decaisse?: number | null
          montant_demande?: number | null
          numero?: string | null
          organization_id?: string
          pipeline_status?: string
          produit_retenu_code?: string | null
          retard_jours?: number | null
          type_credit?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_dossiers_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_dossiers_funding_line_id_fkey"
            columns: ["funding_line_id"]
            isOneToOne: false
            referencedRelation: "funding_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_dossiers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
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
          {
            foreignKeyName: "data_room_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
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
          {
            foreignKeyName: "data_room_shares_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverable_corrections: {
        Row: {
          corrected_by: string
          corrected_value: Json | null
          correction_reason: string | null
          created_at: string | null
          deliverable_id: string
          deliverable_type: string
          enterprise_id: string
          field_path: string
          id: string
          organization_id: string
          original_value: Json | null
        }
        Insert: {
          corrected_by: string
          corrected_value?: Json | null
          correction_reason?: string | null
          created_at?: string | null
          deliverable_id: string
          deliverable_type: string
          enterprise_id: string
          field_path: string
          id?: string
          organization_id: string
          original_value?: Json | null
        }
        Update: {
          corrected_by?: string
          corrected_value?: Json | null
          correction_reason?: string | null
          created_at?: string | null
          deliverable_id?: string
          deliverable_type?: string
          enterprise_id?: string
          field_path?: string
          id?: string
          organization_id?: string
          original_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "deliverable_corrections_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "deliverables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverable_corrections_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverable_corrections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverable_versions: {
        Row: {
          created_at: string | null
          data: Json
          deliverable_id: string
          enterprise_id: string
          generated_by: string | null
          id: string
          organization_id: string
          score: number | null
          trigger_reason: string | null
          type: string
          validation_report: Json | null
          version: number
        }
        Insert: {
          created_at?: string | null
          data: Json
          deliverable_id: string
          enterprise_id: string
          generated_by?: string | null
          id?: string
          organization_id: string
          score?: number | null
          trigger_reason?: string | null
          type: string
          validation_report?: Json | null
          version: number
        }
        Update: {
          created_at?: string | null
          data?: Json
          deliverable_id?: string
          enterprise_id?: string
          generated_by?: string | null
          id?: string
          organization_id?: string
          score?: number | null
          trigger_reason?: string | null
          type?: string
          validation_report?: Json | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "deliverable_versions_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "deliverables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverable_versions_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverable_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
          review_comment: string | null
          review_history: Json | null
          score: number | null
          shared_at: string | null
          submitted_at: string | null
          submitted_by: string | null
          type: Database["public"]["Enums"]["deliverable_type"]
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validation_status: string | null
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
          organization_id: string
          review_comment?: string | null
          review_history?: Json | null
          score?: number | null
          shared_at?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          type: Database["public"]["Enums"]["deliverable_type"]
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: string | null
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
          organization_id?: string
          review_comment?: string | null
          review_history?: Json | null
          score?: number | null
          shared_at?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          type?: Database["public"]["Enums"]["deliverable_type"]
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: string | null
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
          {
            foreignKeyName: "deliverables_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_coach_invitations: {
        Row: {
          assigned_by: string | null
          created_at: string
          enterprise_id: string
          id: string
          invitation_id: string
          organization_id: string
          role: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          enterprise_id: string
          id?: string
          invitation_id: string
          organization_id: string
          role?: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          enterprise_id?: string
          id?: string
          invitation_id?: string
          organization_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_coach_invitations_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_coach_invitations_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "organization_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_coach_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_coaches: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          coach_id: string
          enterprise_id: string
          id: string
          is_active: boolean | null
          notes: string | null
          organization_id: string
          role: string | null
          unassigned_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          coach_id: string
          enterprise_id: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          organization_id: string
          role?: string | null
          unassigned_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          coach_id?: string
          enterprise_id?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          organization_id?: string
          role?: string | null
          unassigned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_coaches_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_coaches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
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
          {
            foreignKeyName: "enterprise_modules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprises: {
        Row: {
          banque_metadata: Json | null
          base_year: number | null
          city: string | null
          coach_id: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          creation_date: string | null
          data_changed_at: string | null
          data_room_enabled: boolean | null
          data_room_slug: string | null
          description: string | null
          document_content: string | null
          document_content_updated_at: string | null
          document_files_count: number | null
          document_parsing_report: Json | null
          employees_count: number | null
          id: string
          last_activity: string | null
          legal_form: string | null
          logo_url: string | null
          name: string
          operating_mode: Database["public"]["Enums"]["operating_mode"] | null
          organization_id: string
          phase: string | null
          score_ir: number | null
          sector: string | null
          source_acquisition: string | null
          updated_at: string
          uploaded_files: Json | null
          user_id: string
        }
        Insert: {
          banque_metadata?: Json | null
          base_year?: number | null
          city?: string | null
          coach_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          creation_date?: string | null
          data_changed_at?: string | null
          data_room_enabled?: boolean | null
          data_room_slug?: string | null
          description?: string | null
          document_content?: string | null
          document_content_updated_at?: string | null
          document_files_count?: number | null
          document_parsing_report?: Json | null
          employees_count?: number | null
          id?: string
          last_activity?: string | null
          legal_form?: string | null
          logo_url?: string | null
          name: string
          operating_mode?: Database["public"]["Enums"]["operating_mode"] | null
          organization_id: string
          phase?: string | null
          score_ir?: number | null
          sector?: string | null
          source_acquisition?: string | null
          updated_at?: string
          uploaded_files?: Json | null
          user_id: string
        }
        Update: {
          banque_metadata?: Json | null
          base_year?: number | null
          city?: string | null
          coach_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          creation_date?: string | null
          data_changed_at?: string | null
          data_room_enabled?: boolean | null
          data_room_slug?: string | null
          description?: string | null
          document_content?: string | null
          document_content_updated_at?: string | null
          document_files_count?: number | null
          document_parsing_report?: Json | null
          employees_count?: number | null
          id?: string
          last_activity?: string | null
          legal_form?: string | null
          logo_url?: string | null
          name?: string
          operating_mode?: Database["public"]["Enums"]["operating_mode"] | null
          organization_id?: string
          phase?: string | null
          score_ir?: number | null
          sector?: string | null
          source_acquisition?: string | null
          updated_at?: string
          uploaded_files?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprises_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      funding_lines: {
        Row: {
          bailleur: string | null
          capacite_totale: number | null
          code: string
          created_at: string | null
          criteres_eligibilite: Json | null
          devise: string | null
          id: string
          is_active: boolean | null
          kpi_a_reporter: string[] | null
          label: string
          metadata: Json | null
          montant_deploye: number | null
          organization_id: string
          taux_partage_risque: number | null
          taux_preferentiel: number | null
          type: string
          updated_at: string | null
        }
        Insert: {
          bailleur?: string | null
          capacite_totale?: number | null
          code: string
          created_at?: string | null
          criteres_eligibilite?: Json | null
          devise?: string | null
          id?: string
          is_active?: boolean | null
          kpi_a_reporter?: string[] | null
          label: string
          metadata?: Json | null
          montant_deploye?: number | null
          organization_id: string
          taux_partage_risque?: number | null
          taux_preferentiel?: number | null
          type: string
          updated_at?: string | null
        }
        Update: {
          bailleur?: string | null
          capacite_totale?: number | null
          code?: string
          created_at?: string | null
          criteres_eligibilite?: Json | null
          devise?: string | null
          id?: string
          is_active?: boolean | null
          kpi_a_reporter?: string[] | null
          label?: string
          metadata?: Json | null
          montant_deploye?: number | null
          organization_id?: string
          taux_partage_risque?: number | null
          taux_preferentiel?: number | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funding_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      funding_matches: {
        Row: {
          computed_at: string | null
          criteria_met: string[] | null
          criteria_missing: string[] | null
          enterprise_id: string | null
          funding_program_id: string | null
          gap_analysis: Json | null
          id: string
          match_score: number | null
          organization_id: string
        }
        Insert: {
          computed_at?: string | null
          criteria_met?: string[] | null
          criteria_missing?: string[] | null
          enterprise_id?: string | null
          funding_program_id?: string | null
          gap_analysis?: Json | null
          id?: string
          match_score?: number | null
          organization_id: string
        }
        Update: {
          computed_at?: string | null
          criteria_met?: string[] | null
          criteria_missing?: string[] | null
          enterprise_id?: string | null
          funding_program_id?: string | null
          gap_analysis?: Json | null
          id?: string
          match_score?: number | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funding_matches_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_matches_funding_program_id_fkey"
            columns: ["funding_program_id"]
            isOneToOne: false
            referencedRelation: "funding_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      funding_programs: {
        Row: {
          ca_max: number | null
          ca_min: number | null
          conformite_ifc: boolean | null
          contact_email: string | null
          created_at: string | null
          date_limite: string | null
          description: string | null
          devise: string | null
          ebitda_positif: boolean | null
          effectif_max: number | null
          effectif_min: number | null
          etats_financiers_certifies: boolean | null
          forme_juridique_requise: string[] | null
          historique_min_ans: number | null
          id: string
          impact_environnemental_requis: boolean | null
          impact_social_requis: boolean | null
          is_active: boolean | null
          marge_brute_min: number | null
          name: string
          notes: string | null
          odd_requis: string[] | null
          organisme: string
          organization_id: string | null
          pays_eligibles: string[] | null
          phase_entreprise: string[] | null
          resultat_net_positif: boolean | null
          score_ir_min: number | null
          secteurs_eligibles: string[] | null
          site_web: string | null
          ticket_max: number | null
          ticket_min: number | null
          type_financement: string[] | null
          updated_at: string | null
        }
        Insert: {
          ca_max?: number | null
          ca_min?: number | null
          conformite_ifc?: boolean | null
          contact_email?: string | null
          created_at?: string | null
          date_limite?: string | null
          description?: string | null
          devise?: string | null
          ebitda_positif?: boolean | null
          effectif_max?: number | null
          effectif_min?: number | null
          etats_financiers_certifies?: boolean | null
          forme_juridique_requise?: string[] | null
          historique_min_ans?: number | null
          id?: string
          impact_environnemental_requis?: boolean | null
          impact_social_requis?: boolean | null
          is_active?: boolean | null
          marge_brute_min?: number | null
          name: string
          notes?: string | null
          odd_requis?: string[] | null
          organisme: string
          organization_id?: string | null
          pays_eligibles?: string[] | null
          phase_entreprise?: string[] | null
          resultat_net_positif?: boolean | null
          score_ir_min?: number | null
          secteurs_eligibles?: string[] | null
          site_web?: string | null
          ticket_max?: number | null
          ticket_min?: number | null
          type_financement?: string[] | null
          updated_at?: string | null
        }
        Update: {
          ca_max?: number | null
          ca_min?: number | null
          conformite_ifc?: boolean | null
          contact_email?: string | null
          created_at?: string | null
          date_limite?: string | null
          description?: string | null
          devise?: string | null
          ebitda_positif?: boolean | null
          effectif_max?: number | null
          effectif_min?: number | null
          etats_financiers_certifies?: boolean | null
          forme_juridique_requise?: string[] | null
          historique_min_ans?: number | null
          id?: string
          impact_environnemental_requis?: boolean | null
          impact_social_requis?: boolean | null
          is_active?: boolean | null
          marge_brute_min?: number | null
          name?: string
          notes?: string | null
          odd_requis?: string[] | null
          organisme?: string
          organization_id?: string | null
          pays_eligibles?: string[] | null
          phase_entreprise?: string[] | null
          resultat_net_positif?: boolean | null
          score_ir_min?: number | null
          secteurs_eligibles?: string[] | null
          site_web?: string | null
          ticket_max?: number | null
          ticket_min?: number | null
          type_financement?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funding_programs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inputs_history: {
        Row: {
          created_at: string | null
          data: Json
          diff: Json | null
          documents_added: string[] | null
          enterprise_id: string
          id: string
          organization_id: string
          score: number | null
          trigger: string
        }
        Insert: {
          created_at?: string | null
          data: Json
          diff?: Json | null
          documents_added?: string[] | null
          enterprise_id: string
          id?: string
          organization_id: string
          score?: number | null
          trigger: string
        }
        Update: {
          created_at?: string | null
          data?: Json
          diff?: Json | null
          documents_added?: string[] | null
          enterprise_id?: string
          id?: string
          organization_id?: string
          score?: number | null
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "inputs_history_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inputs_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_memos: {
        Row: {
          created_at: string
          created_by: string | null
          deal_id: string
          id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deal_id: string
          id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deal_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_memos_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "pe_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          auto_refresh: boolean | null
          category: string
          content: string
          country: string | null
          created_at: string
          embedding: string | null
          expires_at: string | null
          id: string
          last_refreshed_at: string | null
          metadata: Json | null
          refresh_source: string | null
          sector: string | null
          source: string | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          auto_refresh?: boolean | null
          category: string
          content: string
          country?: string | null
          created_at?: string
          embedding?: string | null
          expires_at?: string | null
          id?: string
          last_refreshed_at?: string | null
          metadata?: Json | null
          refresh_source?: string | null
          sector?: string | null
          source?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          auto_refresh?: boolean | null
          category?: string
          content?: string
          country?: string | null
          created_at?: string
          embedding?: string | null
          expires_at?: string | null
          id?: string
          last_refreshed_at?: string | null
          metadata?: Json | null
          refresh_source?: string | null
          sector?: string | null
          source?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      knowledge_benchmarks: {
        Row: {
          bfr_typique: Json | null
          capex_typiques: Json | null
          croissance_ca_max: number | null
          date_mise_a_jour: string | null
          date_source: string | null
          duree_amort_specifique: Json | null
          id: string
          marge_brute_max: number | null
          marge_brute_mediane: number | null
          marge_brute_min: number | null
          marge_ebitda_max: number | null
          marge_ebitda_min: number | null
          marge_nette_max: number | null
          marge_nette_min: number | null
          multiple_ca_max: number | null
          multiple_ca_min: number | null
          multiple_ebitda_max: number | null
          multiple_ebitda_min: number | null
          notes: string | null
          opex_structure: Json | null
          pays: string
          perimetre: string | null
          ratio_charges_fixes_ca_max: number | null
          ratio_charges_fixes_ca_min: number | null
          ratio_personnel_ca_max: number | null
          ratio_personnel_ca_min: number | null
          secteur: string
          seuil_alerte: Json | null
          source: string
          source_type: string | null
          source_url: string | null
          zone: string | null
        }
        Insert: {
          bfr_typique?: Json | null
          capex_typiques?: Json | null
          croissance_ca_max?: number | null
          date_mise_a_jour?: string | null
          date_source?: string | null
          duree_amort_specifique?: Json | null
          id?: string
          marge_brute_max?: number | null
          marge_brute_mediane?: number | null
          marge_brute_min?: number | null
          marge_ebitda_max?: number | null
          marge_ebitda_min?: number | null
          marge_nette_max?: number | null
          marge_nette_min?: number | null
          multiple_ca_max?: number | null
          multiple_ca_min?: number | null
          multiple_ebitda_max?: number | null
          multiple_ebitda_min?: number | null
          notes?: string | null
          opex_structure?: Json | null
          pays?: string
          perimetre?: string | null
          ratio_charges_fixes_ca_max?: number | null
          ratio_charges_fixes_ca_min?: number | null
          ratio_personnel_ca_max?: number | null
          ratio_personnel_ca_min?: number | null
          secteur: string
          seuil_alerte?: Json | null
          source: string
          source_type?: string | null
          source_url?: string | null
          zone?: string | null
        }
        Update: {
          bfr_typique?: Json | null
          capex_typiques?: Json | null
          croissance_ca_max?: number | null
          date_mise_a_jour?: string | null
          date_source?: string | null
          duree_amort_specifique?: Json | null
          id?: string
          marge_brute_max?: number | null
          marge_brute_mediane?: number | null
          marge_brute_min?: number | null
          marge_ebitda_max?: number | null
          marge_ebitda_min?: number | null
          marge_nette_max?: number | null
          marge_nette_min?: number | null
          multiple_ca_max?: number | null
          multiple_ca_min?: number | null
          multiple_ebitda_max?: number | null
          multiple_ebitda_min?: number | null
          notes?: string | null
          opex_structure?: Json | null
          pays?: string
          perimetre?: string | null
          ratio_charges_fixes_ca_max?: number | null
          ratio_charges_fixes_ca_min?: number | null
          ratio_personnel_ca_max?: number | null
          ratio_personnel_ca_min?: number | null
          secteur?: string
          seuil_alerte?: Json | null
          source?: string
          source_type?: string | null
          source_url?: string | null
          zone?: string | null
        }
        Relationships: []
      }
      knowledge_chunks: {
        Row: {
          category: string | null
          chunk_index: number
          content: string
          country: string | null
          created_at: string | null
          embedding: string | null
          id: string
          kb_entry_id: string | null
          org_entry_id: string | null
          publication_date: string | null
          sector: string | null
          source: string | null
          source_url: string | null
          title: string | null
          token_count: number | null
        }
        Insert: {
          category?: string | null
          chunk_index: number
          content: string
          country?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          kb_entry_id?: string | null
          org_entry_id?: string | null
          publication_date?: string | null
          sector?: string | null
          source?: string | null
          source_url?: string | null
          title?: string | null
          token_count?: number | null
        }
        Update: {
          category?: string | null
          chunk_index?: number
          content?: string
          country?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          kb_entry_id?: string | null
          org_entry_id?: string | null
          publication_date?: string | null
          sector?: string | null
          source?: string | null
          source_url?: string | null
          title?: string | null
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_kb_entry_id_fkey"
            columns: ["kb_entry_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_chunks_org_entry_id_fkey"
            columns: ["org_entry_id"]
            isOneToOne: false
            referencedRelation: "organization_knowledge"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_country_data: {
        Row: {
          acces_credit_pme_pct: number | null
          cadre_comptable: string | null
          charges_patronales_pct: number | null
          charges_salariales_pct: number | null
          charges_sociales_detail: Json | null
          contribution_fonciere_pct: number | null
          corruption_index: number | null
          cotisations_sociales_pct: number | null
          croissance_pib_pct: number | null
          date_mise_a_jour: string | null
          devise: string | null
          duree_amort_equipement_agri_ans: number | null
          duree_amort_immeubles_ans: number | null
          duree_amort_informatique_ans: number | null
          duree_amort_materiel_ans: number | null
          duree_amort_mobilier_ans: number | null
          duree_amort_vehicules_ans: number | null
          fiscalite_detail: Json | null
          id: string
          inflation_pct: number | null
          is_pme: number | null
          opex_benchmarks: Json | null
          patente_taux: string | null
          pays: string
          pib_usd_millions: number | null
          population_millions: number | null
          regime_fiscal_notes: string | null
          risque_politique: string | null
          salaire_dirigeant_pme_max: number | null
          salaire_dirigeant_pme_min: number | null
          salaire_minimum: number | null
          seuil_is_pme: string | null
          source: string | null
          taux_change_eur: number | null
          taux_change_usd: number | null
          taux_directeur: number | null
          taux_emprunt_pme: number | null
          taux_is: number | null
          taux_tva: number | null
          taux_usure: number | null
          taxe_apprentissage_pct: number | null
          zone_monetaire: string | null
        }
        Insert: {
          acces_credit_pme_pct?: number | null
          cadre_comptable?: string | null
          charges_patronales_pct?: number | null
          charges_salariales_pct?: number | null
          charges_sociales_detail?: Json | null
          contribution_fonciere_pct?: number | null
          corruption_index?: number | null
          cotisations_sociales_pct?: number | null
          croissance_pib_pct?: number | null
          date_mise_a_jour?: string | null
          devise?: string | null
          duree_amort_equipement_agri_ans?: number | null
          duree_amort_immeubles_ans?: number | null
          duree_amort_informatique_ans?: number | null
          duree_amort_materiel_ans?: number | null
          duree_amort_mobilier_ans?: number | null
          duree_amort_vehicules_ans?: number | null
          fiscalite_detail?: Json | null
          id?: string
          inflation_pct?: number | null
          is_pme?: number | null
          opex_benchmarks?: Json | null
          patente_taux?: string | null
          pays: string
          pib_usd_millions?: number | null
          population_millions?: number | null
          regime_fiscal_notes?: string | null
          risque_politique?: string | null
          salaire_dirigeant_pme_max?: number | null
          salaire_dirigeant_pme_min?: number | null
          salaire_minimum?: number | null
          seuil_is_pme?: string | null
          source?: string | null
          taux_change_eur?: number | null
          taux_change_usd?: number | null
          taux_directeur?: number | null
          taux_emprunt_pme?: number | null
          taux_is?: number | null
          taux_tva?: number | null
          taux_usure?: number | null
          taxe_apprentissage_pct?: number | null
          zone_monetaire?: string | null
        }
        Update: {
          acces_credit_pme_pct?: number | null
          cadre_comptable?: string | null
          charges_patronales_pct?: number | null
          charges_salariales_pct?: number | null
          charges_sociales_detail?: Json | null
          contribution_fonciere_pct?: number | null
          corruption_index?: number | null
          cotisations_sociales_pct?: number | null
          croissance_pib_pct?: number | null
          date_mise_a_jour?: string | null
          devise?: string | null
          duree_amort_equipement_agri_ans?: number | null
          duree_amort_immeubles_ans?: number | null
          duree_amort_informatique_ans?: number | null
          duree_amort_materiel_ans?: number | null
          duree_amort_mobilier_ans?: number | null
          duree_amort_vehicules_ans?: number | null
          fiscalite_detail?: Json | null
          id?: string
          inflation_pct?: number | null
          is_pme?: number | null
          opex_benchmarks?: Json | null
          patente_taux?: string | null
          pays?: string
          pib_usd_millions?: number | null
          population_millions?: number | null
          regime_fiscal_notes?: string | null
          risque_politique?: string | null
          salaire_dirigeant_pme_max?: number | null
          salaire_dirigeant_pme_min?: number | null
          salaire_minimum?: number | null
          seuil_is_pme?: string | null
          source?: string | null
          taux_change_eur?: number | null
          taux_change_usd?: number | null
          taux_directeur?: number | null
          taux_emprunt_pme?: number | null
          taux_is?: number | null
          taux_tva?: number | null
          taux_usure?: number | null
          taxe_apprentissage_pct?: number | null
          zone_monetaire?: string | null
        }
        Relationships: []
      }
      knowledge_risk_factors: {
        Row: {
          categorie: string
          code: string
          correction: string | null
          description: string
          id: string
          is_active: boolean | null
          pays_concernes: string[] | null
          secteurs_concernes: string[] | null
          severity: string | null
          signaux: Json
          source: string | null
          titre: string
        }
        Insert: {
          categorie: string
          code: string
          correction?: string | null
          description: string
          id?: string
          is_active?: boolean | null
          pays_concernes?: string[] | null
          secteurs_concernes?: string[] | null
          severity?: string | null
          signaux: Json
          source?: string | null
          titre: string
        }
        Update: {
          categorie?: string
          code?: string
          correction?: string | null
          description?: string
          id?: string
          is_active?: boolean | null
          pays_concernes?: string[] | null
          secteurs_concernes?: string[] | null
          severity?: string | null
          signaux?: Json
          source?: string | null
          titre?: string
        }
        Relationships: []
      }
      knowledge_risk_params: {
        Row: {
          cost_of_debt: number | null
          country_risk_premium: number | null
          date_mise_a_jour: string | null
          date_source: string | null
          decote_gouvernance_no_audit: number | null
          decote_gouvernance_no_board: number | null
          decote_illiquidite: number | null
          decote_taille_micro: number | null
          decote_taille_small: number | null
          default_spread: number | null
          equity_risk_premium: number
          id: string
          illiquidity_premium_max: number | null
          illiquidity_premium_min: number | null
          pays: string
          risk_free_rate: number
          risque_pays_label: string | null
          risque_pays_prime: number | null
          size_premium_medium: number | null
          size_premium_micro: number | null
          size_premium_small: number | null
          source: string
          source_url: string | null
          taux_directeur: number | null
          tax_rate: number | null
          zone: string
        }
        Insert: {
          cost_of_debt?: number | null
          country_risk_premium?: number | null
          date_mise_a_jour?: string | null
          date_source?: string | null
          decote_gouvernance_no_audit?: number | null
          decote_gouvernance_no_board?: number | null
          decote_illiquidite?: number | null
          decote_taille_micro?: number | null
          decote_taille_small?: number | null
          default_spread?: number | null
          equity_risk_premium: number
          id?: string
          illiquidity_premium_max?: number | null
          illiquidity_premium_min?: number | null
          pays: string
          risk_free_rate: number
          risque_pays_label?: string | null
          risque_pays_prime?: number | null
          size_premium_medium?: number | null
          size_premium_micro?: number | null
          size_premium_small?: number | null
          source: string
          source_url?: string | null
          taux_directeur?: number | null
          tax_rate?: number | null
          zone: string
        }
        Update: {
          cost_of_debt?: number | null
          country_risk_premium?: number | null
          date_mise_a_jour?: string | null
          date_source?: string | null
          decote_gouvernance_no_audit?: number | null
          decote_gouvernance_no_board?: number | null
          decote_illiquidite?: number | null
          decote_taille_micro?: number | null
          decote_taille_small?: number | null
          default_spread?: number | null
          equity_risk_premium?: number
          id?: string
          illiquidity_premium_max?: number | null
          illiquidity_premium_min?: number | null
          pays?: string
          risk_free_rate?: number
          risque_pays_label?: string | null
          risque_pays_prime?: number | null
          size_premium_medium?: number | null
          size_premium_micro?: number | null
          size_premium_small?: number | null
          source?: string
          source_url?: string | null
          taux_directeur?: number | null
          tax_rate?: number | null
          zone?: string
        }
        Relationships: []
      }
      knowledge_sources: {
        Row: {
          acces: string | null
          date_publication: string | null
          frequence_mise_a_jour: string | null
          id: string
          nom: string
          notes: string | null
          organisme: string
          pays_couverts: string[] | null
          perimetre_temporel: string | null
          priorite: number | null
          secteurs_couverts: string[] | null
          themes: string[] | null
          type_source: string
          url: string | null
          utilise_dans: string[] | null
        }
        Insert: {
          acces?: string | null
          date_publication?: string | null
          frequence_mise_a_jour?: string | null
          id?: string
          nom: string
          notes?: string | null
          organisme: string
          pays_couverts?: string[] | null
          perimetre_temporel?: string | null
          priorite?: number | null
          secteurs_couverts?: string[] | null
          themes?: string[] | null
          type_source: string
          url?: string | null
          utilise_dans?: string[] | null
        }
        Update: {
          acces?: string | null
          date_publication?: string | null
          frequence_mise_a_jour?: string | null
          id?: string
          nom?: string
          notes?: string | null
          organisme?: string
          pays_couverts?: string[] | null
          perimetre_temporel?: string | null
          priorite?: number | null
          secteurs_couverts?: string[] | null
          themes?: string[] | null
          type_source?: string
          url?: string | null
          utilise_dans?: string[] | null
        }
        Relationships: []
      }
      memo_section_validations: {
        Row: {
          action: string
          actor_id: string
          actor_role: string | null
          comment: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["memo_section_status"] | null
          id: string
          section_id: string
          to_status: Database["public"]["Enums"]["memo_section_status"]
        }
        Insert: {
          action: string
          actor_id: string
          actor_role?: string | null
          comment?: string | null
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["memo_section_status"]
            | null
          id?: string
          section_id: string
          to_status: Database["public"]["Enums"]["memo_section_status"]
        }
        Update: {
          action?: string
          actor_id?: string
          actor_role?: string | null
          comment?: string | null
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["memo_section_status"]
            | null
          id?: string
          section_id?: string
          to_status?: Database["public"]["Enums"]["memo_section_status"]
        }
        Relationships: [
          {
            foreignKeyName: "memo_section_validations_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "memo_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      memo_sections: {
        Row: {
          content_json: Json | null
          content_md: string | null
          created_at: string
          id: string
          last_edited_at: string | null
          last_edited_by: string | null
          position: number
          section_code: Database["public"]["Enums"]["memo_section_code"]
          source_doc_ids: string[] | null
          status: Database["public"]["Enums"]["memo_section_status"]
          title: string | null
          updated_at: string
          version_id: string
        }
        Insert: {
          content_json?: Json | null
          content_md?: string | null
          created_at?: string
          id?: string
          last_edited_at?: string | null
          last_edited_by?: string | null
          position: number
          section_code: Database["public"]["Enums"]["memo_section_code"]
          source_doc_ids?: string[] | null
          status?: Database["public"]["Enums"]["memo_section_status"]
          title?: string | null
          updated_at?: string
          version_id: string
        }
        Update: {
          content_json?: Json | null
          content_md?: string | null
          created_at?: string
          id?: string
          last_edited_at?: string | null
          last_edited_by?: string | null
          position?: number
          section_code?: Database["public"]["Enums"]["memo_section_code"]
          source_doc_ids?: string[] | null
          status?: Database["public"]["Enums"]["memo_section_status"]
          title?: string | null
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memo_sections_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "memo_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      memo_versions: {
        Row: {
          classification: string | null
          created_at: string
          error_message: string | null
          generated_at: string | null
          generated_by_agent: string | null
          generated_by_user_id: string | null
          id: string
          is_snapshot: boolean
          label: string
          memo_id: string
          overall_score: number | null
          parent_version_id: string | null
          snapshot_label: string | null
          snapshot_of_version_id: string | null
          snapshot_taken_at: string | null
          snapshot_taken_by: string | null
          stage: Database["public"]["Enums"]["pe_deal_stage"]
          status: Database["public"]["Enums"]["memo_version_status"]
        }
        Insert: {
          classification?: string | null
          created_at?: string
          error_message?: string | null
          generated_at?: string | null
          generated_by_agent?: string | null
          generated_by_user_id?: string | null
          id?: string
          is_snapshot?: boolean
          label: string
          memo_id: string
          overall_score?: number | null
          parent_version_id?: string | null
          snapshot_label?: string | null
          snapshot_of_version_id?: string | null
          snapshot_taken_at?: string | null
          snapshot_taken_by?: string | null
          stage: Database["public"]["Enums"]["pe_deal_stage"]
          status?: Database["public"]["Enums"]["memo_version_status"]
        }
        Update: {
          classification?: string | null
          created_at?: string
          error_message?: string | null
          generated_at?: string | null
          generated_by_agent?: string | null
          generated_by_user_id?: string | null
          id?: string
          is_snapshot?: boolean
          label?: string
          memo_id?: string
          overall_score?: number | null
          parent_version_id?: string | null
          snapshot_label?: string | null
          snapshot_of_version_id?: string | null
          snapshot_taken_at?: string | null
          snapshot_taken_by?: string | null
          stage?: Database["public"]["Enums"]["pe_deal_stage"]
          status?: Database["public"]["Enums"]["memo_version_status"]
        }
        Relationships: [
          {
            foreignKeyName: "memo_versions_memo_id_fkey"
            columns: ["memo_id"]
            isOneToOne: false
            referencedRelation: "investment_memos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memo_versions_parent_version_id_fkey"
            columns: ["parent_version_id"]
            isOneToOne: false
            referencedRelation: "memo_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memo_versions_snapshot_of_version_id_fkey"
            columns: ["snapshot_of_version_id"]
            isOneToOne: false
            referencedRelation: "memo_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          enterprise_id: string | null
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          personal_message: string | null
          revoked_at: string | null
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          enterprise_id?: string | null
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          personal_message?: string | null
          revoked_at?: string | null
          role: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          enterprise_id?: string | null
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          personal_message?: string | null
          revoked_at?: string | null
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_knowledge: {
        Row: {
          category: string
          content: string
          country: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          organization_id: string
          sector: string | null
          source: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string
          content: string
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          organization_id: string
          sector?: string | null
          source?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          content?: string
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          organization_id?: string
          sector?: string | null
          source?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_knowledge_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          id: string
          invited_by: string | null
          is_active: boolean | null
          joined_at: string | null
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          invited_by?: string | null
          is_active?: boolean | null
          joined_at?: string | null
          organization_id: string
          role: string
          user_id: string
        }
        Update: {
          id?: string
          invited_by?: string | null
          is_active?: boolean | null
          joined_at?: string | null
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_presets: {
        Row: {
          config_banque: Json | null
          constats_config: Json | null
          created_at: string | null
          criteres_conformite: Json | null
          devise: string | null
          fund_segment: string | null
          horizon_projection: number | null
          id: string
          langue: string
          livrables_actifs: string[] | null
          matching_config: Json | null
          modules_desactives: string[] | null
          onboarding_completed: boolean | null
          onboarding_data: Json | null
          organization_id: string
          scoring_weights: Json | null
          templates_custom: Json | null
          updated_at: string | null
          workflow_overrides: Json | null
        }
        Insert: {
          config_banque?: Json | null
          constats_config?: Json | null
          created_at?: string | null
          criteres_conformite?: Json | null
          devise?: string | null
          fund_segment?: string | null
          horizon_projection?: number | null
          id?: string
          langue?: string
          livrables_actifs?: string[] | null
          matching_config?: Json | null
          modules_desactives?: string[] | null
          onboarding_completed?: boolean | null
          onboarding_data?: Json | null
          organization_id: string
          scoring_weights?: Json | null
          templates_custom?: Json | null
          updated_at?: string | null
          workflow_overrides?: Json | null
        }
        Update: {
          config_banque?: Json | null
          constats_config?: Json | null
          created_at?: string | null
          criteres_conformite?: Json | null
          devise?: string | null
          fund_segment?: string | null
          horizon_projection?: number | null
          id?: string
          langue?: string
          livrables_actifs?: string[] | null
          matching_config?: Json | null
          modules_desactives?: string[] | null
          onboarding_completed?: boolean | null
          onboarding_data?: Json | null
          organization_id?: string
          scoring_weights?: Json | null
          templates_custom?: Json | null
          updated_at?: string | null
          workflow_overrides?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_presets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_workflows: {
        Row: {
          created_at: string | null
          etape_id: string
          id: string
          is_active: boolean | null
          label: string
          ordre: number
          organization_id: string
          roles: string[] | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          etape_id: string
          id?: string
          is_active?: boolean | null
          label: string
          ordre: number
          organization_id: string
          roles?: string[] | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          etape_id?: string
          id?: string
          is_active?: boolean | null
          label?: string
          ordre?: number
          organization_id?: string
          roles?: string[] | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_workflows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          code: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          primary_color: string | null
          secondary_color: string | null
          settings: Json | null
          slug: string
          type: string
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          primary_color?: string | null
          secondary_color?: string | null
          settings?: Json | null
          slug: string
          type: string
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          secondary_color?: string | null
          settings?: Json | null
          slug?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      pe_dd_checklist: {
        Row: {
          category: Database["public"]["Enums"]["pe_dd_category"]
          created_at: string
          deal_id: string
          due_date: string | null
          evidence_doc_ids: string[]
          id: string
          item_description: string | null
          item_label: string
          organization_id: string
          position: number
          responsable_user_id: string | null
          status: Database["public"]["Enums"]["pe_dd_checklist_status"]
          updated_at: string
          verification_note: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["pe_dd_category"]
          created_at?: string
          deal_id: string
          due_date?: string | null
          evidence_doc_ids?: string[]
          id?: string
          item_description?: string | null
          item_label: string
          organization_id: string
          position?: number
          responsable_user_id?: string | null
          status?: Database["public"]["Enums"]["pe_dd_checklist_status"]
          updated_at?: string
          verification_note?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["pe_dd_category"]
          created_at?: string
          deal_id?: string
          due_date?: string | null
          evidence_doc_ids?: string[]
          id?: string
          item_description?: string | null
          item_label?: string
          organization_id?: string
          position?: number
          responsable_user_id?: string | null
          status?: Database["public"]["Enums"]["pe_dd_checklist_status"]
          updated_at?: string
          verification_note?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pe_dd_checklist_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "pe_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pe_dd_checklist_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pe_dd_findings: {
        Row: {
          applied_to_memo_at: string | null
          applied_to_memo_by: string | null
          body: string
          category: Database["public"]["Enums"]["pe_dd_category"]
          created_at: string
          created_by: string
          deal_id: string
          evidence_doc_ids: string[]
          finding_type: Database["public"]["Enums"]["pe_dd_finding_type"]
          id: string
          impacts_section_codes: string[]
          organization_id: string
          recommendation: string | null
          related_checklist_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["pe_dd_severity"]
          source: string
          source_doc_id: string | null
          source_page: number | null
          source_paragraph: string | null
          status: Database["public"]["Enums"]["pe_dd_finding_status"]
          title: string
          updated_at: string
        }
        Insert: {
          applied_to_memo_at?: string | null
          applied_to_memo_by?: string | null
          body: string
          category: Database["public"]["Enums"]["pe_dd_category"]
          created_at?: string
          created_by: string
          deal_id: string
          evidence_doc_ids?: string[]
          finding_type?: Database["public"]["Enums"]["pe_dd_finding_type"]
          id?: string
          impacts_section_codes?: string[]
          organization_id: string
          recommendation?: string | null
          related_checklist_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: Database["public"]["Enums"]["pe_dd_severity"]
          source?: string
          source_doc_id?: string | null
          source_page?: number | null
          source_paragraph?: string | null
          status?: Database["public"]["Enums"]["pe_dd_finding_status"]
          title: string
          updated_at?: string
        }
        Update: {
          applied_to_memo_at?: string | null
          applied_to_memo_by?: string | null
          body?: string
          category?: Database["public"]["Enums"]["pe_dd_category"]
          created_at?: string
          created_by?: string
          deal_id?: string
          evidence_doc_ids?: string[]
          finding_type?: Database["public"]["Enums"]["pe_dd_finding_type"]
          id?: string
          impacts_section_codes?: string[]
          organization_id?: string
          recommendation?: string | null
          related_checklist_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["pe_dd_severity"]
          source?: string
          source_doc_id?: string | null
          source_page?: number | null
          source_paragraph?: string | null
          status?: Database["public"]["Enums"]["pe_dd_finding_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pe_dd_findings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "pe_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pe_dd_findings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pe_dd_findings_related_checklist_id_fkey"
            columns: ["related_checklist_id"]
            isOneToOne: false
            referencedRelation: "pe_dd_checklist"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pe_dd_findings_source_doc_id_fkey"
            columns: ["source_doc_id"]
            isOneToOne: false
            referencedRelation: "pe_deal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      pe_deal_documents: {
        Row: {
          category: string | null
          created_at: string
          dd_report_cabinet: string | null
          dd_report_pages: number | null
          dd_report_type:
            | Database["public"]["Enums"]["pe_dd_report_type"]
            | null
          deal_id: string
          filename: string
          id: string
          is_dd_report: boolean
          mime_type: string | null
          organization_id: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          dd_report_cabinet?: string | null
          dd_report_pages?: number | null
          dd_report_type?:
            | Database["public"]["Enums"]["pe_dd_report_type"]
            | null
          deal_id: string
          filename: string
          id?: string
          is_dd_report?: boolean
          mime_type?: string | null
          organization_id: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by: string
        }
        Update: {
          category?: string | null
          created_at?: string
          dd_report_cabinet?: string | null
          dd_report_pages?: number | null
          dd_report_type?:
            | Database["public"]["Enums"]["pe_dd_report_type"]
            | null
          deal_id?: string
          filename?: string
          id?: string
          is_dd_report?: boolean
          mime_type?: string | null
          organization_id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "pe_deal_documents_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "pe_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pe_deal_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pe_deal_history: {
        Row: {
          changed_by: string | null
          created_at: string | null
          deal_id: string
          from_stage: Database["public"]["Enums"]["pe_deal_stage"] | null
          id: string
          reason: string | null
          to_stage: Database["public"]["Enums"]["pe_deal_stage"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          deal_id: string
          from_stage?: Database["public"]["Enums"]["pe_deal_stage"] | null
          id?: string
          reason?: string | null
          to_stage: Database["public"]["Enums"]["pe_deal_stage"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          deal_id?: string
          from_stage?: Database["public"]["Enums"]["pe_deal_stage"] | null
          id?: string
          reason?: string | null
          to_stage?: Database["public"]["Enums"]["pe_deal_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "pe_deal_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "pe_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      pe_deals: {
        Row: {
          created_at: string | null
          created_by: string | null
          currency: string | null
          deal_ref: string
          enterprise_id: string | null
          id: string
          lead_analyst_id: string | null
          lost_reason: string | null
          organization_id: string
          score_360: number | null
          source: Database["public"]["Enums"]["pe_deal_source"] | null
          source_detail: string | null
          stage: Database["public"]["Enums"]["pe_deal_stage"]
          ticket_demande: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          deal_ref: string
          enterprise_id?: string | null
          id?: string
          lead_analyst_id?: string | null
          lost_reason?: string | null
          organization_id: string
          score_360?: number | null
          source?: Database["public"]["Enums"]["pe_deal_source"] | null
          source_detail?: string | null
          stage?: Database["public"]["Enums"]["pe_deal_stage"]
          ticket_demande?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          deal_ref?: string
          enterprise_id?: string | null
          id?: string
          lead_analyst_id?: string | null
          lost_reason?: string | null
          organization_id?: string
          score_360?: number | null
          source?: Database["public"]["Enums"]["pe_deal_source"] | null
          source_detail?: string | null
          stage?: Database["public"]["Enums"]["pe_deal_stage"]
          ticket_demande?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pe_deals_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pe_deals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pe_team_assignments: {
        Row: {
          analyst_user_id: string
          assigned_by: string | null
          created_at: string | null
          id: string
          im_user_id: string
          is_active: boolean | null
          organization_id: string
        }
        Insert: {
          analyst_user_id: string
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          im_user_id: string
          is_active?: boolean | null
          organization_id: string
        }
        Update: {
          analyst_user_id?: string
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          im_user_id?: string
          is_active?: boolean | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pe_team_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pe_valuation: {
        Row: {
          ai_justification: string | null
          ancc_assets: Json
          ancc_liabilities: Json
          ancc_outputs: Json
          created_at: string
          currency: string | null
          dcf_inputs: Json
          dcf_outputs: Json
          dcf_projections: Json
          dcf_terminal: Json
          deal_id: string
          error_message: string | null
          generated_at: string | null
          generated_by_agent: string | null
          generated_by_user_id: string | null
          id: string
          multiples_comparables: Json
          multiples_outputs: Json
          organization_id: string
          status: string
          synthesis: Json
          updated_at: string
        }
        Insert: {
          ai_justification?: string | null
          ancc_assets?: Json
          ancc_liabilities?: Json
          ancc_outputs?: Json
          created_at?: string
          currency?: string | null
          dcf_inputs?: Json
          dcf_outputs?: Json
          dcf_projections?: Json
          dcf_terminal?: Json
          deal_id: string
          error_message?: string | null
          generated_at?: string | null
          generated_by_agent?: string | null
          generated_by_user_id?: string | null
          id?: string
          multiples_comparables?: Json
          multiples_outputs?: Json
          organization_id: string
          status?: string
          synthesis?: Json
          updated_at?: string
        }
        Update: {
          ai_justification?: string | null
          ancc_assets?: Json
          ancc_liabilities?: Json
          ancc_outputs?: Json
          created_at?: string
          currency?: string | null
          dcf_inputs?: Json
          dcf_outputs?: Json
          dcf_projections?: Json
          dcf_terminal?: Json
          deal_id?: string
          error_message?: string | null
          generated_at?: string | null
          generated_by_agent?: string | null
          generated_by_user_id?: string | null
          id?: string
          multiples_comparables?: Json
          multiples_outputs?: Json
          organization_id?: string
          status?: string
          synthesis?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pe_valuation_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "pe_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pe_valuation_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string
          raw_criteria_text: string | null
          required_deliverables: string[] | null
          sector_filter: string[] | null
          source_document_url: string | null
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
          organization_id: string
          raw_criteria_text?: string | null
          required_deliverables?: string[] | null
          sector_filter?: string[] | null
          source_document_url?: string | null
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
          organization_id?: string
          raw_criteria_text?: string | null
          required_deliverables?: string[] | null
          sector_filter?: string[] | null
          source_document_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programme_criteria_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_kpi_history: {
        Row: {
          created_at: string | null
          id: string
          kpi_id: string
          notes: string | null
          organization_id: string
          period: string
          recorded_by: string | null
          value: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          kpi_id: string
          notes?: string | null
          organization_id: string
          period: string
          recorded_by?: string | null
          value: number
        }
        Update: {
          created_at?: string | null
          id?: string
          kpi_id?: string
          notes?: string | null
          organization_id?: string
          period?: string
          recorded_by?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "programme_kpi_history_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "programme_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programme_kpi_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_kpis: {
        Row: {
          auto_formula: string | null
          bailleur: string | null
          baseline_value: number | null
          created_at: string | null
          current_value: number | null
          description: string | null
          id: string
          kpi_category: string
          kpi_code: string
          kpi_name: string
          organization_id: string
          programme_id: string
          reporting_frequency: string | null
          source: string | null
          target_value: number | null
          unit: string
          updated_at: string | null
        }
        Insert: {
          auto_formula?: string | null
          bailleur?: string | null
          baseline_value?: number | null
          created_at?: string | null
          current_value?: number | null
          description?: string | null
          id?: string
          kpi_category: string
          kpi_code: string
          kpi_name: string
          organization_id: string
          programme_id: string
          reporting_frequency?: string | null
          source?: string | null
          target_value?: number | null
          unit: string
          updated_at?: string | null
        }
        Update: {
          auto_formula?: string | null
          bailleur?: string | null
          baseline_value?: number | null
          created_at?: string | null
          current_value?: number | null
          description?: string | null
          id?: string
          kpi_category?: string
          kpi_code?: string
          kpi_name?: string
          organization_id?: string
          programme_id?: string
          reporting_frequency?: string | null
          source?: string | null
          target_value?: number | null
          unit?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programme_kpis_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programme_kpis_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      programmes: {
        Row: {
          budget: number | null
          chef_programme_id: string | null
          country_filter: string[] | null
          created_at: string | null
          created_by: string
          criteria_id: string | null
          currency: string | null
          description: string | null
          end_date: string | null
          form_fields: Json | null
          form_slug: string | null
          id: string
          last_report: Json | null
          last_report_at: string | null
          last_report_type: string | null
          logo_url: string | null
          name: string
          nb_places: number | null
          organization: string | null
          organization_id: string
          programme_end: string | null
          programme_start: string | null
          sector_filter: string[] | null
          start_date: string | null
          status: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          budget?: number | null
          chef_programme_id?: string | null
          country_filter?: string[] | null
          created_at?: string | null
          created_by: string
          criteria_id?: string | null
          currency?: string | null
          description?: string | null
          end_date?: string | null
          form_fields?: Json | null
          form_slug?: string | null
          id?: string
          last_report?: Json | null
          last_report_at?: string | null
          last_report_type?: string | null
          logo_url?: string | null
          name: string
          nb_places?: number | null
          organization?: string | null
          organization_id: string
          programme_end?: string | null
          programme_start?: string | null
          sector_filter?: string[] | null
          start_date?: string | null
          status?: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          budget?: number | null
          chef_programme_id?: string | null
          country_filter?: string[] | null
          created_at?: string | null
          created_by?: string
          criteria_id?: string | null
          currency?: string | null
          description?: string | null
          end_date?: string | null
          form_fields?: Json | null
          form_slug?: string | null
          id?: string
          last_report?: Json | null
          last_report_at?: string | null
          last_report_type?: string | null
          logo_url?: string | null
          name?: string
          nb_places?: number | null
          organization?: string | null
          organization_id?: string
          programme_end?: string | null
          programme_start?: string | null
          sector_filter?: string[] | null
          start_date?: string | null
          status?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programmes_criteria_id_fkey"
            columns: ["criteria_id"]
            isOneToOne: false
            referencedRelation: "programme_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programmes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      score_history: {
        Row: {
          created_at: string
          enterprise_id: string
          id: string
          organization_id: string
          score: number
          scores_detail: Json | null
        }
        Insert: {
          created_at?: string
          enterprise_id: string
          id?: string
          organization_id: string
          score: number
          scores_detail?: Json | null
        }
        Update: {
          created_at?: string
          enterprise_id?: string
          id?: string
          organization_id?: string
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
          {
            foreignKeyName: "score_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      workspace_knowledge: {
        Row: {
          cle: string
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          organization_id: string
          owner_id: string
          type: string
          valeur: Json
        }
        Insert: {
          cle: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          owner_id: string
          type: string
          valeur: Json
        }
        Update: {
          cle?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          owner_id?: string
          type?: string
          valeur?: Json
        }
        Relationships: [
          {
            foreignKeyName: "workspace_knowledge_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_see_pe_deal: {
        Args: { p_deal_id: string; p_user_id: string }
        Returns: boolean
      }
      check_slug_available: { Args: { p_slug: string }; Returns: boolean }
      get_metering_org_detail: {
        Args: { p_org_id: string; period_end: string; period_start: string }
        Returns: {
          call_count: number
          function_name: string
          model: string
          total_cost: number
          total_input_tokens: number
          total_output_tokens: number
        }[]
      }
      get_metering_summary: {
        Args: { org_filter?: string; period_end: string; period_start: string }
        Returns: {
          avg_cost_per_call: number
          avg_cost_per_enterprise: number
          call_count: number
          enterprise_count: number
          organization_id: string
          organization_name: string
          organization_type: string
          total_cost: number
        }[]
      }
      get_pe_role: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: string
      }
      get_user_organizations: { Args: never; Returns: string[] }
      get_user_role_in: { Args: { org_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_coach_of_enterprise: { Args: { ent_id: string }; Returns: boolean }
      is_member_of: { Args: { org_id: string }; Returns: boolean }
      is_owner_or_admin_of: { Args: { org_id: string }; Returns: boolean }
      is_pe_md_or_owner: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      is_supervising_analyst: {
        Args: { p_analyst_user: string; p_im_user: string; p_org_id: string }
        Returns: boolean
      }
      link_enterprise_to_coach_by_email: {
        Args: { enterprise_email: string }
        Returns: string
      }
      list_all_organizations_for_admin: {
        Args: never
        Returns: {
          country: string
          created_at: string
          enterprise_count: number
          id: string
          is_active: boolean
          member_count: number
          name: string
          slug: string
          type: string
        }[]
      }
      pe_create_memo_snapshot: {
        Args: { p_label: string; p_user_id: string; p_version_id: string }
        Returns: string
      }
      search_knowledge: {
        Args: {
          filter_categories?: string[]
          filter_country?: string
          filter_sector?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          category: string
          content: string
          country: string
          id: string
          sector: string
          similarity: number
          source: string
          title: string
        }[]
      }
      search_knowledge_chunks: {
        Args: {
          filter_country?: string
          filter_organization_id?: string
          filter_sector?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          category: string
          chunk_index: number
          content: string
          country: string
          id: string
          kb_entry_id: string
          org_entry_id: string
          publication_date: string
          sector: string
          similarity: number
          source: string
          source_url: string
          title: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "coach"
        | "entrepreneur"
        | "super_admin"
        | "chef_programme"
        | "analyste"
        | "investment_manager"
        | "managing_director"
        | "conseiller_pme"
        | "analyste_credit"
        | "directeur_agence"
        | "direction_pme"
        | "partner"
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
        | "odd_excel"
        | "screening_report"
        | "pre_screening"
        | "valuation"
        | "onepager"
        | "pitch_deck"
        | "investment_memo"
        | "plan_ovo_excel"
        | "plan_financier"
        | "diagnostic_bancabilite"
        | "credit_readiness_pack"
        | "note_credit"
        | "teaser_anonymise"
        | "credit_readiness_modele_financier"
        | "credit_readiness_projections"
        | "credit_readiness_bp_credit"
        | "credit_readiness_plan_financement"
        | "credit_readiness_organigramme"
        | "credit_readiness_analyse_commerciale"
        | "matching_produits"
      memo_section_code:
        | "executive_summary"
        | "shareholding_governance"
        | "top_management"
        | "services"
        | "competition_market"
        | "unit_economics"
        | "financials_pnl"
        | "financials_balance"
        | "investment_thesis"
        | "support_requested"
        | "esg_risks"
        | "annexes"
      memo_section_status:
        | "draft"
        | "pending_validation"
        | "validated"
        | "needs_revision"
      memo_version_status: "generating" | "ready" | "validated" | "rejected"
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
        | "plan_financier"
        | "diagnostic_bancabilite"
        | "credit_readiness_pack"
        | "note_credit"
        | "teaser_anonymise"
      module_status: "not_started" | "in_progress" | "completed"
      operating_mode: "reconstruction" | "due_diligence"
      pe_dd_category:
        | "financier"
        | "juridique"
        | "commercial"
        | "operationnel"
        | "rh"
        | "esg"
        | "fiscal"
        | "it"
      pe_dd_checklist_status: "pending" | "verified" | "red_flag" | "na"
      pe_dd_finding_status: "open" | "mitigated" | "accepted" | "rejected"
      pe_dd_finding_type:
        | "confirmation"
        | "adjustment"
        | "red_flag"
        | "informative"
      pe_dd_report_type:
        | "financiere"
        | "juridique"
        | "esg"
        | "fiscale"
        | "operationnelle"
        | "commerciale"
        | "autre"
      pe_dd_severity: "Critical" | "High" | "Medium" | "Low"
      pe_deal_source:
        | "reseau_pe"
        | "inbound"
        | "dfi"
        | "banque"
        | "mandat_ba"
        | "conference"
        | "autre"
      pe_deal_stage:
        | "sourcing"
        | "pre_screening"
        | "analyse"
        | "note_ic1"
        | "dd"
        | "note_ic_finale"
        | "closing"
        | "portfolio"
        | "lost"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: [
        "coach",
        "entrepreneur",
        "super_admin",
        "chef_programme",
        "analyste",
        "investment_manager",
        "managing_director",
        "conseiller_pme",
        "analyste_credit",
        "directeur_agence",
        "direction_pme",
        "partner",
      ],
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
        "odd_excel",
        "screening_report",
        "pre_screening",
        "valuation",
        "onepager",
        "pitch_deck",
        "investment_memo",
        "plan_ovo_excel",
        "plan_financier",
        "diagnostic_bancabilite",
        "credit_readiness_pack",
        "note_credit",
        "teaser_anonymise",
        "credit_readiness_modele_financier",
        "credit_readiness_projections",
        "credit_readiness_bp_credit",
        "credit_readiness_plan_financement",
        "credit_readiness_organigramme",
        "credit_readiness_analyse_commerciale",
        "matching_produits",
      ],
      memo_section_code: [
        "executive_summary",
        "shareholding_governance",
        "top_management",
        "services",
        "competition_market",
        "unit_economics",
        "financials_pnl",
        "financials_balance",
        "investment_thesis",
        "support_requested",
        "esg_risks",
        "annexes",
      ],
      memo_section_status: [
        "draft",
        "pending_validation",
        "validated",
        "needs_revision",
      ],
      memo_version_status: ["generating", "ready", "validated", "rejected"],
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
        "plan_financier",
        "diagnostic_bancabilite",
        "credit_readiness_pack",
        "note_credit",
        "teaser_anonymise",
      ],
      module_status: ["not_started", "in_progress", "completed"],
      operating_mode: ["reconstruction", "due_diligence"],
      pe_dd_category: [
        "financier",
        "juridique",
        "commercial",
        "operationnel",
        "rh",
        "esg",
        "fiscal",
        "it",
      ],
      pe_dd_checklist_status: ["pending", "verified", "red_flag", "na"],
      pe_dd_finding_status: ["open", "mitigated", "accepted", "rejected"],
      pe_dd_finding_type: [
        "confirmation",
        "adjustment",
        "red_flag",
        "informative",
      ],
      pe_dd_report_type: [
        "financiere",
        "juridique",
        "esg",
        "fiscale",
        "operationnelle",
        "commerciale",
        "autre",
      ],
      pe_dd_severity: ["Critical", "High", "Medium", "Low"],
      pe_deal_source: [
        "reseau_pe",
        "inbound",
        "dfi",
        "banque",
        "mandat_ba",
        "conference",
        "autre",
      ],
      pe_deal_stage: [
        "sourcing",
        "pre_screening",
        "analyse",
        "note_ic1",
        "dd",
        "note_ic_finale",
        "closing",
        "portfolio",
        "lost",
      ],
    },
  },
} as const

