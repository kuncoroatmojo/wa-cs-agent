import { create } from 'zustand';
import type { WhatsAppInstance, Conversation } from '../types';
import { supabase } from '../lib/supabase';

interface WhatsAppStore {
  // State
  instances: WhatsAppInstance[];
  activeInstance: WhatsAppInstance | null;
  conversations: Conversation[];
  activeConversation: Conversation | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setInstances: (instances: WhatsAppInstance[]) => void;
  setActiveInstance: (instance: WhatsAppInstance | null) => void;
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (conversation: Conversation | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Async Actions
  fetchInstances: () => Promise<void>;
  createInstance: (data: Partial<WhatsAppInstance>) => Promise<{ success: boolean; error?: string }>;
  updateInstance: (id: string, data: Partial<WhatsAppInstance>) => Promise<{ success: boolean; error?: string }>;
  deleteInstance: (id: string) => Promise<{ success: boolean; error?: string }>;
  
  fetchConversations: (instanceId?: string) => Promise<void>;
  sendMessage: (instanceId: string, to: string, message: string) => Promise<{ success: boolean; error?: string }>;
  
  // Real-time subscriptions
  subscribeToInstances: () => () => void;
  subscribeToConversations: () => () => void;
}

export const useWhatsAppStore = create<WhatsAppStore>((set, get) => ({
  // Initial state
  instances: [],
  activeInstance: null,
  conversations: [],
  activeConversation: null,
  isLoading: false,
  error: null,

  // Actions
  setInstances: (instances) => set({ instances }),
  setActiveInstance: (activeInstance) => set({ activeInstance }),
  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (activeConversation) => set({ activeConversation }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  // Async Actions
  fetchInstances: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const instances: WhatsAppInstance[] = data.map(item => ({
        id: item.id,
        name: item.name,
        status: item.status,
        connectionType: item.connection_type,
        phoneNumber: item.phone_number,
        qrCode: item.qr_code,
        lastSeen: item.last_connected_at,
        userId: item.user_id,
        settings: item.settings,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }));

      set({ instances, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch instances',
        isLoading: false 
      });
    }
  },

  createInstance: async (data) => {
    set({ isLoading: true, error: null });
    
    try {
      const instanceKey = `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const insertData = {
        name: data.name || '',
        connection_type: data.connectionType || 'baileys',
        user_id: data.userId || '',
        instance_key: instanceKey,
        settings: data.settings || {
          autoReply: true,
          businessHours: {
            enabled: false,
            timezone: 'UTC',
            schedule: {}
          },
          welcomeMessage: 'Hello! How can I help you today?',
          outOfHoursMessage: 'We are currently closed. Please try again during business hours.',
          humanHandoffKeywords: ['human', 'agent', 'support'],
          maxResponseTime: 30
        }
      };

      console.log('Creating WhatsApp instance with data:', insertData);

      const { data: instance, error } = await supabase
        .from('whatsapp_instances')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        throw error;
      }

      console.log('WhatsApp instance created successfully:', instance);

      // For Baileys connections, immediately start the connection to generate QR code
      if ((data.connectionType || 'baileys') === 'baileys') {
        try {
          const connectResponse = await supabase.functions.invoke('whatsapp-connect', {
            body: { 
              integration_id: instance.id, 
              action: 'connect' 
            }
          });

          if (connectResponse.error) {
            console.error('Failed to start WhatsApp connection:', connectResponse.error);
            // Don't fail the entire operation, just log the error
          } else {
            console.log('WhatsApp connection started:', connectResponse.data);
          }
        } catch (connectError) {
          console.error('Failed to call whatsapp-connect function:', connectError);
          // Don't fail the entire operation, just log the error
        }
      }

      // Refresh instances to get the latest status including any QR code
      await get().fetchInstances();
      
      set({ isLoading: false });
      return { success: true };
    } catch (error) {
      console.error('Create instance error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create instance';
      set({ error: errorMessage, isLoading: false });
      return { success: false, error: errorMessage };
    }
  },

  updateInstance: async (id, data) => {
    set({ isLoading: true, error: null });
    
    try {
      const { error } = await supabase
        .from('whatsapp_instances')
        .update({
          ...(data.name && { name: data.name }),
          ...(data.status && { status: data.status }),
          ...(data.phoneNumber && { phone_number: data.phoneNumber }),
          ...(data.qrCode && { qr_code: data.qrCode }),
          ...(data.settings && { settings: data.settings }),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      // Refresh instances
      await get().fetchInstances();
      
      set({ isLoading: false });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update instance';
      set({ error: errorMessage, isLoading: false });
      return { success: false, error: errorMessage };
    }
  },

  deleteInstance: async (id) => {
    set({ isLoading: true, error: null });
    
    try {
      const { error } = await supabase
        .from('whatsapp_instances')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Remove from local state
      const { instances, activeInstance } = get();
      const updatedInstances = instances.filter(instance => instance.id !== id);
      const updatedActiveInstance = activeInstance?.id === id ? null : activeInstance;
      
      set({ 
        instances: updatedInstances,
        activeInstance: updatedActiveInstance,
        isLoading: false 
      });
      
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete instance';
      set({ error: errorMessage, isLoading: false });
      return { success: false, error: errorMessage };
    }
  },

  fetchConversations: async (instanceId) => {
    set({ isLoading: true, error: null });
    
    try {
      let query = supabase
        .from('conversations')
        .select(`
          *,
          messages(*)
        `)
        .order('last_message_at', { ascending: false });

      if (instanceId) {
        query = query.eq('instance_id', instanceId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const conversations: Conversation[] = data.map(item => ({
        id: item.id,
        instanceId: item.instance_id,
        contactPhone: item.contact_phone,
        contactName: item.contact_name,
        status: item.status,
        assignedAgent: item.assigned_agent,
        tags: item.tags || [],
        priority: item.priority,
        messages: item.messages?.map((msg: any) => ({
          id: msg.id,
          instanceId: msg.instance_id,
          from: msg.from_phone,
          to: msg.to_phone,
          body: msg.body,
          type: msg.type,
          timestamp: msg.timestamp,
          status: msg.status,
          isFromBot: msg.is_from_bot,
          metadata: msg.metadata
        })) || [],
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        lastMessageAt: item.last_message_at
      }));

      set({ conversations, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch conversations',
        isLoading: false 
      });
    }
  },

  sendMessage: async (instanceId, to, message) => {
    try {
      // Here you would call your Evolution API endpoint
      // For now, we'll simulate sending via edge function
      const response = await fetch('/api/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceId,
          to,
          message
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      return { success: false, error: errorMessage };
    }
  },

  subscribeToInstances: () => {
    const subscription = supabase
      .channel('whatsapp_instances')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_instances'
        },
        () => {
          // Refresh instances when changes occur
          get().fetchInstances();
        }
      )
      .subscribe();

    return () => supabase.removeChannel(subscription);
  },

  subscribeToConversations: () => {
    const subscription = supabase
      .channel('conversations')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations'
      }, () => {
        // Refresh conversations when changes occur
        get().fetchConversations();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }
})); 