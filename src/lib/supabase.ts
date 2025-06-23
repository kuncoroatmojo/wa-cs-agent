import { createClient } from '@supabase/supabase-js';
import type { Database as SupabaseDatabase } from '../types/database';

// Environment variables - these should be set in your .env file
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Better error handling for missing environment variables
if (!supabaseUrl) {
}

if (!supabaseAnonKey) {
}

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create Supabase client with fallback for development
export const supabase = createClient<SupabaseDatabase>(supabaseUrl, supabaseAnonKey);

// Auth helpers
export const auth = supabase.auth;

// Real-time subscriptions helper
export const subscribeToTable = (
  table: keyof SupabaseDatabase['public']['Tables'],
  callback: (payload: any) => void,
  filter?: string
) => {
  return supabase
    .channel(`${String(table)}_changes`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: String(table),
        filter
      },
      callback
    )
    .subscribe();
};

// Storage helpers
export const storage = supabase.storage;
export const documentsStorage = storage.from('documents');

// Edge Functions helpers
export const functions = supabase.functions;

// Database types for better TypeScript support
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          avatar?: string;
          role: 'admin' | 'user' | 'agent';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          avatar?: string;
          role?: 'admin' | 'user' | 'agent';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          avatar?: string;
          role?: 'admin' | 'user' | 'agent';
          updated_at?: string;
        };
      };
      whatsapp_instances: {
        Row: {
          id: string;
          name: string;
          status: 'connected' | 'disconnected' | 'connecting' | 'error';
          connection_type: 'baileys' | 'cloud_api';
          phone_number?: string;
          instance_key: string;
          qr_code?: string;
          last_connected_at?: string;
          user_id: string;
          credentials: any;
          settings: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          status?: 'connected' | 'disconnected' | 'connecting' | 'error';
          connection_type: 'baileys' | 'cloud_api';
          phone_number?: string;
          instance_key: string;
          qr_code?: string;
          last_connected_at?: string;
          user_id: string;
          credentials?: any;
          settings?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          status?: 'connected' | 'disconnected' | 'connecting' | 'error';
          connection_type?: 'baileys' | 'cloud_api';
          phone_number?: string;
          qr_code?: string;
          last_connected_at?: string;
          credentials?: any;
          settings?: any;
          updated_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          title: string;
          content: string;
          source: 'google_drive' | 'manual_upload' | 'web_scrape';
          source_id?: string;
          metadata: any;
          embedding?: number[];
          user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          content: string;
          source: 'google_drive' | 'manual_upload' | 'web_scrape';
          source_id?: string;
          metadata?: any;
          embedding?: number[];
          user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          content?: string;
          source?: 'google_drive' | 'manual_upload' | 'web_scrape';
          source_id?: string;
          metadata?: any;
          embedding?: number[];
          updated_at?: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          instance_id: string;
          contact_phone: string;
          contact_name?: string;
          status: 'active' | 'resolved' | 'handed_off' | 'archived';
          assigned_agent?: string;
          tags: string[];
          priority: 'low' | 'medium' | 'high';
          created_at: string;
          updated_at: string;
          last_message_at: string;
        };
        Insert: {
          id?: string;
          instance_id: string;
          contact_phone: string;
          contact_name?: string;
          status?: 'active' | 'resolved' | 'handed_off' | 'archived';
          assigned_agent?: string;
          tags?: string[];
          priority?: 'low' | 'medium' | 'high';
          created_at?: string;
          updated_at?: string;
          last_message_at?: string;
        };
        Update: {
          id?: string;
          contact_name?: string;
          status?: 'active' | 'resolved' | 'handed_off' | 'archived';
          assigned_agent?: string;
          tags?: string[];
          priority?: 'low' | 'medium' | 'high';
          updated_at?: string;
          last_message_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          instance_id: string;
          conversation_id: string;
          from_phone: string;
          to_phone: string;
          body: string;
          type: 'text' | 'image' | 'audio' | 'video' | 'document';
          timestamp: string;
          status: 'sent' | 'delivered' | 'read' | 'failed';
          is_from_bot: boolean;
          metadata?: any;
          created_at: string;
        };
        Insert: {
          id?: string;
          instance_id: string;
          conversation_id: string;
          from_phone: string;
          to_phone: string;
          body: string;
          type?: 'text' | 'image' | 'audio' | 'video' | 'document';
          timestamp?: string;
          status?: 'sent' | 'delivered' | 'read' | 'failed';
          is_from_bot?: boolean;
          metadata?: any;
          created_at?: string;
        };
        Update: {
          id?: string;
          body?: string;
          status?: 'sent' | 'delivered' | 'read' | 'failed';
          metadata?: any;
        };
      };
      rag_configs: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string;
          model: 'gpt-4' | 'gpt-3.5-turbo' | 'claude-3-sonnet';
          temperature: number;
          max_tokens: number;
          system_prompt: string;
          tools: any[];
          document_sources: string[];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string;
          model?: 'gpt-4' | 'gpt-3.5-turbo' | 'claude-3-sonnet';
          temperature?: number;
          max_tokens?: number;
          system_prompt?: string;
          tools?: any[];
          document_sources?: string[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          model?: 'gpt-4' | 'gpt-3.5-turbo' | 'claude-3-sonnet';
          temperature?: number;
          max_tokens?: number;
          system_prompt?: string;
          tools?: any[];
          document_sources?: string[];
          is_active?: boolean;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      match_documents: {
        Args: {
          query_embedding: number[];
          match_threshold?: number;
          match_count?: number;
        };
        Returns: {
          id: string;
          content: string;
          metadata: any;
          similarity: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Edge Functions helper
export const edgeFunctions = {
  invoke: async <T = any>(functionName: string, data?: any): Promise<{ data: T | null; error: any }> => {
    try {
      const { data: result, error } = await supabase.functions.invoke(functionName, {
        body: data
      });
      return { data: result, error };
    } catch (error) {
      return { data: null, error };
    }
  }
};

// Vector search helper
export const vectorSearch = {
  matchDocuments: async (
    queryEmbedding: number[],
    threshold = 0.8,
    count = 10
  ) => {
    try {
      const { data, error } = await supabase.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: count
      });
      return { data, error };
    } catch (error) {
      console.error('Vector search error:', error);
      return { data: null, error: { message: 'Vector search service unavailable' } };
    }
  }
};

export default supabase; 