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
          email: string
          full_name: string | null
          avatar_url: string | null
          role: string
          whatsapp_target_instance: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          role?: string
          whatsapp_target_instance?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          role?: string
          whatsapp_target_instance?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      ai_configurations: {
        Row: {
          id: string
          user_id: string
          name: string
          provider: string
          api_key: string
          model_name: string
          temperature: number
          max_tokens: number
          system_prompt: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          provider?: string
          api_key: string
          model_name?: string
          temperature?: number
          max_tokens?: number
          system_prompt?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          provider?: string
          api_key?: string
          model_name?: string
          temperature?: number
          max_tokens?: number
          system_prompt?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      chat_sessions: {
        Row: {
          id: string
          user_id: string
          sender_id: string
          sender_name: string | null
          sender_type: string
          session_metadata: Json
          last_message_at: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          sender_id: string
          sender_name?: string | null
          sender_type: string
          session_metadata?: Json
          last_message_at?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          sender_id?: string
          sender_name?: string | null
          sender_type?: string
          session_metadata?: Json
          last_message_at?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          session_id: string
          role: string
          content: string
          message_type: string
          metadata: Json
          tokens_used: number | null
          model_used: string | null
          confidence_score: number | null
          response_time_ms: number | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          role: string
          content: string
          message_type?: string
          metadata?: Json
          tokens_used?: number | null
          model_used?: string | null
          confidence_score?: number | null
          response_time_ms?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          role?: string
          content?: string
          message_type?: string
          metadata?: Json
          tokens_used?: number | null
          model_used?: string | null
          confidence_score?: number | null
          response_time_ms?: number | null
          created_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          user_id: string
          title: string
          content: string | null
          file_path: string | null
          file_type: string | null
          file_size: number | null
          folder_path: string
          upload_date: string
          processed_date: string | null
          status: string
          error_message: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          content?: string | null
          file_path?: string | null
          file_type?: string | null
          file_size?: number | null
          folder_path?: string
          upload_date?: string
          processed_date?: string | null
          status?: string
          error_message?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          content?: string | null
          file_path?: string | null
          file_type?: string | null
          file_size?: number | null
          folder_path?: string
          upload_date?: string
          processed_date?: string | null
          status?: string
          error_message?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      web_pages: {
        Row: {
          id: string
          user_id: string
          url: string
          title: string | null
          content: string | null
          scraped_at: string | null
          status: string
          include_children: boolean
          max_depth: number
          error_message: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          url: string
          title?: string | null
          content?: string | null
          scraped_at?: string | null
          status?: string
          include_children?: boolean
          max_depth?: number
          error_message?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          url?: string
          title?: string | null
          content?: string | null
          scraped_at?: string | null
          status?: string
          include_children?: boolean
          max_depth?: number
          error_message?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      document_embeddings: {
        Row: {
          id: string
          user_id: string
          source_id: string
          source_type: string
          chunk_text: string
          chunk_index: number
          embedding: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          source_id: string
          source_type: string
          chunk_text: string
          chunk_index: number
          embedding: string
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          source_id?: string
          source_type?: string
          chunk_text?: string
          chunk_index?: number
          embedding?: string
          metadata?: Json
          created_at?: string
        }
      }
      whatsapp_integrations: {
        Row: {
          id: string
          user_id: string
          name: string
          connection_type: string
          phone_number: string | null
          instance_key: string
          qr_code: string | null
          status: string
          credentials: Json
          settings: Json
          last_connected_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          connection_type: string
          phone_number?: string | null
          instance_key: string
          qr_code?: string | null
          status?: string
          credentials?: Json
          settings?: Json
          last_connected_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          connection_type?: string
          phone_number?: string | null
          instance_key?: string
          qr_code?: string | null
          status?: string
          credentials?: Json
          settings?: Json
          last_connected_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      external_integrations: {
        Row: {
          id: string
          user_id: string
          name: string
          integration_type: string
          api_key: string | null
          webhook_url: string | null
          settings: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          integration_type: string
          api_key?: string | null
          webhook_url?: string | null
          settings?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          integration_type?: string
          api_key?: string | null
          webhook_url?: string | null
          settings?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_usage_metrics: {
        Args: {
          user_id: string
          time_range?: string
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
} 