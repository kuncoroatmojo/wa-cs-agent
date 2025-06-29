/**
 * Evolution API Message Synchronization Service
 * Handles fetching and syncing messages from Evolution API for RAG functionality
 */

import { createClient } from '@supabase/supabase-js';

interface EvolutionMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
    participant?: string;
  };
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
    };
    imageMessage?: any;
    audioMessage?: any;
    videoMessage?: any;
    documentMessage?: any;
    locationMessage?: any;
    contactMessage?: any;
    stickerMessage?: any;
  };
  messageType: string;
  messageTimestamp: number;
  owner: string;
  source: string;
  contextInfo?: any;
}

interface EvolutionChat {
  id: string;
  name?: string;
  lastMessage?: any;
  unreadCount?: number;
  isGroup: boolean;
  participant?: string[];
  owner: string;
}

interface SyncProgress {
  totalMessages: number;
  processedMessages: number;
  totalConversations: number;
  processedConversations: number;
  errors: string[];
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'running' | 'completed' | 'error';
}

export class EvolutionMessageSyncService {
  private supabase: any;
  private evolutionApiUrl: string | null = null;
  private evolutionApiKey: string | null = null;
  private initialized = false;

  constructor() {
    // Don't initialize immediately - wait for first method call
  }

  private initialize() {
    if (this.initialized) return;


    // Get Supabase credentials from environment
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY || 
                              import.meta.env.SUPABASE_SERVICE_ROLE_KEY ||
                              process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Supabase credentials not configured:');
      console.error('  - VITE_SUPABASE_URL:', !!supabaseUrl);
      console.error('  - SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
      throw new Error('Supabase credentials not configured');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.evolutionApiUrl = import.meta.env.VITE_EVOLUTION_API_URL || '';
    this.evolutionApiKey = import.meta.env.VITE_EVOLUTION_API_KEY || '';

    if (!this.evolutionApiUrl || !this.evolutionApiKey) {
      console.error('❌ Evolution API credentials not configured:');
      console.error('  - VITE_EVOLUTION_API_URL:', !!this.evolutionApiUrl);
      console.error('  - VITE_EVOLUTION_API_KEY:', !!this.evolutionApiKey);
      console.error('Please ensure your .env.local file contains:');
      console.error('  VITE_EVOLUTION_API_URL=your-evolution-api-url');
      console.error('  VITE_EVOLUTION_API_KEY=your-evolution-api-key');
      throw new Error('Evolution API credentials not configured');
    }

    console.log('  - Evolution API Key:', this.evolutionApiKey.substring(0, 8) + '...');
    
    this.initialized = true;
  }

  /**
   * Fetch all chats from Evolution API
   */
  async fetchAllChatsFromEvolution(instanceName: string): Promise<EvolutionChat[]> {
    this.initialize();
    
    const response = await fetch(`${this.evolutionApiUrl}/chat/findChats/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': this.evolutionApiKey!,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch chats: ${response.status} ${response.statusText}`);
    }

    const chats = await response.json();
    return chats;
  }

  /**
   * Fetch all messages from Evolution API
   * Uses the correct POST endpoint with empty body to get ALL messages
   */
  async fetchAllMessagesFromEvolution(instanceName: string): Promise<EvolutionMessage[]> {
    this.initialize();
    
    const response = await fetch(`${this.evolutionApiUrl}/chat/findMessages/${instanceName}`, {
      method: 'POST',
      headers: {
        'apikey': this.evolutionApiKey!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({}) // Empty body to get all messages
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch messages: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const messages = await response.json();
    return messages;
  }

  /**
   * Fetch messages for a specific conversation
   */
  async fetchConversationMessages(instanceName: string, remoteJid: string): Promise<EvolutionMessage[]> {
    this.initialize();
    
    const response = await fetch(`${this.evolutionApiUrl}/chat/findMessages/${instanceName}`, {
      method: 'POST',
      headers: {
        'apikey': this.evolutionApiKey!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        where: {
          key: {
            remoteJid: remoteJid
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch conversation messages: ${response.status}`);
    }

    const messages = await response.json();
    return messages;
  }

  /**
   * Group messages by conversation (remoteJid)
   */
  groupMessagesByConversation(messages: EvolutionMessage[]): Record<string, EvolutionMessage[]> {
    
    const messagesByConversation: Record<string, EvolutionMessage[]> = {};
    
    messages.forEach(msg => {
      const remoteJid = msg.key?.remoteJid || 'unknown';
      if (!messagesByConversation[remoteJid]) {
        messagesByConversation[remoteJid] = [];
      }
      messagesByConversation[remoteJid].push(msg);
    });

    const conversationCount = Object.keys(messagesByConversation).length;
    
    return messagesByConversation;
  }

  /**
   * Extract text content from Evolution message
   */
  private extractMessageContent(message: EvolutionMessage): string {
    if (message.message?.conversation) {
      return message.message.conversation;
    }
    
    if (message.message?.extendedTextMessage?.text) {
      return message.message.extendedTextMessage.text;
    }

    // For media messages, return type description
    if (message.message?.imageMessage) {
      const caption = message.message.imageMessage.caption || '';
      return caption ? `[Image] ${caption}` : '[Image]';
    }

    if (message.message?.audioMessage) {
      return '[Audio]';
    }

    if (message.message?.videoMessage) {
      const caption = message.message.videoMessage.caption || '';
      return caption ? `[Video] ${caption}` : '[Video]';
    }

    if (message.message?.documentMessage) {
      const title = message.message.documentMessage.title || 'Document';
      return `[Document: ${title}]`;
    }

    if (message.message?.locationMessage) {
      return '[Location]';
    }

    if (message.message?.contactMessage) {
      return '[Contact]';
    }

    if (message.message?.stickerMessage) {
      return '[Sticker]';
    }

    // Fallback to message type or raw JSON
    return `[${message.messageType}]`;
  }

  /**
   * Sync all messages for a specific instance
   */
  async syncAllMessages(instanceName: string): Promise<SyncProgress> {
    this.initialize();
    
    const progress: SyncProgress = {
      totalMessages: 0,
      processedMessages: 0,
      totalConversations: 0,
      processedConversations: 0,
      errors: [],
      startTime: new Date(),
      status: 'running'
    };

    try {

      // Get database instance
      const { data: dbInstances } = await this.supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('instance_key', instanceName)
        .single();

      if (!dbInstances) {
        throw new Error(`Instance ${instanceName} not found in database`);
      }

      // Get user for conversations
      const { data: profiles } = await this.supabase
        .from('profiles')
        .select('id')
        .limit(1);

      if (!profiles || profiles.length === 0) {
        throw new Error('No user profiles found');
      }

      const userId = profiles[0].id;
      const instanceId = dbInstances.id;

      // Fetch all messages from Evolution API (this is the single source of truth)
      const allMessages = await this.fetchAllMessagesFromEvolution(instanceName);
      progress.totalMessages = allMessages.length;


      // Group messages by conversation (remoteJid)
      const messagesByConversation = this.groupMessagesByConversation(allMessages);
      progress.totalConversations = Object.keys(messagesByConversation).length;


      // Sort conversations by message count (process largest first for better progress visibility)
      const sortedConversations = Object.entries(messagesByConversation)
        .sort(([, a], [, b]) => b.length - a.length);

      // Process each conversation with improved error handling
      let skippedConversations = 0;
      
      for (const [remoteJid, messages] of sortedConversations) {
        try {
          console.log(`\n🔄 Processing ${remoteJid} (${messages.length} messages)...`);
          
          await this.syncConversationMessages(
            userId,
            instanceId,
            instanceName,
            remoteJid,
            messages
          );
          
          progress.processedConversations++;
          progress.processedMessages += messages.length;
          
          // Enhanced progress logging
          if (progress.processedConversations % 25 === 0) {
            const completionPercent = Math.round((progress.processedConversations / progress.totalConversations) * 100);
            const avgMsgPerConv = Math.round(progress.processedMessages / progress.processedConversations);
            console.log(`📈 Progress: ${progress.processedConversations}/${progress.totalConversations} conversations (${completionPercent}%) | Avg: ${avgMsgPerConv} msgs/conv`);
          }
          
        } catch (error) { 
          const errorMsg = `Error syncing conversation ${remoteJid} (${messages.length} messages): ${error?.message || 'Unknown error'}`;
          console.error(`❌ ${errorMsg}`);
          progress.errors.push(errorMsg);
          
          // Don't stop the entire sync for individual conversation errors
          skippedConversations++;
          if (skippedConversations > 10) {
            console.warn(`⚠️ Too many conversation errors (${skippedConversations}), stopping sync`);
            break;
          }
        }
      }

      progress.status = 'completed';
      progress.endTime = new Date();

      const duration = Math.round((progress.endTime.getTime() - progress.startTime.getTime()) / 1000);
      const avgMsgPerSec = Math.round(progress.processedMessages / duration);


      if (progress.errors.length > 0) {
        console.warn(`Sync completed with ${progress.errors.length} errors`);
      }

    } catch (error) { 
      progress.status = 'error';
      progress.endTime = new Date();
      progress.errors.push(`Sync failed: ${error?.message || 'Unknown error'}`);
      console.error('❌ Message sync failed:', error);
    }

    return progress;
  }

  /**
   * Sync messages for a specific conversation
   * Improved version that handles conversation merging and deduplication better
   */
  async syncConversationMessages(
    userId: string,
    instanceId: string,
    instanceName: string,
    remoteJid: string,
    messages: EvolutionMessage[]
  ): Promise<void> {
    if (messages.length === 0) return;

    // Sort messages by timestamp
    const sortedMessages = messages.sort((a, b) => a.messageTimestamp - b.messageTimestamp);
    const latestMessage = sortedMessages[sortedMessages.length - 1];

    // Determine if this is a group chat
    const isGroup = remoteJid.includes('@g.us');
    
    // Extract contact name from latest message or use phone number
    const contactName = latestMessage.pushName || 
                       (isGroup ? 'Group Chat' : remoteJid.replace('@s.whatsapp.net', ''));

    // First, check if conversation already exists with this external_conversation_id
    const { data: existingConversation } = await this.supabase
      .from('conversations')
      .select('id, message_count, last_message_at')
      .eq('external_conversation_id', remoteJid)
      .eq('instance_key', instanceName)
      .single();

    let conversation;
    
    if (existingConversation) {
      // Update existing conversation with latest info
      const updateData = {
        contact_name: contactName,
        message_count: messages.length,
        last_message_at: new Date(latestMessage.messageTimestamp * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        contact_metadata: { 
          pushName: contactName,
          isGroup,
          messageTypes: [...new Set(messages.map(m => m.messageType))],
          totalEvolutionMessages: messages.length
        }
      };

      const { data: updatedConv, error: updateError } = await this.supabase
        .from('conversations')
        .update(updateData)
        .eq('id', existingConversation.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update conversation: ${updateError.message}`);
      }

      conversation = updatedConv;
    } else {
      // Create new conversation
      const conversationData = {
        user_id: userId,
        integration_type: 'whatsapp',
        integration_id: instanceId,
        instance_key: instanceName,
        contact_id: remoteJid,
        contact_name: contactName,
        status: 'active',
        external_conversation_id: remoteJid,
        message_count: messages.length,
        last_message_at: new Date(latestMessage.messageTimestamp * 1000).toISOString(),
        contact_metadata: { 
          pushName: contactName,
          isGroup,
          messageTypes: [...new Set(messages.map(m => m.messageType))],
          totalEvolutionMessages: messages.length
        }
      };

      const { data: newConv, error: convError } = await this.supabase
        .from('conversations')
        .insert(conversationData)
        .select()
        .single();

      if (convError) {
        throw new Error(`Failed to create conversation: ${convError.message}`);
      }

      conversation = newConv;
    }

    // Check which messages already exist to avoid duplicates
    const externalIds = sortedMessages
      .map(msg => msg.key?.id)
      .filter(Boolean);

    let existingMessageIds: string[] = [];
    if (externalIds.length > 0) {
      const { data: existingMessages } = await this.supabase
        .from('conversation_messages')
        .select('external_message_id')
        .eq('conversation_id', conversation.id)
        .in('external_message_id', externalIds);
      
      existingMessageIds = existingMessages?.map(m => m.external_message_id) || [];
    }

    // Filter out messages that already exist
    const newMessages = sortedMessages.filter(msg => 
      msg.key?.id && !existingMessageIds.includes(msg.key.id)
    );

    if (newMessages.length === 0) {
      return;
    }

    console.log(`📥 Processing ${newMessages.length} new messages for ${remoteJid} (${existingMessageIds.length} already exist)`);

    // Process messages in optimized batches
    const batchSize = 50; // Smaller batches for better performance
    let processedCount = 0;

    for (let i = 0; i < newMessages.length; i += batchSize) {
      const batch = newMessages.slice(i, i + batchSize);
      
      const messageInserts = batch.map(msg => {
        const timestamp = new Date(msg.messageTimestamp * 1000).toISOString();
        
        return {
          conversation_id: conversation.id,
          external_message_id: msg.key?.id || `msg_${msg.messageTimestamp}_${Math.random()}`,
          content: this.extractMessageContent(msg),
          message_type: this.normalizeMessageType(msg.messageType),
          direction: msg.key?.fromMe ? 'outbound' : 'inbound',
          sender_type: msg.key?.fromMe ? 'agent' : 'contact',
          sender_name: msg.pushName || contactName || 'Unknown',
          sender_id: msg.key?.participant || msg.pushName || remoteJid,
          external_timestamp: timestamp,
          external_metadata: {
            messageTimestamp: msg.messageTimestamp,
            messageType: msg.messageType,
            remoteJid: remoteJid,
            pushName: msg.pushName,
            isGroup: isGroup,
            key: msg.key
          },
          status: 'delivered',
          created_at: timestamp
        };
      });

      // Try upsert first, but handle constraint issues gracefully
      let upsertSuccess = false;
      try {
        const { error: upsertError, count } = await this.supabase
          .from('conversation_messages')
          .upsert(messageInserts, {
            onConflict: 'external_message_id',
            ignoreDuplicates: true
          });

        if (upsertError) {
          throw upsertError;
        }
        
        upsertSuccess = true;
      } catch (error) { 
        // Handle missing constraint or other upsert failures
        
        // Pre-filter messages by checking which ones already exist
        const batchExternalIds = messageInserts.map(m => m.external_message_id);
        const { data: existingMessages } = await this.supabase
          .from('conversation_messages')
          .select('external_message_id')
          .in('external_message_id', batchExternalIds);
        
        const existingIds = existingMessages?.map(m => m.external_message_id) || [];
        const newMessagesToInsert = messageInserts.filter(m => 
          !existingIds.includes(m.external_message_id)
        );

        // Insert truly new messages in smaller batches to handle duplicates better
        if (newMessagesToInsert.length > 0) {
          const chunkSize = 10; // Smaller chunks to reduce duplicate collision risk
          
          for (let i = 0; i < newMessagesToInsert.length; i += chunkSize) {
            const chunk = newMessagesToInsert.slice(i, i + chunkSize);
            
            try {
              const { error: insertError } = await this.supabase
                .from('conversation_messages')
                .insert(chunk);

              if (insertError) {
                // Handle individual message conflicts
                if (insertError.message.includes('duplicate') || insertError.message.includes('unique')) {
                  
                  // Insert each message individually to skip duplicates
                  for (const message of chunk) {
                    try {
                      await this.supabase
                        .from('conversation_messages')
                        .insert(message);
                    } catch (individualError: any) { 
                      if (!individualError?.message?.includes('duplicate') && !individualError?.message?.includes('unique')) {
                        console.error(`❌ Failed to insert individual message ${message.external_message_id}:`, individualError?.message || individualError);
                      }
                      // Skip duplicates silently
                    }
                  }
                } else {
                  throw insertError;
                }
              }
            } catch (error: any) { 
              console.error(`❌ Failed to insert chunk for ${remoteJid}:`, error?.message || error);
              // Continue with next chunk
            }
          }
        }
      }

      processedCount += batch.length;
      
      // Progress update for large conversations
      if (newMessages.length > 100 && processedCount % 100 === 0) {
        console.log(`Processed ${processedCount}/${newMessages.length} messages for conversation ${remoteJid}`);
      }
    }

  }

  /**
   * Normalize Evolution API message types to standard types
   */
  private normalizeMessageType(evolutionMessageType: string): string {
    const typeMapping: Record<string, string> = {
      // Text messages
      'conversation': 'text',
      'extendedTextMessage': 'text',
      'buttonsMessage': 'text',
      'buttonsResponseMessage': 'text',
      'interactiveMessage': 'text',
      'templateMessage': 'text',
      
      // Media messages
      'imageMessage': 'image',
      'audioMessage': 'audio',
      'videoMessage': 'video',
      'documentMessage': 'document',
      'documentWithCaptionMessage': 'document',
      'ptvMessage': 'video', // PTV is a video message type
      'viewOnceMessageV2': 'image', // View once is typically image
      
      // Contact and location
      'contactMessage': 'contact',
      'contactsArrayMessage': 'contact',
      'locationMessage': 'location',
      
      // Stickers and reactions
      'stickerMessage': 'sticker',
      
      // Special message types - categorize as text for RAG processing
      'pollCreationMessageV2': 'text',
      'pollCreationMessageV3': 'text',
      'groupInviteMessage': 'text',
      'productMessage': 'text',
      'protocolMessage': 'text',
      'editedMessage': 'text',
      'commentMessage': 'text'
    };

    return typeMapping[evolutionMessageType] || 'text'; // Default to 'text' for unknown types
  }

  /**
   * Get messages for RAG with advanced filtering
   */
  async getMessagesForRAG(options: {
    conversationId?: string;
    remoteJid?: string;
    limit?: number;
    messageTypes?: string[];
    direction?: 'inbound' | 'outbound';
    senderType?: 'contact' | 'agent' | 'bot';
    dateRange?: { start: Date; end: Date };
    includeHistorical?: boolean;
    textOnly?: boolean;
  } = {}): Promise<any[]> {
    this.initialize();
    
    let query = this.supabase
      .from('conversation_messages')
      .select(`
        *,
        conversation:conversations(
          contact_name,
          contact_id,
          instance_key,
          external_conversation_id
        )
      `);

    // Apply filters
    if (options.conversationId) {
      query = query.eq('conversation_id', options.conversationId);
    }

    if (options.remoteJid) {
      query = query.eq('conversation.external_conversation_id', options.remoteJid);
    }

    if (options.messageTypes?.length) {
      query = query.in('message_type', options.messageTypes);
    }

    if (options.direction) {
      query = query.eq('direction', options.direction);
    }

    if (options.senderType) {
      query = query.eq('sender_type', options.senderType);
    }

    if (options.dateRange) {
      query = query
        .gte('external_timestamp', options.dateRange.start.toISOString())
        .lte('external_timestamp', options.dateRange.end.toISOString());
    }

    if (options.textOnly) {
      query = query.not('content', 'like', '[%]'); // Exclude media messages that start with [Type]
    }

    // Order by timestamp
    query = query.order('external_timestamp', { ascending: true });

    // Apply limit
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch messages for RAG: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get conversation context for RAG
   */
  async getConversationContext(remoteJid: string, options: {
    maxMessages?: number;
    includeMetadata?: boolean;
  } = {}): Promise<{
    conversation: any;
    messages: any[];
    summary: {
      totalMessages: number;
      timeSpan: { start: Date; end: Date } | null;
      messageTypes: string[];
      participantCount: number;
      keyTopics?: string[];
    };
  }> {
    this.initialize();
    
    // Get conversation
    const { data: conversation } = await this.supabase
      .from('conversations')
      .select('*')
      .eq('external_conversation_id', remoteJid)
      .single();

    if (!conversation) {
      throw new Error(`Conversation not found: ${remoteJid}`);
    }

    // Get messages
    const messages = await this.getMessagesForRAG({
      remoteJid,
      limit: options.maxMessages || 1000,
      textOnly: true
    });

    // Generate summary
    const messageTypes = [...new Set(messages.map(m => m.message_type))];
    const participants = [...new Set(messages.map(m => m.sender_id))];
    
    let timeSpan = null;
    if (messages.length > 0) {
      const timestamps = messages.map(m => new Date(m.external_timestamp));
      timeSpan = {
        start: new Date(Math.min(...timestamps.map(t => t.getTime()))),
        end: new Date(Math.max(...timestamps.map(t => t.getTime())))
      };
    }

    // Extract key topics (simple keyword extraction)
    const keyTopics = options.includeMetadata ? this.extractKeyTopics(messages) : undefined;

    return {
      conversation,
      messages,
      summary: {
        totalMessages: messages.length,
        timeSpan,
        messageTypes,
        participantCount: participants.length,
        keyTopics
      }
    };
  }

  /**
   * Simple key topic extraction from messages
   */
  private extractKeyTopics(messages: any[]): string[] {
    const textContent = messages
      .map(m => m.content)
      .filter(content => content && !content.startsWith('['))
      .join(' ')
      .toLowerCase();

    // Simple keyword extraction (this could be enhanced with NLP)
    const words = textContent.split(/\s+/);
    const wordCount: Record<string, number> = {};
    
    words
      .filter(word => word.length > 3 && !/^[0-9]+$/.test(word))
      .forEach(word => {
        wordCount[word] = (wordCount[word] || 0) + 1;
      });

    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Get sync progress for all instances
   */
  async getSyncProgress(): Promise<{
    totalInstances: number;
    totalConversations: number;
    totalMessages: number;
    lastSyncTime?: Date;
  }> {
    this.initialize();
    
    // Get total conversations
    const { count: conversationCount } = await this.supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('integration_type', 'whatsapp');

    // Get total messages
    const { count: messageCount } = await this.supabase
      .from('conversation_messages')
      .select('*', { count: 'exact', head: true });

    // Get instances
    const { count: instanceCount } = await this.supabase
      .from('whatsapp_instances')
      .select('*', { count: 'exact', head: true });

    // Get last sync time
    const { data: lastMessage } = await this.supabase
      .from('conversation_messages')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return {
      totalInstances: instanceCount || 0,
      totalConversations: conversationCount || 0,
      totalMessages: messageCount || 0,
      lastSyncTime: lastMessage ? new Date(lastMessage.created_at) : undefined
    };
  }
}

// Factory function for lazy initialization
let _instance: EvolutionMessageSyncService | null = null;

export function getEvolutionMessageSyncService(): EvolutionMessageSyncService {
  if (!_instance) {
    _instance = new EvolutionMessageSyncService();
  }
  return _instance;
}

// Export default instance for easy importing (lazy initialized)
export const evolutionMessageSync = {
  get instance() {
    return getEvolutionMessageSyncService();
  }
};

export default evolutionMessageSync; 