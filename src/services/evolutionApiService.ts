import { supabase } from '../lib/supabase';
import type { Conversation, WhatsAppInstance } from '../types';
import { ConversationService } from './conversationService';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

export interface EvolutionApiConfig {
  baseUrl: string;
  apiKey: string;
  instanceName?: string;
}

export interface EvolutionInstance {
  instanceName: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'CLOSED' | 'CONNECTING';
  qrcode?: string;
  number?: string;
  owner?: string;
  webhook?: string;
}

export interface EvolutionMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: {
      text?: string;
    };
    [key: string]: any; // For other message types like reactionMessage
  };
  messageType: string;
  messageTimestamp: number;
  owner?: string;
  source?: string;
  status?: string;
  participant?: string;
  // Add any other fields that might exist
  [key: string]: any;
}

export interface EvolutionChat {
  id: string;
  name?: string;
  isGroup: boolean;
  isWhatsAppBusiness: boolean;
  contact?: {
    id: string;
    name?: string;
    pushName?: string;
    profilePictureUrl?: string;
  };
  lastMessage?: {
    messageId: string;
    fromMe: boolean;
    messageType: string;
    messageTimestamp: number;
    message: {
      conversation?: string;
      extendedTextMessage?: {
        text: string;
      };
    };
  };
  unreadCount?: number;
}

export class EvolutionApiService {
  private baseUrl: string;
  private apiKey: string;
  private config: EvolutionApiConfig | null = null;
  private messageCache: Map<string, EvolutionMessage[]> = new Map(); // Cache messages by instanceKey

  constructor(baseUrl?: string, apiKey?: string) {
    // Allow injection of baseUrl and apiKey for scripts
    this.baseUrl = baseUrl || (typeof window !== 'undefined' ? import.meta.env.VITE_EVOLUTION_API_URL : process.env.VITE_EVOLUTION_API_URL) || '';
    this.apiKey = apiKey || (typeof window !== 'undefined' ? import.meta.env.VITE_EVOLUTION_API_KEY : process.env.VITE_EVOLUTION_API_KEY) || '';

    if (!this.baseUrl || !this.apiKey) {
      throw new Error('Missing Evolution API configuration');
    }
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      'apikey': this.apiKey
    };
  }

  // Load configuration from environment variables
  private loadConfigFromEnv() {
    const envUrl = import.meta.env.VITE_EVOLUTION_API_URL;
    const envKey = import.meta.env.VITE_EVOLUTION_API_KEY;
    
    if (envUrl && envKey) {
      this.config = {
        baseUrl: envUrl,
        apiKey: envKey
      };
    }
  }

  // Set Evolution API configuration
  setConfig(config: EvolutionApiConfig) {
    this.config = config;
  }

  // Get current configuration
  getConfig(): EvolutionApiConfig | null {
    return this.config;
  }

  // Debug method to show current config (for curl testing)
  debugConfig() {
    if (this.config) {
      console.log('🔑 Current Evolution API Config:', {
        baseUrl: this.config.baseUrl,
        apiKey: this.config.apiKey,
        hasConfig: !!this.config
      });
      return this.config;
    } else {
      return null;
    }
  }

  // Check if Evolution API is configured and accessible
  async isConfigured(): Promise<boolean> {
    if (!this.config) return false;
    
    try {
      const response = await this.makeRequest('/instance/fetchInstances', 'GET');
      return response.ok;
    } catch (error) { 
      console.error('Evolution API not accessible:', error);
      return false;
    }
  }

  // Make HTTP request to Evolution API
  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', body?: any) {
    if (!this.config) {
      throw new Error('Evolution API not configured');
    }

    const url = `${this.config.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': this.config.apiKey,
    };


    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Evolution API error: ${response.status} - ${errorText}`);
    }

    return response;
  }

  // Fetch all instances from Evolution API
  async fetchInstances(): Promise<EvolutionInstance[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/instance/fetchInstances`, {
        headers: this.headers
      });
      return response.data.instances || [];
    } catch (error) { 
      console.error('Error fetching instances:', error);
      return [];
    }
  }

  // Create a new instance
  async createInstance(instanceName: string, token?: string, qrcode: boolean = true): Promise<EvolutionInstance> {
    try {
      
      const webhookUrl = `${import.meta.env.SUPABASE_URL}/functions/v1/whatsapp-webhook`;
      
      // First create the instance without webhook
      const body = {
        instanceName,
        token,
        qrcode,
        integration: 'WHATSAPP-BAILEYS'
      };

      
      const response = await this.makeRequest('/instance/create', 'POST', body);
      const instance = await response.json();
      

      // Wait a bit to ensure instance is properly initialized
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Set up the webhook
      try {
        await this.setupWebhook(instanceName, webhookUrl);
      } catch (error) { 
        console.error('❌ Failed to set up webhook:', webhookError);
        // Don't throw here, we want to return the instance even if webhook setup fails
      }

      // Return the instance
      return instance;
    } catch (error) { 
      console.error('Failed to create Evolution API instance:', error);
      throw error;
    }
  }

  // Delete an instance
  async deleteInstance(instanceName: string): Promise<boolean> {
    try {
      
      // Delete the instance from Evolution API
      await this.makeRequest(`/instance/delete/${instanceName}`, 'DELETE');

      // Delete associated conversations and their messages
      const conversationService = new ConversationService();
      await conversationService.deleteInstanceConversations(instanceName);

      return true;
    } catch (error) { 
      console.error(`Error deleting instance ${instanceName}:`, error);
      return false;
    }
  }

  // Get instance connection state
  async getInstanceState(instanceName: string): Promise<any> {
    try {
      const response = await this.makeRequest(`/instance/connectionState/${instanceName}`, 'GET');
      return await response.json();
    } catch (error) { 
      console.error(`Failed to get state for instance ${instanceName}:`, error);
      return null;
    }
  }

  // Get QR code for instance
  async getQRCode(instanceName: string): Promise<{ code: string; base64: string } | null> {
    try {
      const response = await this.makeRequest(`/instance/connect/${instanceName}`, 'GET');
      const result = await response.json();
      
      if (result.qrcode) {
        return result.qrcode;
      }
      return null;
    } catch (error) { 
      console.error(`Failed to get QR code for instance ${instanceName}:`, error);
      return null;
    }
  }

  // Connect instance (generate QR code)
  async connectInstance(instanceName: string): Promise<{ qrcode?: { code: string; base64: string } }> {
    const response = await this.makeRequest(`/instance/connect/${instanceName}`, 'GET');
    const result = await response.json();
    
    return result;
  }

  // Disconnect instance
  async disconnectInstance(instanceName: string): Promise<void> {
    await this.makeRequest(`/instance/logout/${instanceName}`, 'DELETE');
  }

  // Send text message
  async sendTextMessage(instanceName: string, number: string, text: string): Promise<any> {
    try {
      const response = await this.makeRequest(`/message/sendText/${instanceName}`, 'POST', {
        number,
        options: {
          delay: 1000,
          presence: "composing"
        },
        textMessage: {
          text
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.status}`);
      }

      return await response.json();
    } catch (error) { 
      console.error('Failed to send text message:', error);
      throw error;
    }
  }

  // Test method to check available endpoints
  async testEndpoints(instanceName: string): Promise<any> {
    try {
      
      // Test instance status first
      const statusResponse = await this.makeRequest(`/instance/connectionState/${instanceName}`, 'GET');
      const status = await statusResponse.json();
      
      return status;
    } catch (error) { 
      console.error('Error testing endpoints:', error);
      return null;
    }
  }

  // Fetch all chats/conversations for an instance
  async fetchChats(instanceName: string): Promise<EvolutionChat[]> {
    try {
      
      const response = await this.makeRequest(`/chat/findChats/${instanceName}`, 'GET');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch chats: ${response.status}`);
      }

      const chats = await response.json();
      
      if (!Array.isArray(chats)) {
        return [];
      }

      // Map the response to our EvolutionChat type
      const mappedChats: EvolutionChat[] = chats.map(chat => ({
        id: chat.id,
        name: chat.name || chat.contact?.name || chat.contact?.pushName,
        isGroup: chat.isGroup || false,
        isWhatsAppBusiness: chat.isWhatsAppBusiness || false,
        contact: chat.contact ? {
          id: chat.contact.id,
          name: chat.contact.name,
          pushName: chat.contact.pushName,
          profilePictureUrl: chat.contact.profilePictureUrl
        } : undefined,
        lastMessage: chat.lastMessage ? {
          messageId: chat.lastMessage.key?.id,
          fromMe: chat.lastMessage.key?.fromMe || false,
          messageType: this.determineMessageType(chat.lastMessage),
          messageTimestamp: chat.lastMessage.messageTimestamp,
          message: {
            conversation: chat.lastMessage.message?.conversation,
            extendedTextMessage: chat.lastMessage.message?.extendedTextMessage
          }
        } : undefined,
        unreadCount: chat.unreadCount
      }));

      return mappedChats;
    } catch (error) { 
      console.error('Failed to fetch chats:', error);
      return [];
    }
  }

  /**
   * Load messages for a specific conversation
   */
  async loadConversationMessages(remoteJid: string, instanceName: string): Promise<any[]> {
    try {
      // First sync messages with our database
      await this.syncMessagesWithDatabase(instanceName, remoteJid);

      // Get messages from our database
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('external_conversation_id', remoteJid)
        .eq('instance_key', instanceName)
        .limit(1);

      if (!conversations || conversations.length === 0) {
        console.error('❌ No conversation found for', { instanceName, remoteJid });
        return [];
      }

      const conversation = conversations[0];

      const { data: messages, error } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('external_timestamp', { ascending: false })
        .limit(100);

      if (error) {
        console.error('❌ Error fetching messages from database:', error);
        return [];
      }

      return messages || [];
    } catch (error) { 
      console.error('Error loading conversation messages:', error);
      return [];
    }
  }

  async loadAllMessagesForInstance(instanceName: string): Promise<EvolutionMessage[]> {
    try {
      // First get all chats
      const chats = await this.fetchChats(instanceName);
      if (!chats || chats.length === 0) {
        return [];
      }

      
      // Use chat/findMessages endpoint to get all messages
      try {
        
        const response = await this.makeRequest(`/chat/findMessages/${instanceName}`, 'POST', {
          where: {},
          limit: 100 // Adjust based on your needs
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch messages: ${response.status}`);
        }

        const messages = await response.json();
        
        if (!Array.isArray(messages)) {
          return [];
        }

        // Process and organize messages
        const processedMessages = messages
          .filter(msg => msg && msg.key && msg.key.remoteJid) // Filter out invalid messages
          .map(msg => ({
            ...msg,
            messageType: this.determineMessageType(msg),
            messageTimestamp: msg.messageTimestamp || msg.timestamp || 0
          }));

        // Update cache
        this.messageCache.set(instanceName, processedMessages);
        
        return processedMessages;

      } catch (error) { 
        console.error(`Failed to fetch messages for instance ${instanceName}:`, error);
        return [];
      }
    } catch (error) { 
      console.error('Failed to load all messages:', error);
      return [];
    }
  }

  private determineMessageType(msg: any): string {
    if (!msg.message) return 'unknown';
    
    // Check message type based on message content
    if (msg.message.conversation) return 'text';
    if (msg.message.imageMessage) return 'image';
    if (msg.message.videoMessage) return 'video';
    if (msg.message.audioMessage) return 'audio';
    if (msg.message.documentMessage) return 'document';
    if (msg.message.stickerMessage) return 'sticker';
    if (msg.message.contactMessage) return 'contact';
    if (msg.message.locationMessage) return 'location';
    if (msg.message.extendedTextMessage) return 'text';
    if (msg.message.reactionMessage) return 'reaction';
    
    return 'unknown';
  }

  // Clear message cache for an instance (useful for refreshing)
  clearMessageCache(instanceName?: string) {
    if (instanceName) {
      this.messageCache.delete(instanceName);
    } else {
      this.messageCache.clear();
    }
  }

  async fetchMessages(instanceName: string, remoteJid: string, limit = 100): Promise<any[]> {
    try {
      const response = await this.makeRequest(`/chat/findMessages/${instanceName}`, 'POST', {
        where: {
          key: {
            remoteJid
          }
        },
        limit
      });

      return response.ok ? await response.json() : [];
    } catch (error) { 
      console.error('Error fetching messages:', error);
      return [];
    }
  }

  async syncMessagesWithDatabase(instanceName: string, remoteJid: string): Promise<void> {
    try {
      
      // Get messages from Evolution API
      const messages = await this.fetchMessages(instanceName, remoteJid, 100);
      
      // Get the conversation ID from our database
      const { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('external_conversation_id', remoteJid)
        .eq('instance_key', instanceName)
        .single();
        
      if (!conversation) {
        console.error('❌ No conversation found for', { instanceName, remoteJid });
        return;
      }

      // Convert Evolution messages to our database format
      const dbMessages = messages.map(msg => ({
        conversation_id: conversation.id,
        content: msg.message?.conversation || msg.message?.extendedTextMessage?.text || '',
        message_type: 'text', // We'll need to handle other types later
        direction: msg.key.fromMe ? 'outbound' : 'inbound',
        sender_type: msg.key.fromMe ? 'agent' : 'contact',
        sender_name: msg.pushName || '',
        sender_id: msg.key.remoteJid,
        status: 'delivered', // We'll need proper status mapping later
        external_message_id: msg.key.id,
        external_timestamp: new Date(msg.messageTimestamp * 1000).toISOString(),
        external_metadata: msg
      }));

      // Insert messages into our database
      const { error } = await supabase
        .from('conversation_messages')
        .upsert(dbMessages, {
          onConflict: 'external_message_id',
          ignoreDuplicates: true
        });

      if (error) {
        console.error('❌ Error syncing messages:', error);
        throw error;
      }

    } catch (error) { 
      console.error('❌ Error in syncMessagesWithDatabase:', error);
      throw error;
    }
  }

  // Get contact info
  async getContactInfo(instanceName: string, remoteJid: string): Promise<any> {
    try {
      const body = {
        numbers: [remoteJid]
      };

      const response = await this.makeRequest(`/chat/whatsappNumbers/${instanceName}`, 'POST', body);
      const contactInfo = await response.json();
      
      return contactInfo;
    } catch (error) { 
      console.error(`Failed to fetch contact info for ${remoteJid}:`, error);
      return null;
    }
  }

  // Fetch all conversations with messages for connected instances
  async fetchAllConversations(): Promise<{ instanceName: string; conversations: Conversation[] }[]> {
    try {
      // Clear message cache to force fresh load
      this.clearMessageCache();

      // Get connected instances from our database/store
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return [];
      }

      const { data: instances, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('user_id', user.id)
        .eq('connection_type', 'evolution_api')
        .eq('status', 'connected');

      if (error) {
        console.error('Failed to fetch connected instances:', error);
        return [];
      }

      if (!instances || instances.length === 0) {
        return [];
      }


      const allConversations = await Promise.all(
        instances.map(async (instance) => {
          try {
            
            // Test the instance first
            const testResult = await this.testEndpoints(instance.instance_key);
            if (!testResult) {
              return {
                instanceName: instance.name || instance.instance_key,
                conversations: []
              };
            }

            // 1. Load ALL messages for this instance first (this will cache them)
            const allMessages = await this.loadAllMessagesForInstance(instance.instance_key);
            
            if (allMessages.length === 0) {
              return {
                instanceName: instance.name || instance.instance_key,
                conversations: []
              };
            }
            
            // 2. Get chat list for contact names (optional, for better contact info)
            const chats = await this.fetchChats(instance.instance_key);
            
            // Create a map of remoteJid to chat info for quick lookup
            const chatMap = new Map<string, any>();
            chats.forEach(chat => {
              chatMap.set(chat.id, chat);
            });
            
            // 3. Build conversations from messages (message-driven approach)
            const conversationMap = new Map<string, {
              remoteJid: string;
              messages: any[];
              contactInfo?: any;
            }>();
            
            // Group messages by remoteJid
            allMessages.forEach(msg => {
              const remoteJid = msg.key?.remoteJid;
              if (!remoteJid) return;
              
              if (!conversationMap.has(remoteJid)) {
                conversationMap.set(remoteJid, {
                  remoteJid,
                  messages: [],
                  contactInfo: chatMap.get(remoteJid)
                });
              }
              
              conversationMap.get(remoteJid)!.messages.push(msg);
            });
            
            
            // 4. Convert to Conversation objects
            const conversations: Conversation[] = await Promise.all(
              Array.from(conversationMap.values())
                .map(async ({ remoteJid, messages, contactInfo }) => {
                  try {
                    // Extract phone number from JID
                    const phoneNumber = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
                    
                    // Get contact name with multiple fallbacks
                    let contactName = `+${phoneNumber}`; // Default to phone number
                    
                    // 1. Try to get name from chat info first
                    if (contactInfo) {
                      const possibleNames = [
                        contactInfo.name?.trim(),
                        contactInfo.contact?.name?.trim(),
                        contactInfo.contact?.pushName?.trim(),
                        contactInfo.pushName?.trim()
                      ].filter(Boolean);
                      
                      if (possibleNames.length > 0) {
                        contactName = possibleNames[0];
                      }
                    }
                    
                    // 2. If no name from chat info, try to get from messages
                    if (contactName === `+${phoneNumber}` && messages.length > 0) {
                      // First try messages with pushName
                      const messageWithPushName = messages.find(msg => 
                        !msg.key.fromMe && // Only from contact
                        msg.pushName && 
                        msg.pushName.trim()
                      );
                      
                      if (messageWithPushName?.pushName) {
                        contactName = messageWithPushName.pushName.trim();
                      } else {
                        // Try to find name in message content (some messages include "Name ~" format)
                        const messageWithName = messages.find(msg => 
                          !msg.key.fromMe &&
                          msg.message?.conversation?.includes('~')
                        );
                        
                        if (messageWithName?.message?.conversation) {
                          const nameParts = messageWithName.message.conversation.split('~');
                          if (nameParts.length > 1 && nameParts[0].trim()) {
                            contactName = nameParts[0].trim();
                          }
                        }
                      }
                    }
                    
                    // 3. Try to get contact info directly as last resort
                    if (contactName === `+${phoneNumber}`) {
                      try {
                        const directContactInfo = await this.getContactInfo(instance.instance_key, remoteJid);
                        if (directContactInfo?.name || directContactInfo?.pushName) {
                          contactName = (directContactInfo.name || directContactInfo.pushName).trim();
                        }
                      } catch (error) {
                        console.error("Failed to get direct contact info:", error);
                      }
                    }
                    
                    // Sort messages by timestamp and get the most recent
                    const sortedMessages = messages.sort((a, b) => 
                      (b.messageTimestamp || 0) - (a.messageTimestamp || 0)
                    );
                    const lastMessage = sortedMessages[0];
                    
                    // Extract message text for preview
                    const lastMessageText = lastMessage.message?.conversation || 
                                          lastMessage.message?.extendedTextMessage?.text || 
                                          '[Media]';
                    const lastMessageTime = new Date(lastMessage.messageTimestamp * 1000).toISOString();
                    
                    console.log(`💬 Conversation ${phoneNumber} (${contactName}): ${messages.length} messages, last: "${lastMessageText.substring(0, 50)}..."`);
                    
                    return {
                      id: `${instance.instance_key}_${remoteJid}`,
                      instanceId: instance.instance_key,
                      contactPhone: phoneNumber,
                      contactName: contactName,
                      status: 'active' as const,
                      messages: [], // Messages will be loaded from cache when conversation is selected
                      tags: [],
                      priority: 'medium' as const,
                      createdAt: lastMessageTime,
                      updatedAt: lastMessageTime,
                      lastMessageAt: lastMessageTime,
                      lastMessagePreview: lastMessageText,
                      remoteJid: remoteJid
                    };
                  } catch (error) { 
                    console.error(`Error processing conversation ${remoteJid}:`, error);
                    return null;
                  }
                })
            ).then(convs => convs.filter(conv => conv !== null));

            return {
              instanceName: instance.name || instance.instance_key,
              conversations
            };
          } catch (error) { 
            console.error(`Failed to fetch conversations for instance ${instance.instance_key}:`, error);
            return {
              instanceName: instance.name || instance.instance_key,
              conversations: []
            };
          }
        })
      );

      return allConversations;
    } catch (error) { 
      console.error('Failed to fetch all conversations:', error);
      return [];
    }
  }

  /**
   * Sync Evolution API instances with our database
   */
  async syncInstancesWithDatabase(): Promise<void> {
    try {

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      // Fetch instances from Evolution API
      const evolutionInstances = await this.fetchInstances();

      // Get existing instances from database
      const { data: existingInstances, error: fetchError } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('user_id', user.id);

      if (fetchError) {
        throw fetchError;
      }

      // Create a set of existing instance keys for quick lookup
      const existingInstanceKeys = new Set(existingInstances?.map(i => i.instance_key) || []);

      // Insert new instances
      for (const evolutionInstance of evolutionInstances) {
        if (!existingInstanceKeys.has(evolutionInstance.instanceName)) {
          const { error: insertError } = await supabase
            .from('whatsapp_instances')
            .insert({
              user_id: user.id,
              instance_key: evolutionInstance.instanceName,
              status: this.mapEvolutionStatus(evolutionInstance.status),
              phone_number: evolutionInstance.number,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (insertError) {
            console.error('Failed to insert instance:', insertError);
          } else {
            
            // Verify and fix webhook for new instance
            await this.verifyAndFixWebhook(evolutionInstance.instanceName);
          }
        }
      }

      // Update existing instances
      for (const evolutionInstance of evolutionInstances) {
        if (existingInstanceKeys.has(evolutionInstance.instanceName)) {
          const { error: updateError } = await supabase
            .from('whatsapp_instances')
            .update({
              status: this.mapEvolutionStatus(evolutionInstance.status),
              phone_number: evolutionInstance.number,
              updated_at: new Date().toISOString()
            })
            .eq('instance_key', evolutionInstance.instanceName)
            .eq('user_id', user.id);

          if (updateError) {
            console.error('Failed to update instance:', updateError);
          } else {
            // Verify and fix webhook for existing instance
            await this.verifyAndFixWebhook(evolutionInstance.instanceName);
          }
        }
      }

    } catch (error) { 
      console.error('❌ Failed to sync instances with database:', error);
      throw error;
    }
  }

  // Map Evolution API status to our status format
  private mapEvolutionStatus(evolutionStatus: string): string {
    switch (evolutionStatus?.toUpperCase()) {
      case 'OPEN':
        return 'connected';
      case 'CONNECTING':
        return 'connecting';
      case 'CLOSE':
      case 'CLOSED':
      case 'DISCONNECTED':
        return 'disconnected';
      default:
        return 'disconnected';
    }
  }

  // Get instance info including QR code if connecting
  async getInstanceInfo(instanceName: string): Promise<{
    instance: EvolutionInstance | null;
    qrCode: { code: string; base64: string } | null;
    state: any;
  }> {
    try {
      const [instances, qrCode, state] = await Promise.all([
        this.fetchInstances(),
        this.getQRCode(instanceName),
        this.getInstanceState(instanceName)
      ]);

      const instance = instances.find(i => i.instanceName === instanceName) || null;

      return {
        instance,
        qrCode,
        state
      };
    } catch (error) { 
      console.error('Failed to get instance info:', error);
      return {
        instance: null,
        qrCode: null,
        state: null
      };
    }
  }

  // Setup webhook for receiving messages
  async setupWebhook(instanceName: string, webhookUrl: string, retries = 3): Promise<void> {
    try {
      
      // Set the webhook URL with retries
      let lastError: any;
      for (let i = 0; i < retries; i++) {
        try {
          const setWebhookResponse = await this.makeRequest(`/webhook/set/${instanceName}`, 'POST', {
            enabled: true,
            url: webhookUrl, // API expects 'url' not 'webhook'
            webhook_by_events: false, // Don't append event names to URL
            events: [
              'MESSAGES_UPSERT',
              'MESSAGES_UPDATE',
              'CONNECTION_UPDATE',
              'CONTACTS_UPDATE',
              'CHATS_UPDATE',
              'CHATS_UPSERT',
              'PRESENCE_UPDATE'
            ]
          });
          
          if (!setWebhookResponse.ok) {
            throw new Error(`Failed to set webhook URL: ${setWebhookResponse.status}`);
          }
          

          // Verify webhook configuration using the correct endpoint
          const verifyResponse = await this.makeRequest(`/webhook/find/${instanceName}`, 'GET');
          const webhookInfo = await verifyResponse.json();
          
          if (!webhookInfo?.url || webhookInfo.url !== webhookUrl) {
            throw new Error('Webhook verification failed: URL mismatch');
          }
          
          return; // Success, exit the retry loop
          
        } catch (error) { 
          lastError = error;
          if (i < retries - 1) {
            // Wait longer between each retry
            await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
          }
        }
      }

      // If we get here, all retries failed
      throw lastError || new Error('Failed to set up webhook after all retries');

    } catch (error) { 
      console.error('❌ Error setting up webhook:', error);
      throw error;
    }
  }

  // Test connection to Evolution API
  async testConnection(): Promise<{ success: boolean; error?: string; instances?: EvolutionInstance[] }> {
    try {
      if (!this.config) {
        return { success: false, error: 'Evolution API not configured' };
      }

      const instances = await this.fetchInstances();
      return { success: true, instances };
    } catch (error) { 
      console.error('Failed to test Evolution API connection:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error testing Evolution API connection' 
      };
    }
  }

  /**
   * Verify and fix webhook configuration for an instance
   */
  async verifyAndFixWebhook(instanceName: string): Promise<boolean> {
    try {
      
      const webhookUrl = `${import.meta.env.SUPABASE_URL}/functions/v1/whatsapp-webhook`;
      
      // Check current webhook configuration using the correct endpoint
      const verifyResponse = await this.makeRequest(`/webhook/find/${instanceName}`, 'GET');
      const webhookInfo = await verifyResponse.json();
      
      // Check if webhook is properly configured
      if (webhookInfo?.url === webhookUrl && webhookInfo.enabled === true) {
        return true;
      }
      
      
      // Fix webhook configuration
      await this.setupWebhook(instanceName, webhookUrl);
      
      return true;
    } catch (error) { 
      console.error('❌ Error verifying/fixing webhook:', error);
      return false;
    }
  }

  /**
   * Verify and fix webhook configuration for all instances
   */
  async verifyAndFixAllWebhooks(): Promise<void> {
    try {
      
      const instances = await this.fetchInstances();
      
      for (const instance of instances) {
        await this.verifyAndFixWebhook(instance.instanceName);
      }
      
    } catch (error) { 
      console.error('❌ Error verifying all webhooks:', error);
      throw error;
    }
  }
}

export const evolutionApiService = new EvolutionApiService();

// Make it available globally for debugging
(window as any).evolutionApiService = evolutionApiService;