import { createClient } from '@supabase/supabase-js';

// Environment variables - these should be set in your .env file
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

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
          qr_code?: string;
          last_seen?: string;
          user_id: string;
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
          qr_code?: string;
          last_seen?: string;
          user_id: string;
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
          last_seen?: string;
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

// Helper functions for common operations
export const auth = {
  signUp: async (email: string, password: string, metadata?: any) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    });
    return { data, error };
  },
  
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { data, error };
  },
  
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  },
  
  getUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
  },
  
  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    return supabase.auth.onAuthStateChange(callback);
  }
};

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
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: count
    });
    return { data, error };
  }
};

export default supabase; 