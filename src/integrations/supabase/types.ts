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
      cc_ad_account_binding: {
        Row: {
          ad_account_id: string
          created_at: string
          display_label: string | null
          id: string
          is_default: boolean
          linkedin_connection_id: string | null
          meta_connection_id: string | null
          provider: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          ad_account_id: string
          created_at?: string
          display_label?: string | null
          id?: string
          is_default?: boolean
          linkedin_connection_id?: string | null
          meta_connection_id?: string | null
          provider: string
          user_id: string
          workspace_id: string
        }
        Update: {
          ad_account_id?: string
          created_at?: string
          display_label?: string | null
          id?: string
          is_default?: boolean
          linkedin_connection_id?: string | null
          meta_connection_id?: string | null
          provider?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cc_ad_account_binding_linkedin_connection_id_fkey"
            columns: ["linkedin_connection_id"]
            isOneToOne: false
            referencedRelation: "linkedin_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cc_ad_account_binding_meta_connection_id_fkey"
            columns: ["meta_connection_id"]
            isOneToOne: false
            referencedRelation: "meta_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cc_ad_account_binding_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "cc_workspace"
            referencedColumns: ["id"]
          },
        ]
      }
      cc_asset: {
        Row: {
          alt_text: string | null
          channels: string[]
          created_at: string
          display_name: string | null
          id: string
          provider_asset_map: Json
          public_url: string
          source: string
          source_ref: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          alt_text?: string | null
          channels?: string[]
          created_at?: string
          display_name?: string | null
          id?: string
          provider_asset_map?: Json
          public_url: string
          source: string
          source_ref?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          alt_text?: string | null
          channels?: string[]
          created_at?: string
          display_name?: string | null
          id?: string
          provider_asset_map?: Json
          public_url?: string
          source?: string
          source_ref?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cc_asset_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "cc_workspace"
            referencedColumns: ["id"]
          },
        ]
      }
      cc_asset_variant: {
        Row: {
          asset_id: string
          created_at: string
          height: number | null
          id: string
          public_url: string
          ratio_key: string
          width: number | null
        }
        Insert: {
          asset_id: string
          created_at?: string
          height?: number | null
          id?: string
          public_url: string
          ratio_key: string
          width?: number | null
        }
        Update: {
          asset_id?: string
          created_at?: string
          height?: number | null
          id?: string
          public_url?: string
          ratio_key?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cc_asset_variant_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "cc_asset"
            referencedColumns: ["id"]
          },
        ]
      }
      cc_audit_event: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          payload: Json
          user_id: string
          workspace_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          payload?: Json
          user_id: string
          workspace_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          payload?: Json
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cc_audit_event_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "cc_workspace"
            referencedColumns: ["id"]
          },
        ]
      }
      cc_campaign_collection: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          provider_filter: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          provider_filter?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          provider_filter?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cc_campaign_collection_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "cc_workspace"
            referencedColumns: ["id"]
          },
        ]
      }
      cc_campaign_draft: {
        Row: {
          composer_mode: string
          created_at: string
          draft_payload: Json
          id: string
          lifecycle: string
          provider: string
          source_draft_id: string | null
          sync_state: Json
          title: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          composer_mode?: string
          created_at?: string
          draft_payload?: Json
          id?: string
          lifecycle?: string
          provider: string
          source_draft_id?: string | null
          sync_state?: Json
          title: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          composer_mode?: string
          created_at?: string
          draft_payload?: Json
          id?: string
          lifecycle?: string
          provider?: string
          source_draft_id?: string | null
          sync_state?: Json
          title?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cc_campaign_draft_source_draft_id_fkey"
            columns: ["source_draft_id"]
            isOneToOne: false
            referencedRelation: "cc_campaign_draft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cc_campaign_draft_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "cc_workspace"
            referencedColumns: ["id"]
          },
        ]
      }
      cc_collection_member: {
        Row: {
          added_at: string
          collection_id: string
          draft_id: string
        }
        Insert: {
          added_at?: string
          collection_id: string
          draft_id: string
        }
        Update: {
          added_at?: string
          collection_id?: string
          draft_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cc_collection_member_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "cc_campaign_collection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cc_collection_member_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "cc_campaign_draft"
            referencedColumns: ["id"]
          },
        ]
      }
      cc_launch_job: {
        Row: {
          attempt: number
          cancel_requested: boolean
          created_at: string
          draft_id: string
          id: string
          idempotency_key: string
          intent: string
          last_error: Json | null
          max_attempts: number
          next_run_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt?: number
          cancel_requested?: boolean
          created_at?: string
          draft_id: string
          id?: string
          idempotency_key: string
          intent?: string
          last_error?: Json | null
          max_attempts?: number
          next_run_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt?: number
          cancel_requested?: boolean
          created_at?: string
          draft_id?: string
          id?: string
          idempotency_key?: string
          intent?: string
          last_error?: Json | null
          max_attempts?: number
          next_run_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cc_launch_job_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "cc_campaign_draft"
            referencedColumns: ["id"]
          },
        ]
      }
      cc_launch_job_item: {
        Row: {
          created_at: string
          external_id: string | null
          id: string
          job_id: string
          provider: string
          provider_message: string | null
          provider_payload: Json | null
          retry_available: boolean
          status: string
          step_kind: string
          step_order: number
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          id?: string
          job_id: string
          provider: string
          provider_message?: string | null
          provider_payload?: Json | null
          retry_available?: boolean
          status: string
          step_kind: string
          step_order: number
        }
        Update: {
          created_at?: string
          external_id?: string | null
          id?: string
          job_id?: string
          provider?: string
          provider_message?: string | null
          provider_payload?: Json | null
          retry_available?: boolean
          status?: string
          step_kind?: string
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "cc_launch_job_item_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "cc_launch_job"
            referencedColumns: ["id"]
          },
        ]
      }
      cc_preview_snapshot: {
        Row: {
          created_at: string
          draft_id: string
          id: string
          payload: Json
          provider: string
          warnings: Json
        }
        Insert: {
          created_at?: string
          draft_id: string
          id?: string
          payload: Json
          provider: string
          warnings?: Json
        }
        Update: {
          created_at?: string
          draft_id?: string
          id?: string
          payload?: Json
          provider?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "cc_preview_snapshot_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "cc_campaign_draft"
            referencedColumns: ["id"]
          },
        ]
      }
      cc_workspace: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      competitor_reports: {
        Row: {
          compare_url: string | null
          competitor_id: string | null
          competitor_url: string
          created_at: string
          focus: Json | null
          id: string
          industry: string | null
          manual_text: string | null
          result: Json
          user_id: string
        }
        Insert: {
          compare_url?: string | null
          competitor_id?: string | null
          competitor_url: string
          created_at?: string
          focus?: Json | null
          id?: string
          industry?: string | null
          manual_text?: string | null
          result: Json
          user_id: string
        }
        Update: {
          compare_url?: string | null
          competitor_id?: string | null
          competitor_url?: string
          created_at?: string
          focus?: Json | null
          id?: string
          industry?: string | null
          manual_text?: string | null
          result?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_reports_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      competitors: {
        Row: {
          created_at: string
          id: string
          name: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_purchases: {
        Row: {
          amount_pln: number
          created_at: string
          credits_added: number
          environment: string
          id: string
          price_id: string
          stripe_session_id: string | null
          user_id: string
        }
        Insert: {
          amount_pln: number
          created_at?: string
          credits_added: number
          environment?: string
          id?: string
          price_id: string
          stripe_session_id?: string | null
          user_id: string
        }
        Update: {
          amount_pln?: number
          created_at?: string
          credits_added?: number
          environment?: string
          id?: string
          price_id?: string
          stripe_session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      credit_usage_log: {
        Row: {
          created_at: string
          credits_delta: number
          detail: Json | null
          id: string
          source: string
          usd_cents: number
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_delta?: number
          detail?: Json | null
          id?: string
          source: string
          usd_cents?: number
          user_id: string
        }
        Update: {
          created_at?: string
          credits_delta?: number
          detail?: Json | null
          id?: string
          source?: string
          usd_cents?: number
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_smtp_connections: {
        Row: {
          created_at: string
          from_email: string
          from_name: string | null
          id: string
          provider: string
          resend_api_key: string | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_secure: boolean | null
          smtp_username: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          from_email: string
          from_name?: string | null
          id?: string
          provider: string
          resend_api_key?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_username?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          from_email?: string
          from_name?: string | null
          id?: string
          provider?: string
          resend_api_key?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_username?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      generated_audios: {
        Row: {
          audio_url: string | null
          campaign_name: string | null
          created_at: string
          error_detail: string | null
          id: string
          product_name: string | null
          prompt: string
          status: string
          storage_path: string | null
          updated_at: string
          user_id: string
          user_reaction: string | null
          voice: string | null
          voice_name: string | null
        }
        Insert: {
          audio_url?: string | null
          campaign_name?: string | null
          created_at?: string
          error_detail?: string | null
          id?: string
          product_name?: string | null
          prompt: string
          status?: string
          storage_path?: string | null
          updated_at?: string
          user_id: string
          user_reaction?: string | null
          voice?: string | null
          voice_name?: string | null
        }
        Update: {
          audio_url?: string | null
          campaign_name?: string | null
          created_at?: string
          error_detail?: string | null
          id?: string
          product_name?: string | null
          prompt?: string
          status?: string
          storage_path?: string | null
          updated_at?: string
          user_id?: string
          user_reaction?: string | null
          voice?: string | null
          voice_name?: string | null
        }
        Relationships: []
      }
      generated_images: {
        Row: {
          campaign_name: string | null
          created_at: string
          feedback_note: string | null
          id: string
          image_url: string
          product_name: string | null
          prompt: string
          report_reason: string | null
          reported_at: string | null
          size: string | null
          storage_path: string | null
          user_id: string
          user_reaction: string | null
        }
        Insert: {
          campaign_name?: string | null
          created_at?: string
          feedback_note?: string | null
          id?: string
          image_url: string
          product_name?: string | null
          prompt: string
          report_reason?: string | null
          reported_at?: string | null
          size?: string | null
          storage_path?: string | null
          user_id: string
          user_reaction?: string | null
        }
        Update: {
          campaign_name?: string | null
          created_at?: string
          feedback_note?: string | null
          id?: string
          image_url?: string
          product_name?: string | null
          prompt?: string
          report_reason?: string | null
          reported_at?: string | null
          size?: string | null
          storage_path?: string | null
          user_id?: string
          user_reaction?: string | null
        }
        Relationships: []
      }
      generated_videos: {
        Row: {
          campaign_name: string | null
          created_at: string
          error_detail: string | null
          id: string
          product_name: string | null
          prompt: string
          runway_task_id: string | null
          status: string
          storage_path: string | null
          updated_at: string
          user_id: string
          user_reaction: string | null
          video_url: string | null
        }
        Insert: {
          campaign_name?: string | null
          created_at?: string
          error_detail?: string | null
          id?: string
          product_name?: string | null
          prompt: string
          runway_task_id?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
          user_id: string
          user_reaction?: string | null
          video_url?: string | null
        }
        Update: {
          campaign_name?: string | null
          created_at?: string
          error_detail?: string | null
          id?: string
          product_name?: string | null
          prompt?: string
          runway_task_id?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
          user_id?: string
          user_reaction?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      gmail_connections: {
        Row: {
          access_token: string
          created_at: string
          email: string
          id: string
          refresh_token: string | null
          scope: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          email: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          email?: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_ads_connections: {
        Row: {
          access_token: string
          created_at: string
          customer_accounts: Json
          email: string
          id: string
          last_synced_at: string | null
          login_customer_id: string | null
          refresh_token: string | null
          scope: string | null
          selected_customer_id: string | null
          status: string
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          customer_accounts?: Json
          email: string
          id?: string
          last_synced_at?: string | null
          login_customer_id?: string | null
          refresh_token?: string | null
          scope?: string | null
          selected_customer_id?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          customer_accounts?: Json
          email?: string
          id?: string
          last_synced_at?: string | null
          login_customer_id?: string | null
          refresh_token?: string | null
          scope?: string | null
          selected_customer_id?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_calendar_connections: {
        Row: {
          access_token: string
          created_at: string
          email: string
          id: string
          primary_calendar_id: string | null
          refresh_token: string | null
          scope: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          email: string
          id?: string
          primary_calendar_id?: string | null
          refresh_token?: string | null
          scope?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          email?: string
          id?: string
          primary_calendar_id?: string | null
          refresh_token?: string | null
          scope?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      klaviyo_connections: {
        Row: {
          created_at: string
          default_list_id: string | null
          from_email: string | null
          id: string
          private_api_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_list_id?: string | null
          from_email?: string | null
          id?: string
          private_api_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_list_id?: string | null
          from_email?: string | null
          id?: string
          private_api_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      linkedin_connections: {
        Row: {
          access_token: string
          ad_accounts: Json | null
          created_at: string
          id: string
          linkedin_user_id: string
          linkedin_user_name: string | null
          organizations: Json | null
          refresh_token: string | null
          refresh_token_expires_at: string | null
          scope: string | null
          selected_ad_account_id: string | null
          selected_organization_id: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          ad_accounts?: Json | null
          created_at?: string
          id?: string
          linkedin_user_id: string
          linkedin_user_name?: string | null
          organizations?: Json | null
          refresh_token?: string | null
          refresh_token_expires_at?: string | null
          scope?: string | null
          selected_ad_account_id?: string | null
          selected_organization_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          ad_accounts?: Json | null
          created_at?: string
          id?: string
          linkedin_user_id?: string
          linkedin_user_name?: string | null
          organizations?: Json | null
          refresh_token?: string | null
          refresh_token_expires_at?: string | null
          scope?: string | null
          selected_ad_account_id?: string | null
          selected_organization_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meta_connections: {
        Row: {
          access_token: string
          ad_accounts: Json | null
          created_at: string
          id: string
          meta_user_id: string
          meta_user_name: string | null
          pages: Json | null
          pixel_id: string | null
          selected_ad_account_id: string | null
          selected_page_id: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          ad_accounts?: Json | null
          created_at?: string
          id?: string
          meta_user_id: string
          meta_user_name?: string | null
          pages?: Json | null
          pixel_id?: string | null
          selected_ad_account_id?: string | null
          selected_page_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          ad_accounts?: Json | null
          created_at?: string
          id?: string
          meta_user_id?: string
          meta_user_name?: string | null
          pages?: Json | null
          pixel_id?: string | null
          selected_ad_account_id?: string | null
          selected_page_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      outlook_calendar_connections: {
        Row: {
          access_token: string
          created_at: string
          email: string
          id: string
          refresh_token: string | null
          scope: string | null
          tenant_id: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          email: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          tenant_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          email?: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          tenant_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      outlook_connections: {
        Row: {
          access_token: string
          created_at: string
          email: string
          id: string
          refresh_token: string | null
          scope: string | null
          tenant_id: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          email: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          tenant_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          email?: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          tenant_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          marketing_consent: boolean
          marketing_consent_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          marketing_consent?: boolean
          marketing_consent_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          marketing_consent?: boolean
          marketing_consent_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_viral_shorts: {
        Row: {
          author: string | null
          created_at: string
          id: string
          likes: number
          platform: string
          search_query: string | null
          thumbnail: string | null
          title: string | null
          url: string
          user_id: string
          views: number
        }
        Insert: {
          author?: string | null
          created_at?: string
          id?: string
          likes?: number
          platform: string
          search_query?: string | null
          thumbnail?: string | null
          title?: string | null
          url: string
          user_id: string
          views?: number
        }
        Update: {
          author?: string | null
          created_at?: string
          id?: string
          likes?: number
          platform?: string
          search_query?: string | null
          thumbnail?: string | null
          title?: string | null
          url?: string
          user_id?: string
          views?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tiktok_connections: {
        Row: {
          access_token: string
          advertiser_accounts: Json | null
          advertiser_name: string | null
          created_at: string
          id: string
          last_synced_at: string | null
          refresh_token: string | null
          refresh_token_expires_at: string | null
          scope: string | null
          selected_advertiser_id: string | null
          status: string
          tiktok_advertiser_id: string
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          advertiser_accounts?: Json | null
          advertiser_name?: string | null
          created_at?: string
          id?: string
          last_synced_at?: string | null
          refresh_token?: string | null
          refresh_token_expires_at?: string | null
          scope?: string | null
          selected_advertiser_id?: string | null
          status?: string
          tiktok_advertiser_id: string
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          advertiser_accounts?: Json | null
          advertiser_name?: string | null
          created_at?: string
          id?: string
          last_synced_at?: string | null
          refresh_token?: string | null
          refresh_token_expires_at?: string | null
          scope?: string | null
          selected_advertiser_id?: string | null
          status?: string
          tiktok_advertiser_id?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          balance: number
          current_plan: string
          free_ai_usage_usd_cents: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number
          current_plan?: string
          free_ai_usage_usd_cents?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number
          current_plan?: string
          free_ai_usage_usd_cents?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_notification_settings: {
        Row: {
          created_at: string
          id: string
          notify_campaign_launched: boolean
          notify_generation_ready: boolean
          notify_weekly_report: boolean
          notify_welcome: boolean
          updated_at: string
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notify_campaign_launched?: boolean
          notify_generation_ready?: boolean
          notify_weekly_report?: boolean
          notify_welcome?: boolean
          updated_at?: string
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notify_campaign_launched?: boolean
          notify_generation_ready?: boolean
          notify_weekly_report?: boolean
          notify_welcome?: boolean
          updated_at?: string
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_credits: {
        Args: { _amount: number; _user_id: string }
        Returns: undefined
      }
      admin_set_plan_by_email: {
        Args: { _credits: number; _email: string; _plan: string }
        Returns: string
      }
      apply_free_ai_usage_after_call:
        | {
            Args: {
              _fixed_credits: number
              _usd_cents: number
              _user_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _detail?: Json
              _fixed_credits?: number
              _source?: string
              _usd_cents: number
              _user_id: string
            }
            Returns: undefined
          }
      apply_plan_credits: {
        Args: { _new_credits: number; _new_plan: string; _user_id: string }
        Returns: undefined
      }
      assert_can_use_free_ai: { Args: { _user_id: string }; Returns: boolean }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_user_credits: { Args: never; Returns: undefined }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
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
