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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agreements: {
        Row: {
          commission_amount: number
          conversation_id: string
          created_at: string
          currency: string
          expires_at: string
          id: string
          phone_shared: boolean
          price: number | null
          price_confidence: number | null
          price_source: string | null
          provider_id: string
          rejection_reason: string | null
          request_id: string
          requester_id: string
          responded_at: string | null
          state: Database["public"]["Enums"]["agreement_state"]
        }
        Insert: {
          commission_amount: number
          conversation_id: string
          created_at?: string
          currency?: string
          expires_at: string
          id?: string
          phone_shared?: boolean
          price?: number | null
          price_confidence?: number | null
          price_source?: string | null
          provider_id: string
          rejection_reason?: string | null
          request_id: string
          requester_id: string
          responded_at?: string | null
          state?: Database["public"]["Enums"]["agreement_state"]
        }
        Update: {
          commission_amount?: number
          conversation_id?: string
          created_at?: string
          currency?: string
          expires_at?: string
          id?: string
          phone_shared?: boolean
          price?: number | null
          price_confidence?: number | null
          price_source?: string | null
          provider_id?: string
          rejection_reason?: string | null
          request_id?: string
          requester_id?: string
          responded_at?: string | null
          state?: Database["public"]["Enums"]["agreement_state"]
        }
        Relationships: [
          {
            foreignKeyName: "agreements_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "agreements_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          created_at: string
          excluded_reason: string | null
          id: string
          match_metadata: Json | null
          match_score: number | null
          provider_id: string
          rank: number
          request_id: string
        }
        Insert: {
          created_at?: string
          excluded_reason?: string | null
          id?: string
          match_metadata?: Json | null
          match_score?: number | null
          provider_id: string
          rank: number
          request_id: string
        }
        Update: {
          created_at?: string
          excluded_reason?: string | null
          id?: string
          match_metadata?: Json | null
          match_score?: number | null
          provider_id?: string
          rank?: number
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "candidates_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          locked_reason: string | null
          provider_id: string
          request_id: string
          requester_id: string
          state: Database["public"]["Enums"]["conversation_state"]
          updated_at: string
          writable_until: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          locked_reason?: string | null
          provider_id: string
          request_id: string
          requester_id: string
          state?: Database["public"]["Enums"]["conversation_state"]
          updated_at?: string
          writable_until?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          locked_reason?: string | null
          provider_id?: string
          request_id?: string
          requester_id?: string
          state?: Database["public"]["Enums"]["conversation_state"]
          updated_at?: string
          writable_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "conversations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          created_by: string | null
          currency: string
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id: string
          idempotency_key: string
          reference_id: string | null
          reference_type: string | null
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          created_by?: string | null
          currency?: string
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          idempotency_key: string
          reference_id?: string | null
          reference_type?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          entry_type?: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          idempotency_key?: string
          reference_id?: string | null
          reference_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          client_dedupe_key: string | null
          delivered_at: string | null
          read_at: string | null
          conversation_id: string
          created_at: string
          id: string
          message_type: Database["public"]["Enums"]["message_type"]
          sender_id: string
        }
        Insert: {
          body: string
          client_dedupe_key?: string | null
          delivered_at?: string | null
          read_at?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          message_type?: Database["public"]["Enums"]["message_type"]
          sender_id: string
        }
        Update: {
          body?: string
          client_dedupe_key?: string | null
          delivered_at?: string | null
          read_at?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          message_type?: Database["public"]["Enums"]["message_type"]
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          payload: Json
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_profiles: {
        Row: {
          bio: string | null
          cancellations_count: number
          commitment_rate: number | null
          completed_services_count: number
          created_at: string
          is_available: boolean
          rating_avg: number
          response_speed_avg_sec: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          cancellations_count?: number
          commitment_rate?: number | null
          completed_services_count?: number
          created_at?: string
          is_available?: boolean
          rating_avg?: number
          response_speed_avg_sec?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          cancellations_count?: number
          commitment_rate?: number | null
          completed_services_count?: number
          created_at?: string
          is_available?: boolean
          rating_avg?: number
          response_speed_avg_sec?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_services: {
        Row: {
          created_at: string
          description: string
          experience_years: number
          id: string
          is_active: boolean
          price_max: number
          price_min: number
          provider_id: string
          skill_id: string | null
          structured_data: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          experience_years?: number
          id?: string
          is_active?: boolean
          price_max?: number
          price_min?: number
          provider_id: string
          skill_id?: string | null
          structured_data?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          experience_years?: number
          id?: string
          is_active?: boolean
          price_max?: number
          price_min?: number
          provider_id?: string
          skill_id?: string | null
          structured_data?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "provider_services_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_skills: {
        Row: {
          provider_id: string
          skill_id: string
        }
        Insert: {
          provider_id: string
          skill_id: string
        }
        Update: {
          provider_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_skills_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "provider_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          auto_completed: boolean
          comment: string | null
          created_at: string
          from_user_id: string
          id: string
          request_id: string
          score: number
          tags: string[] | null
          to_user_id: string
        }
        Insert: {
          auto_completed?: boolean
          comment?: string | null
          created_at?: string
          from_user_id: string
          id?: string
          request_id: string
          score: number
          tags?: string[] | null
          to_user_id: string
        }
        Update: {
          auto_completed?: boolean
          comment?: string | null
          created_at?: string
          from_user_id?: string
          id?: string
          request_id?: string
          score?: number
          tags?: string[] | null
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          request_id: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          request_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          request_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          ai_confidence: number | null
          cancelled_at: string | null
          clarification_question: string | null
          completed_at: string | null
          created_at: string
          id: string
          matched_at: string | null
          needs_clarification: boolean
          raw_text: string
          service_area: string | null
          additional_info: string | null
          region: string | null
          requester_id: string
          state: Database["public"]["Enums"]["request_state"]
          structured_data: Json | null
          updated_at: string
          urgency: Database["public"]["Enums"]["request_urgency"]
        }
        Insert: {
          ai_confidence?: number | null
          cancelled_at?: string | null
          clarification_question?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          matched_at?: string | null
          needs_clarification?: boolean
          raw_text: string
          service_area?: string | null
          additional_info?: string | null
          region?: string | null
          requester_id: string
          state?: Database["public"]["Enums"]["request_state"]
          structured_data?: Json | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["request_urgency"]
        }
        Update: {
          ai_confidence?: number | null
          cancelled_at?: string | null
          clarification_question?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          matched_at?: string | null
          needs_clarification?: boolean
          raw_text?: string
          service_area?: string | null
          additional_info?: string | null
          region?: string | null
          requester_id?: string
          state?: Database["public"]["Enums"]["request_state"]
          structured_data?: Json | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["request_urgency"]
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          is_admin: boolean
          is_provider: boolean
          phone: string | null
          region: string | null
          status: string
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          is_admin?: boolean
          is_provider?: boolean
          phone?: string | null
          region?: string | null
          status?: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_admin?: boolean
          is_provider?: boolean
          phone?: string | null
          region?: string | null
          status?: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: []
      }
      verifications: {
        Row: {
          created_at: string
          id: string
          id_document_url: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string | null
          status: Database["public"]["Enums"]["verification_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          id_document_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          id_document_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          available_balance: number
          currency: string
          updated_at: string
          user_id: string
        }
        Insert: {
          available_balance?: number
          currency?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          available_balance?: number
          currency?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_provider_candidates: {
        Args: {
          p_request_id: string
          p_limit?: number
        }
        Returns: {
          provider_id: string
          rating_avg: number
          completed_services_count: number
          full_name: string
          avatar_url: string | null
          region: string
          verification_status: string
          services: Json
          preliminary_score: number
        }[]
      }
      request_agreement: {
        Args: { p_conversation_id: string; p_price?: number }
        Returns: Database["public"]["Tables"]["agreements"]["Row"]
      }
      respond_agreement: {
        Args: {
          p_agreement_id: string
          p_approve: boolean
          p_reason?: string
          p_share_phone?: boolean
        }
        Returns: Database["public"]["Tables"]["agreements"]["Row"]
      }
      cancel_agreement: {
        Args: { p_agreement_id: string }
        Returns: Database["public"]["Tables"]["agreements"]["Row"]
      }
      get_conversation_agreement: {
        Args: { p_conversation_id: string }
        Returns: Database["public"]["Tables"]["agreements"]["Row"][]
      }
      mark_messages_delivered: {
        Args: { p_conversation_id: string }
        Returns: number
      }
      mark_messages_read: {
        Args: { p_conversation_id: string }
        Returns: number
      }
      mark_all_my_messages_delivered: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      open_conversation: {
        Args: { p_request_id: string; p_provider_id: string }
        Returns: string
      }
      get_my_conversations: {
        Args: Record<PropertyKey, never>
        Returns: {
          conversation_id: string
          request_id: string
          state: string
          my_role: string
          other_user_id: string
          other_name: string
          other_avatar_url: string | null
          other_region: string | null
          other_verification_status: string | null
          request_text: string | null
          last_message_body: string | null
          last_message_at: string | null
          last_message_sender: string | null
          unread_count: number
          updated_at: string
        }[]
      }
      get_request_candidates: {
        Args: { p_request_id: string }
        Returns: {
          provider_id: string
          rank: number
          match_score: number | null
          rating_avg: number
          completed_services_count: number
          full_name: string
          avatar_url: string | null
          region: string
          verification_status: string
        }[]
      }
      approve_agreement: {
        Args: { p_agreement_id: string; p_provider_id: string }
        Returns: {
          commission_amount: number
          conversation_id: string
          created_at: string
          currency: string
          expires_at: string
          id: string
          phone_shared: boolean
          price: number | null
          price_confidence: number | null
          price_source: string | null
          provider_id: string
          rejection_reason: string | null
          request_id: string
          requester_id: string
          responded_at: string | null
          state: Database["public"]["Enums"]["agreement_state"]
        }
        SetofOptions: {
          from: "*"
          to: "agreements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_agreement: {
        Args: {
          p_commission: number
          p_conversation_id: string
          p_price: number | null
          p_price_source: string
          p_provider_id: string
          p_request_id: string
          p_requester_id: string
        }
        Returns: {
          commission_amount: number
          conversation_id: string
          created_at: string
          currency: string
          expires_at: string
          id: string
          phone_shared: boolean
          price: number | null
          price_confidence: number | null
          price_source: string | null
          provider_id: string
          rejection_reason: string | null
          request_id: string
          requester_id: string
          responded_at: string | null
          state: Database["public"]["Enums"]["agreement_state"]
        }
        SetofOptions: {
          from: "*"
          to: "agreements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_agreement: {
        Args: {
          p_agreement_id: string
          p_provider_id: string
          p_reason?: string
        }
        Returns: {
          commission_amount: number
          conversation_id: string
          created_at: string
          currency: string
          expires_at: string
          id: string
          phone_shared: boolean
          price: number | null
          price_confidence: number | null
          price_source: string | null
          provider_id: string
          rejection_reason: string | null
          request_id: string
          requester_id: string
          responded_at: string | null
          state: Database["public"]["Enums"]["agreement_state"]
        }
        SetofOptions: {
          from: "*"
          to: "agreements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      agreement_state:
        | "pending"
        | "active"
        | "rejected"
        | "expired"
        | "cancelled"
      conversation_state:
        | "negotiating"
        | "agreement_pending"
        | "active"
        | "locked_temp"
        | "read_only"
      ledger_entry_type:
        | "commission_debit"
        | "topup_credit"
        | "bonus_credit"
        | "refund_credit"
        | "adjustment_credit"
        | "adjustment_debit"
      message_type: "text" | "system"
      report_status: "open" | "reviewed" | "resolved" | "dismissed"
      request_state:
        | "draft"
        | "submitted"
        | "clarification"
        | "matching"
        | "candidates_ready"
        | "negotiating"
        | "agreement_pending_provider"
        | "active"
        | "completion_pending_rating"
        | "completed"
        | "cancelled"
        | "expired"
      request_urgency: "normal" | "urgent"
      verification_status: "pending" | "approved" | "rejected"
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
  public: {
    Enums: {
      agreement_state: [
        "pending",
        "active",
        "rejected",
        "expired",
        "cancelled",
      ],
      conversation_state: [
        "negotiating",
        "agreement_pending",
        "active",
        "locked_temp",
        "read_only",
      ],
      ledger_entry_type: [
        "commission_debit",
        "topup_credit",
        "bonus_credit",
        "refund_credit",
        "adjustment_credit",
        "adjustment_debit",
      ],
      message_type: ["text", "system"],
      report_status: ["open", "reviewed", "resolved", "dismissed"],
      request_state: [
        "draft",
        "submitted",
        "clarification",
        "matching",
        "candidates_ready",
        "negotiating",
        "agreement_pending_provider",
        "active",
        "completion_pending_rating",
        "completed",
        "cancelled",
        "expired",
      ],
      request_urgency: ["normal", "urgent"],
      verification_status: ["pending", "approved", "rejected"],
    },
  },
} as const