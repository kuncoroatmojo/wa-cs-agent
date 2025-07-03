import { supabase } from '../lib/supabase';
import type { Conversation } from '../types';
import { ConversationService } from './conversationService';

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
  private _loggedUnknownTypes: Set<string> = new Set(); // Track logged unknown message types

  constructor(baseUrl?: string, apiKey?: string) {
    // Allow injection of baseUrl and apiKey for scripts
    this.baseUrl = baseUrl || '';
    this.apiKey = apiKey || '';

    // Load config from environment if not provided
    if (!this.baseUrl || !this.apiKey) {
      this.loadConfigFromEnv();
    }
  }

  private get headers() {
    return {
      "Content-Type": "application/json",
      "Authorization": this.apiKey
    };
  }

  // Load configuration from environment variables
  private loadConfigFromEnv() {
    // Try both import.meta.env and process.env
    const baseUrl = (typeof window !== 'undefined' ? import.meta.env.VITE_EVOLUTION_API_URL : process.env.VITE_EVOLUTION_API_URL) || '';
    const apiKey = (typeof window !== 'undefined' ? import.meta.env.VITE_EVOLUTION_API_KEY : process.env.VITE_EVOLUTION_API_KEY) || '';
    
    if (baseUrl && apiKey) {
      this.baseUrl = baseUrl;
      this.apiKey = apiKey;
      this.config = { baseUrl, apiKey };
    } else {
      console.error('❌ Missing required environment variables:');
      if (!baseUrl) console.error('- VITE_EVOLUTION_API_URL');
      if (!apiKey) console.error('- VITE_EVOLUTION_API_KEY');
      throw new Error('Missing Evolution API configuration');
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

  // Make HTTP request to Evolution API through proxy
  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', body?: any) {
    // Always ensure we have a valid API key (using apikey header)
    if (!this.apiKey && !this.config?.apiKey) {
      this.loadConfigFromEnv();
    }

    const evolutionApiKey = this.config?.apiKey || this.apiKey;

    if (!evolutionApiKey) {
      console.error('❌ Evolution API configuration missing - no API key');
      throw new Error('Evolution API not properly configured - missing API key');
    }

    try {
      // Use local Edge Function in development
      const isDev = import.meta.env.DEV || window.location.hostname === 'localhost';
      
      const edgeFunctionUrl = isDev 
        ? 'http://localhost:54321/functions/v1/evolution-proxy'
        : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-proxy`;
      
      const fullUrl = `${edgeFunctionUrl}${endpoint}`;
      
      console.log(`📡 Making ${method} request to: ${fullUrl}${isDev ? ' (via local edge function)' : ' (via Edge Function)'}`);
      
      const headers = {
        "Content-Type": "application/json",
        "apikey": evolutionApiKey
      };

      const response = await fetch(fullUrl, {
      method,
      headers,
        body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const errorText = await response.text();
        console.error(`❌ Evolution API error: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Evolution API error: ${response.status} ${response.statusText}\n${errorText}`);
    }

    return response;
    } catch (error) { 
      console.error('Evolution API request failed:', error);
      throw error;
    }
  }

  // Fetch all instances from Evolution API
  // Fetch all instances, optionally filtered by target instance
  async fetchInstances(targetInstance?: string): Promise<EvolutionInstance[]> {
    try {
      const response = await this.makeRequest('/instance/fetchInstances', 'GET');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch instances: ${response.status}`);
      }
      
      const result = await response.json();
      const allInstances = result.instances || result || [];
      
      // Filter instances based on target instance if provided
      if (targetInstance) {
        return allInstances.filter((instance: EvolutionInstance) => 
          instance.instanceName === targetInstance
        );
      }
      
      // Return all instances if no target specified
      return allInstances;
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
        console.error('❌ Failed to set up webhook:', error);
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
  // Fetch all recent messages and organize them into conversations
  async fetchAllRecentMessages(instanceName: string, maxMessages: number = 2000): Promise<any[]> {
    try {
      console.log(`🔄 Fetching all recent messages for instance: ${instanceName} (max: ${maxMessages})`);
      
      const allMessages: any[] = [];
      const pageSize = 50; // Evolution API seems to limit to 50 per request
      let totalFetched = 0;
      let pageOffset = 0;
      
      while (totalFetched < maxMessages) {
        const response = await this.makeRequest(`/chat/findMessages/${instanceName}`, 'POST', {
          where: {},
          limit: pageSize,
          offset: pageOffset
        });
      
      if (!response.ok) {
          throw new Error(`Failed to fetch messages: ${response.status}`);
      }

        const result = await response.json();
        let pageMessages: any[] = [];
        
        // Handle the correct response structure: { messages: { records: [...] } }
        if (result && result.messages && Array.isArray(result.messages.records)) {
          pageMessages = result.messages.records;
          console.log(`✅ Page ${Math.floor(pageOffset / pageSize) + 1}: Found ${pageMessages.length} messages (total available: ${result.messages.total})`);
          
          // If this is the first page, log total available
          if (pageOffset === 0) {
            console.log(`📊 Total messages available: ${result.total || 'unknown'}`);
          }
        } else if (Array.isArray(result)) {
          pageMessages = result;
          console.log(`✅ Page ${Math.floor(pageOffset / pageSize) + 1}: Found ${pageMessages.length} messages`);
        } else {
          break;
        }
        
        // If no messages returned, we've reached the end
        if (pageMessages.length === 0) {
          break;
        }
        
        allMessages.push(...pageMessages);
        totalFetched += pageMessages.length;
        pageOffset += pageSize;
        
        // If we got fewer messages than requested, we've reached the end
        if (pageMessages.length < pageSize) {
          console.log(`📄 Reached end of messages (got ${pageMessages.length} < ${pageSize})`);
          break;
        }
        
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      
      // Sort by timestamp descending to get latest messages first
      const sortedMessages = allMessages.sort((a: any, b: any) => 
        (b.messageTimestamp || 0) - (a.messageTimestamp || 0)
      );

      return sortedMessages;
    } catch (error) { 
      console.error('Failed to fetch all recent messages:', error);
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

      // Get conversation ID
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .eq('external_conversation_id', remoteJid)
        .eq('instance_key', instanceName)
        .limit(1);

      if (convError) {
        console.error('❌ Error finding conversation:', convError);
        return [];
      }

      if (!conversations || conversations.length === 0) {
        console.error('❌ No conversation found for', { instanceName, remoteJid });
        return [];
      }

      const conversation = conversations[0];

      // Get messages from our database
      const { data: messages, error: msgError } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('external_timestamp', { ascending: false })
        .limit(500); // Increased limit

      if (msgError) {
        console.error('❌ Error fetching messages from database:', msgError);
        return [];
      }

      if (!messages || messages.length === 0) {
        // Try syncing one more time
        await this.syncMessagesWithDatabase(instanceName, remoteJid);
        
        // Try fetching messages again
        const { data: retryMessages, error: retryError } = await supabase
          .from('conversation_messages')
          .select('*')
          .eq('conversation_id', conversation.id)
          .order('external_timestamp', { ascending: false })
          .limit(500);

        if (retryError) {
          console.error('❌ Error in retry fetch:', retryError);
          return [];
        }

        return retryMessages || [];
      }

      return messages;
    } catch (error) { 
      console.error('❌ Error loading conversation messages:', error);
        return [];
      }
  }

  async loadAllMessagesForInstance(instanceName: string): Promise<EvolutionMessage[]> {
    try {
      // Use the new efficient method to get all recent messages (increased limit with pagination)
      const messages = await this.fetchAllRecentMessages(instanceName, 500);
        
      if (!messages || messages.length === 0) {
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
      console.error('Failed to load all messages:', error);
      return [];
    }
  }

  private determineMessageType(msg: any): string {
    if (!msg.message) return 'text'; // Default to 'text' instead of 'unknown'
    
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
    
    if (msg.message.editedMessage) return 'text'; // Support edited messages
    
    // For any unrecognized message types, default to 'text' to avoid constraint violations
    // Log only once per message type to avoid spam
    const messageKeys = Object.keys(msg.message || {});
    const messageType = messageKeys[0];
    if (!this._loggedUnknownTypes) this._loggedUnknownTypes = new Set();
    if (!this._loggedUnknownTypes.has(messageType)) {
      this._loggedUnknownTypes.add(messageType);
    }
    return 'text';
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
      // Use the correct Evolution API endpoint from documentation
      const response = await this.makeRequest(`/chat/findMessages/${instanceName}`, 'POST', {
        where: {
          key: {
            remoteJid: remoteJid
          }
        },
        limit: limit
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Failed to fetch messages for ${remoteJid}:`, response.status, errorText);
        return [];
      }

      const result = await response.json();
      
      // Handle the correct response structure: { messages: { records: [...] } }
      if (result && result.messages && Array.isArray(result.messages.records)) {
        return result.messages.records;
      } else if (Array.isArray(result)) {
        return result;
      } else {
        return [];
      }
    } catch (error) { 
      console.error(`❌ Error fetching messages for ${remoteJid}:`, error);
      return [];
    }
  }

  async syncMessagesWithDatabase(instanceName: string, remoteJid: string): Promise<void> {
    try {
      
      // Get messages from Evolution API using the correct endpoint
      const messages = await this.fetchMessages(instanceName, remoteJid, 500); // Increased limit
      
      if (!messages || messages.length === 0) {
        return;
      }
      
      // Get or create the conversation in our database
      let conversation;
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('external_conversation_id', remoteJid)
        .eq('instance_key', instanceName)
        .single();
        
      if (existingConv) {
        conversation = existingConv;
      } else {
        // Create new conversation if it doesn't exist
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) {
          console.error('❌ No authenticated user found');
        return;
      }

        // Check if it's a group chat
        const isGroup = remoteJid.includes('@g.us');
        let contactName = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
        
        // For groups, try to get the group name
        if (isGroup) {
          const groupMessage = messages.find(m => m.groupMetadata?.subject);
          if (groupMessage?.groupMetadata?.subject) {
            contactName = groupMessage.groupMetadata.subject;
          } else {
            contactName = `Group ${contactName}`;
          }
        } else {
          // For individual chats, use pushName
          const messageWithName = messages.find(m => m.pushName);
          if (messageWithName?.pushName) {
            contactName = messageWithName.pushName;
          }
        }

        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .upsert({
            user_id: user.user.id,
            integration_type: 'whatsapp',
            instance_key: instanceName,
            external_conversation_id: remoteJid,
            contact_id: remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', ''),
            contact_name: contactName,
            contact_metadata: {},
            status: 'active',
            priority: 'medium',
            tags: [],
            message_count: 0,
            last_message_at: new Date().toISOString(),
            conversation_topics: [],
            last_synced_at: new Date().toISOString(),
            sync_status: 'synced',
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,external_conversation_id,instance_key'
          })
          .select('id')
          .single();

        if (convError) {
          console.error('❌ Error creating conversation:', convError);
          return;
        }
        conversation = newConv;
      }

      // Insert messages into database
      const messagesToInsert = messages.map(msg => ({
        conversation_id: conversation.id,
        external_message_id: msg.key?.id,
        content: this.extractMessageContent(msg),
        message_type: this.determineMessageType(msg),
        direction: msg.key?.fromMe ? 'outbound' : 'inbound',
        sender_type: msg.key?.fromMe ? 'agent' : 'contact',
        sender_name: msg.key?.fromMe ? 'Agent' : (msg.pushName || null),
        sender_id: msg.key?.fromMe ? 'agent' : remoteJid,
        external_timestamp: new Date((msg.messageTimestamp || 0) * 1000).toISOString(),
        external_metadata: {
          pushName: msg.pushName,
          messageType: msg.messageType,
          source: msg.source,
          participant: msg.participant
        }
      }));

      // Pre-filter to check which messages already exist to avoid 400 errors from upsert conflicts
      const externalMessageIds = messagesToInsert
        .map(m => m.external_message_id)
        .filter(Boolean);

      let existingMessageIds: string[] = [];
      if (externalMessageIds.length > 0) {
        const { data: existingMessages } = await supabase
          .from('conversation_messages')
          .select('external_message_id')
          .in('external_message_id', externalMessageIds);
        
        existingMessageIds = existingMessages?.map(m => m.external_message_id) || [];
      }

      // Filter out messages that already exist
      const newMessagesToInsert = messagesToInsert.filter(m => 
        m.external_message_id && !existingMessageIds.includes(m.external_message_id)
      );

      console.log(`📥 Processing ${newMessagesToInsert.length} new messages (${existingMessageIds.length} already exist)`);

      // Batch insert new messages only (no upsert to avoid RLS conflicts)
      if (newMessagesToInsert.length > 0) {
        const batchSize = 50;
        let _successfulInserts = 0;

        for (let i = 0; i < newMessagesToInsert.length; i += batchSize) {
          const batch = newMessagesToInsert.slice(i, i + batchSize);
          
          try {
            const { error: insertError } = await supabase
              .from('conversation_messages')
              .insert(batch);

            if (insertError) {
              
              // Try inserting individual messages to handle any remaining conflicts
              for (const messageData of batch) {
                try {
                  await supabase
                    .from('conversation_messages')
                    .insert(messageData);
                  _successfulInserts++;
                } catch (individualError: any) {
                  if (!individualError?.message?.includes('duplicate') && !individualError?.message?.includes('unique')) {
                    console.error('Failed to insert individual message:', individualError);
                  }
                  // Skip duplicates silently
                }
              }
            } else {
              _successfulInserts += batch.length;
            }
          } catch (batchError: any) {
            
            // Fallback to individual inserts
            for (const messageData of batch) {
              try {
                await supabase
                  .from('conversation_messages')
                  .insert(messageData);
                _successfulInserts++;
              } catch (individualError: any) {
                if (!individualError?.message?.includes('duplicate') && !individualError?.message?.includes('unique')) {
                  console.error('Failed to insert fallback message:', individualError);
                }
              }
            }
          }
        }

      }

      // After inserting all messages, update the conversation with the truly latest message
      // Get the actual latest message from the database (not just from the current batch)
      const { data: latestMessage } = await supabase
        .from('conversation_messages')
        .select('content, sender_type, external_timestamp')
        .eq('conversation_id', conversation.id)
        .order('external_timestamp', { ascending: false })
        .limit(1)
        .single();

      if (latestMessage) {
        await supabase
          .from('conversations')
          .update({
            last_message_at: latestMessage.external_timestamp,
            last_message_preview: latestMessage.content.substring(0, 100),
            last_message_from: latestMessage.sender_type === 'agent' ? 'agent' : 'contact'
          })
          .eq('id', conversation.id);
        
        console.log(`✅ Synced ${messages.length} messages for conversation ${remoteJid} - Updated preview: "${latestMessage.content.substring(0, 50)}..."`);
      } else {
        console.log(`⚠️ No latest message found for conversation ${remoteJid}`);
      }

    } catch (error) { 
      console.error(`❌ Error syncing messages for ${remoteJid}:`, error);
    }
  }

  // Helper method to extract message content
  private extractMessageContent(msg: any): string {
    if (msg.message?.conversation) {
      return msg.message.conversation;
    }
    if (msg.message?.extendedTextMessage?.text) {
      return msg.message.extendedTextMessage.text;
    }
    if (msg.message?.imageMessage?.caption) {
      return `[Image] ${msg.message.imageMessage.caption}`;
    }
    if (msg.message?.videoMessage?.caption) {
      return `[Video] ${msg.message.videoMessage.caption}`;
    }
    if (msg.message?.audioMessage) {
      return '[Audio Message]';
    }
    if (msg.message?.documentMessage) {
      return `[Document] ${msg.message.documentMessage.fileName || 'Document'}`;
    }
    if (msg.message?.stickerMessage) {
      return '[Sticker]';
    }
    if (msg.message?.locationMessage) {
      return '[Location]';
    }
    if (msg.message?.contactMessage) {
      return '[Contact]';
    }
    return '[Message]';
  }

  // Sync all conversations and their messages for an instance using the efficient approach
  async syncAllConversationsAndMessages(instanceName: string): Promise<{
    conversationsSynced: number;
    messagesSynced: number;
    errors: string[];
  }> {
    try {
      
      // Get all recent messages from Evolution API
      const allMessages = await this.fetchAllRecentMessages(instanceName, 1000);
      
      if (allMessages.length === 0) {
        return { conversationsSynced: 0, messagesSynced: 0, errors: [] };
      }
      
      // Group messages by conversation (remoteJid)
      const conversationMap = new Map<string, any[]>();
      for (const message of allMessages) {
        const remoteJid = message.key?.remoteJid;
        if (remoteJid) {
          if (!conversationMap.has(remoteJid)) {
            conversationMap.set(remoteJid, []);
          }
          conversationMap.get(remoteJid)!.push(message);
        }
      }
      
      
      let conversationsSynced = 0;
      let messagesSynced = 0;
      const errors: string[] = [];
      
      // Sync each conversation
      for (const [remoteJid, messages] of conversationMap) {
        try {
          console.log(`🔄 Syncing conversation: ${remoteJid} (${messages.length} messages)`);
          
          // Sync messages for this conversation
          await this.syncConversationMessages(instanceName, remoteJid, messages);
          conversationsSynced++;
          messagesSynced += messages.length;
          
        } catch (error) {
          const errorMsg = `Failed to sync conversation ${remoteJid}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error('❌', errorMsg);
          errors.push(errorMsg);
        }
      }
      
      console.log(`✅ Sync completed for ${instanceName}:`, {
        conversationsSynced,
        messagesSynced,
        errors: errors.length
      });
      
      return {
        conversationsSynced,
        messagesSynced,
        errors
      };
      
    } catch (error) {
      console.error(`❌ Error syncing all conversations for ${instanceName}:`, error);
      throw error;
    }
  }

  // Sync messages for a specific conversation with pre-fetched messages
  async syncConversationMessages(instanceName: string, remoteJid: string, messages: any[]): Promise<void> {
    try {
      // Get or create the conversation in our database
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        console.error('❌ No authenticated user found');
        return;
      }

      // Determine if this is a group conversation and get appropriate name
      const isGroup = remoteJid.endsWith('@g.us');
      let contactName;
      
      if (isGroup) {
        // For groups, use a generic group name with the group ID
        contactName = `Group ${remoteJid.split('@')[0]}`;
      } else {
        // For individual contacts, use pushName from messages
        const firstMessage = messages[0];
        contactName = firstMessage?.pushName || remoteJid.split('@')[0];
      }

      // Extract contact ID from remoteJid (phone number for WhatsApp)
      const contactId = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
      
      // Try to find existing conversation (with user_id for RLS policy)
      const { data: existingConvs } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', user.user.id)
        .eq('external_conversation_id', remoteJid)
        .eq('instance_key', instanceName)
        .limit(1);
      
      const existingConv = existingConvs && existingConvs.length > 0 ? existingConvs[0] : null;
        
      let conversation;
      if (existingConv) {
        conversation = existingConv;
        
        // Update conversation name if it's a group (preview will be updated after message insertion)
        if (isGroup) {
          await supabase
            .from('conversations')
            .update({
              contact_name: contactName
            })
            .eq('id', existingConv.id);
        }
        // Individual conversations don't need name updates in this context
      } else {
        // Find the latest message for preview
        const latestMessage = messages.reduce((latest, current) => 
          (current.messageTimestamp || 0) > (latest.messageTimestamp || 0) ? current : latest
        );
        const latestMessagePreview = this.extractMessageContent(latestMessage).substring(0, 100);
        const latestMessageFrom = latestMessage.key?.fromMe ? 'agent' : 'contact';

        // Use proper upsert with the new unique constraint (user_id, external_conversation_id, instance_key)
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .upsert({
            user_id: user.user.id,
            external_conversation_id: remoteJid,
            instance_key: instanceName,
            integration_type: 'whatsapp', // Required field for WhatsApp conversations
            contact_id: contactId, // Required field - phone number or group ID
            contact_name: contactName,
            last_message_at: new Date(Math.max(...messages.map(m => (m.messageTimestamp || 0) * 1000))).toISOString(),
            last_message_preview: latestMessagePreview,
            last_message_from: latestMessageFrom,
            status: 'active',
            priority: 'medium',
            tags: [],
            message_count: 0,
            conversation_topics: [],
            last_synced_at: new Date().toISOString(),
            sync_status: 'synced',
            contact_metadata: {},
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,external_conversation_id,instance_key'
          })
          .select('id')
          .single();
        
        conversation = newConv;

        if (convError || !conversation) {
          console.error('❌ Error creating/updating conversation:', convError);
          return;
        }
      }

      // Insert messages into database
      const messagesToInsert = messages.map(msg => ({
        conversation_id: conversation.id,
        external_message_id: msg.key?.id,
        content: this.extractMessageContent(msg),
        message_type: this.determineMessageType(msg),
        direction: msg.key?.fromMe ? 'outbound' : 'inbound',
        sender_type: msg.key?.fromMe ? 'agent' : 'contact',
        sender_name: msg.key?.fromMe ? 'Agent' : (msg.pushName || null),
        sender_id: msg.key?.fromMe ? 'agent' : remoteJid,
        external_timestamp: new Date((msg.messageTimestamp || 0) * 1000).toISOString(),
        external_metadata: {
          pushName: msg.pushName,
          messageType: msg.messageType,
          source: msg.source,
          participant: msg.participant
        }
      }));

      // Pre-filter to check which messages already exist to avoid 400 errors from upsert conflicts
      const externalMessageIds = messagesToInsert
        .map(m => m.external_message_id)
        .filter(Boolean);

      let existingMessageIds: string[] = [];
      if (externalMessageIds.length > 0) {
        const { data: existingMessages } = await supabase
          .from('conversation_messages')
          .select('external_message_id')
          .in('external_message_id', externalMessageIds);
        
        existingMessageIds = existingMessages?.map(m => m.external_message_id) || [];
      }

      // Filter out messages that already exist
      const newMessagesToInsert = messagesToInsert.filter(m => 
        m.external_message_id && !existingMessageIds.includes(m.external_message_id)
      );

      console.log(`📥 Processing ${newMessagesToInsert.length} new messages (${existingMessageIds.length} already exist)`);

      // Batch insert new messages only (no upsert to avoid RLS conflicts)
      if (newMessagesToInsert.length > 0) {
        const batchSize = 50;
        let _successfulInserts = 0;

        for (let i = 0; i < newMessagesToInsert.length; i += batchSize) {
          const batch = newMessagesToInsert.slice(i, i + batchSize);
          
          try {
            const { error: insertError } = await supabase
              .from('conversation_messages')
              .insert(batch);

            if (insertError) {
              
              // Try inserting individual messages to handle any remaining conflicts
              for (const messageData of batch) {
                try {
                  await supabase
                    .from('conversation_messages')
                    .insert(messageData);
                  _successfulInserts++;
                } catch (individualError: any) {
                  if (!individualError?.message?.includes('duplicate') && !individualError?.message?.includes('unique')) {
                    console.error('Failed to insert individual message:', individualError);
                  }
                  // Skip duplicates silently
                }
              }
            } else {
              _successfulInserts += batch.length;
            }
          } catch (batchError: any) {
            
            // Fallback to individual inserts
            for (const messageData of batch) {
              try {
                await supabase
                  .from('conversation_messages')
                  .insert(messageData);
                _successfulInserts++;
              } catch (individualError: any) {
                if (!individualError?.message?.includes('duplicate') && !individualError?.message?.includes('unique')) {
                  console.error('Failed to insert fallback message:', individualError);
                }
              }
            }
          }
        }

        
        // Update conversation with latest message preview and timestamp
        if (_successfulInserts > 0) {
          try {
            // Find the actual latest message from the database (not just newly inserted ones)
            const { data: latestMessageData, error: queryError } = await supabase
              .from('conversation_messages')
              .select('content, external_timestamp')
              .eq('conversation_id', conversation.id)
              .order('external_timestamp', { ascending: false })
              .limit(1)
              .single();

            if (queryError) {
              console.error('Failed to query latest message:', queryError);
              return;
            }

            if (latestMessageData) {
              // Update the conversation with the actual latest message preview
              const { error: updateError } = await supabase
                .from('conversations')
                .update({
                  last_message_at: latestMessageData.external_timestamp,
                  last_message_preview: latestMessageData.content.substring(0, 100), // Limit preview length
                  updated_at: new Date().toISOString()
                })
                .eq('id', conversation.id);

              if (updateError) {
                console.error('Failed to update conversation preview:', updateError);
              } else {
                console.log(`✅ Updated conversation preview for ${remoteJid}: "${latestMessageData.content.substring(0, 50)}..."`);
              }
            }
          } catch (_updateError: any) {
            console.error('Error updating conversation:', _updateError);
          }
        }
      }

    } catch (error) { 
      console.error(`❌ Error syncing conversation ${remoteJid}:`, error);
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
            
            // 2. Since we're using message-driven approach, we'll extract contact info from messages
            // No need to fetch chats separately
            const chatMap = new Map<string, any>();
            
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
              name: evolutionInstance.instanceName, // Add the required name field
              instance_key: evolutionInstance.instanceName,
              connection_type: 'evolution_api', // Set the connection type
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