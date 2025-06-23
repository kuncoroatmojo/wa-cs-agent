/**
 * Unified Conversation Service
 * Manages conversations across all integrations (WhatsApp, Instagram, Web, etc.)
 * Provides RAG-ready conversation data and synchronization
 */

import { supabase as supabaseClient } from '../lib/supabase';
import { evolutionApiService } from './evolutionApiService';
import { getEvolutionMessageSyncService } from './evolutionMessageSync';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UnifiedMessage } from '../types';
import type { Database } from '../types/database';

export type DbResult<T> = T extends PromiseLike<infer U> ? U : never;
export type DbResultOk<T> = DbResult<T> extends { data: infer U } ? Exclude<U, null> : never;

export interface DatabaseResponse<T> {
  data: T | null;
  error: any;
}

export interface UnifiedConversation {
  id: string;
  user_id: string;
  integration_type: 'whatsapp' | 'instagram' | 'web' | 'api' | 'telegram' | 'messenger';
  integration_id?: string;
  instance_key?: string;
  contact_id: string;
  contact_name?: string;
  contact_metadata: Record<string, any>;
  status: 'active' | 'resolved' | 'archived' | 'handed_off';
  assigned_agent_id?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags: string[];
  message_count: number;
  last_message_at: string;
  last_message_preview?: string;
  last_message_from?: 'contact' | 'agent' | 'bot';
  conversation_summary?: string;
  conversation_topics: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  external_conversation_id?: string;
  last_synced_at: string;
  sync_status: 'synced' | 'pending' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface ConversationSyncEvent {
  id: string;
  user_id: string;
  integration_type: string;
  integration_id?: string;
  event_type: string;
  event_data: Record<string, any>;
  processed: boolean;
  processed_at?: string;
  error_message?: string;
  retry_count: number;
  created_at: string;
}

export class ConversationService {
  private supabase: SupabaseClient<Database>;

  constructor() {
    this.supabase = supabaseClient;
  }

  /**
   * Get all conversations for a user, ordered by latest message external timestamp
   */
  async getAllConversations(userId: string, filters?: {
    integration_type?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<UnifiedConversation[]> {
    try {
      // Use LEFT JOIN to get latest message external timestamp for ordering
      let query = this.supabase
        .from('conversations')
        .select(`
          *,
          latest_message:conversation_messages!left(external_timestamp)
        `)
        .eq('user_id', userId);

      if (filters?.integration_type) {
        query = query.eq('integration_type', filters.integration_type);
      }

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      if (filters?.offset) {
        query = query.range(filters.offset, (filters.offset + (filters.limit || 50)) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Error fetching conversations:', error);
        throw error;
      }

      if (!data) return [];

      // Sort conversations by latest message external timestamp, with fallback to last_message_at
      const sortedConversations = data.sort((a, b) => {
        // Get the latest external timestamp for each conversation
        const aLatestTimestamp = a.latest_message?.[0]?.external_timestamp || a.last_message_at;
        const bLatestTimestamp = b.latest_message?.[0]?.external_timestamp || b.last_message_at;
        
        // Sort in descending order (newest first)
        return new Date(bLatestTimestamp).getTime() - new Date(aLatestTimestamp).getTime();
      });

      // Clean up the latest_message field as it's only used for sorting
      return sortedConversations.map(conv => {
        const { latest_message, ...cleanConv } = conv;
        return cleanConv;
      });
    } catch (error) { 
      console.error('❌ Error in getAllConversations:', error);
      throw error;
    }
  }

  /**
   * Get messages for a specific conversation
   */
  async getConversationMessages(conversationId: string, limit = 50): Promise<UnifiedMessage[]> {
    try {
      
      // First, verify the conversation exists and get its details
      const { data: conv, error: convError } = await this.supabase
        .from('conversations')
        .select('id, external_conversation_id, contact_name, instance_key')
        .eq('id', conversationId)
        .single();

      if (convError || !conv) {
        console.error('❌ Conversation not found:', conversationId);
        return [];
      }


      // Query messages with proper ordering by external_timestamp (when available) or created_at
      // Order DESCENDING to get the most recent messages first (newest at top)
      const { data, error } = await this.supabase
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('external_timestamp', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ Error fetching conversation messages:', error);
        throw error;
      }

      // Log message count
      
      if (!data || data.length === 0) {
        
        // Try to sync messages from Evolution API if this is a WhatsApp conversation
        if (conv.instance_key && conv.external_conversation_id) {
          await this.syncConversationMessages(
            conversationId,
            conv.external_conversation_id,
            conv.instance_key
          );
          
          // Try fetching messages again after sync with proper ordering
          // Order DESCENDING to get the most recent messages first (newest at top)
          const { data: syncedData, error: syncError } = await this.supabase
            .from('conversation_messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('external_timestamp', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false })
            .limit(limit);
            
          if (syncError) {
            console.error('❌ Error fetching synced messages:', syncError);
            return [];
          }
          
          return syncedData || [];
        }
        
        return [];
      }

      // Log message details for debugging
      data.forEach((msg, idx) => {
        console.log(`Message ${idx + 1}:`, {
          id: msg.id,
          sender: msg.sender_name || msg.sender_id,
          type: msg.sender_type,
          direction: msg.direction,
          timestamp: msg.created_at,
          externalTimestamp: msg.external_timestamp,
          contentPreview: msg.content.substring(0, 50)
        });
      });

      return data as UnifiedMessage[];
    } catch (error) { 
      console.error('❌ Error in getConversationMessages:', error);
      throw error;
    }
  }

  /**
   * Create or update a conversation with proper duplicate checking
   */
  async upsertConversation(conversation: Partial<UnifiedConversation>): Promise<UnifiedConversation> {
    try {
      // First, check for existing conversation using external_conversation_id and instance_key
      if (conversation.external_conversation_id && conversation.instance_key) {
        const { data: existingConversations } = await this.supabase
          .from('conversations')
          .select('*')
          .eq('external_conversation_id', conversation.external_conversation_id)
          .eq('instance_key', conversation.instance_key)
          .limit(1);

        if (existingConversations && existingConversations.length > 0) {
          // Update the existing conversation
          const existingConv = existingConversations[0];
          const { data, error } = await this.supabase
            .from('conversations')
            .update({
              ...conversation,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingConv.id)
            .select()
            .single();

          if (error) {
            console.error('❌ Error updating existing conversation:', error);
            throw error;
          }

          return data;
        }
      }

      // If no existing conversation found, create a new one
      const { data, error } = await this.supabase
        .from('conversations')
        .upsert(conversation, {
          onConflict: 'user_id,integration_type,contact_id,integration_id'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error upserting conversation:', error);
        throw error;
      }

      return data;
    } catch (error) { 
      console.error('❌ Error in upsertConversation:', error);
      throw error;
    }
  }

  /**
   * Add a new message to the conversation
   */
  async addMessage(message: Partial<UnifiedMessage>) {
    return await this.supabase
      .from('conversation_messages')
      .insert(message)
      .select()
      .single();
  }

  /**
   * Sync WhatsApp conversations from Evolution API
   */
  async syncWhatsAppConversations(userId: string, instanceId: string): Promise<number> {
    try {
      
      // Get the instance details
      const { data: instance, error: instanceError } = await this.supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('id', instanceId)
        .eq('user_id', userId)
        .single();

      if (instanceError || !instance) {
        throw new Error('WhatsApp instance not found');
      }

      // Fetch conversations from Evolution API
      const evolutionConversationsData = await evolutionApiService.fetchAllConversations();
      
      let syncedCount = 0;
      
      // Find conversations for this specific instance
      const instanceConversations = evolutionConversationsData.find(
        data => data.instanceName === instance.instance_key || data.instanceName === instance.name
      );
      
      if (!instanceConversations) {
        return 0;
      }
      
      // Process each conversation
      for (const evConv of instanceConversations.conversations) {
        try {
          // Create unified conversation
          const conversation: Partial<UnifiedConversation> = {
            user_id: userId,
            integration_type: 'whatsapp',
            integration_id: instanceId,
            instance_key: instance.instance_key,
            contact_id: evConv.contactPhone,
            contact_name: evConv.contactName,
            contact_metadata: {
              remoteJid: evConv.remoteJid,
              instanceId: evConv.instanceId
            },
            external_conversation_id: evConv.remoteJid,
            last_synced_at: new Date().toISOString(),
            sync_status: 'synced',
            last_message_at: evConv.lastMessageAt,
            last_message_preview: evConv.lastMessagePreview
          };

          await this.upsertConversation(conversation);
          syncedCount++;
        } catch (error) { 
          console.error(`❌ Error syncing conversation ${evConv.contactPhone}:`, error);
        }
      }

      return syncedCount;
    } catch (error) { 
      console.error('❌ Error in syncWhatsAppConversations:', error);
      throw error;
    }
  }

  /**
   * Sync messages for a specific conversation
   */
  async syncConversationMessages(conversationId: string, externalConversationId: string, instanceKey: string): Promise<number> {
    try {

      // Fetch messages from Evolution API
      let messages: any[] = [];
      try {
        messages = await evolutionApiService.loadConversationMessages(externalConversationId, instanceKey);
      } catch (error) { 
        console.error('❌ Failed to sync messages from Evolution API:', error?.message || error);
        // Return 0 to indicate no messages were synced, but don't throw
        // This allows the app to continue working with local messages if Evolution API is temporarily unavailable
        return 0;
      }
      
      let syncedCount = 0;
      const errors: string[] = [];

      for (const msg of messages) {
        try {
          if (!msg.key?.id) {
            continue;
          }

          // Extract message content
          let content = '[Media]';
          let messageType = this.mapMessageType(msg.messageType);
          
          if (msg.message?.conversation) {
            content = msg.message.conversation;
          } else if (msg.message?.extendedTextMessage?.text) {
            content = msg.message.extendedTextMessage.text;
          } else if (msg.message?.imageMessage?.caption) {
            content = msg.message.imageMessage.caption;
            messageType = 'image';
          } else if (msg.message?.videoMessage?.caption) {
            content = msg.message.videoMessage.caption;
            messageType = 'video';
          }

          // Convert Evolution API message to unified format
          const unifiedMessage: Partial<UnifiedMessage> = {
            conversation_id: conversationId,
            content,
            message_type: messageType,
            direction: msg.key.fromMe ? 'outbound' : 'inbound',
            sender_type: msg.key.fromMe ? 'bot' : 'contact',
            sender_name: msg.pushName,
            sender_id: msg.key.fromMe ? instanceKey : msg.key.remoteJid,
            status: 'delivered',
            external_message_id: msg.key.id,
            external_timestamp: new Date(msg.messageTimestamp * 1000).toISOString(),
            external_metadata: msg,
            ai_processed: false,
            media_metadata: {},
            created_at: new Date(msg.messageTimestamp * 1000).toISOString(),
            updated_at: new Date().toISOString()
          };

          // Check if message already exists
          const { data: existingMessage } = await this.supabase
            .from('conversation_messages')
            .select('id')
            .eq('external_message_id', msg.key.id)
            .single();

          if (!existingMessage) {
            const { data, error } = await this.addMessage(unifiedMessage);
            if (error) {
              errors.push(`Failed to insert message ${msg.key.id}: ${error.message}`);
            } else {
              syncedCount++;
            }
          }
        } catch (error) { 
          console.error('❌ Error processing message:', error?.message || error);
          errors.push(error?.message || 'Unknown error processing message');
          continue;
        }
      }

      if (errors.length > 0) {
      }

      return syncedCount;
    } catch (error) { 
      console.error('❌ Failed to sync messages:', error?.message || error);
      throw error;
    }
  }

  /**
   * Send a message through the appropriate integration
   */
  async sendMessage(conversationId: string, content: string, messageType = 'text'): Promise<UnifiedMessage> {
    try {
      // Get conversation details
      const { data: conversation, error } = await this.supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (error || !conversation) {
        throw new Error('Conversation not found');
      }

      let sentMessage: any;

      // Route to appropriate integration
      switch (conversation.integration_type) {
        case 'whatsapp':
          sentMessage = await this.sendWhatsAppMessage(conversation, content, messageType);
          break;
        case 'instagram':
          // TODO: Implement Instagram messaging
          throw new Error('Instagram messaging not implemented yet');
        case 'web':
          // TODO: Implement web chat messaging
          throw new Error('Web chat messaging not implemented yet');
        default:
          throw new Error(`Unsupported integration type: ${conversation.integration_type}`);
      }

      // Store the sent message in our database
      const unifiedMessage: Partial<UnifiedMessage> = {
        conversation_id: conversationId,
        content,
        message_type: messageType as any,
        direction: 'outbound',
        sender_type: 'bot',
        status: 'sent',
        external_message_id: sentMessage.messageId || sentMessage.id,
        external_metadata: sentMessage
      };

      return await this.addMessage(unifiedMessage);
    } catch (error) { 
      console.error('❌ Error in sendMessage:', error);
      throw error;
    }
  }

  /**
   * Send WhatsApp message through Evolution API
   */
  private async sendWhatsAppMessage(conversation: UnifiedConversation, content: string, messageType: string): Promise<any> {
    try {
      // Extract phone number from remoteJid for Evolution API
      const phoneNumber = conversation.external_conversation_id?.replace('@s.whatsapp.net', '').replace('@g.us', '') || conversation.contact_id;
      
      return await evolutionApiService.sendTextMessage(
        conversation.instance_key!,
        phoneNumber,
        content
      );
    } catch (error) { 
      console.error('❌ Error sending WhatsApp message:', error);
      throw error;
    }
  }

  /**
   * Get conversation context for RAG
   */
  async getConversationContextForRAG(conversationId: string, messageLimit = 10): Promise<string> {
    try {
      const messages = await this.getConversationMessages(conversationId, messageLimit);
      
      // Format messages for RAG context
      const context = messages.map(msg => {
        const sender = msg.direction === 'inbound' ? 'Customer' : 'Assistant';
        return `${sender}: ${msg.content}`;
      }).join('\n');

      return context;
    } catch (error) { 
      console.error('❌ Error getting conversation context for RAG:', error);
      return '';
    }
  }

  /**
   * Update conversation summary and topics for RAG
   */
  async updateConversationRAGData(conversationId: string, summary: string, topics: string[], sentiment?: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('conversations')
        .update({
          conversation_summary: summary,
          conversation_topics: topics,
          sentiment: sentiment,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId);

      if (error) {
        console.error('❌ Error updating conversation RAG data:', error);
        throw error;
      }
    } catch (error) { 
      console.error('❌ Error in updateConversationRAGData:', error);
      throw error;
    }
  }

  /**
   * Create sync event for webhook processing
   */
  async createSyncEvent(event: Partial<ConversationSyncEvent>): Promise<ConversationSyncEvent> {
    try {
      const { data, error } = await this.supabase
        .from('conversation_sync_events')
        .insert(event)
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating sync event:', error);
        throw error;
      }

      return data;
    } catch (error) { 
      console.error('❌ Error in createSyncEvent:', error);
      throw error;
    }
  }

  /**
   * Process pending sync events
   */
  async processPendingSyncEvents(limit = 50): Promise<number> {
    try {
      const { data: events, error } = await this.supabase
        .from('conversation_sync_events')
        .select('*')
        .eq('processed', false)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ Error fetching pending sync events:', error);
        throw error;
      }

      let processedCount = 0;

      for (const event of events || []) {
        try {
          await this.processSyncEvent(event);
          
          // Mark as processed
          await this.supabase
            .from('conversation_sync_events')
            .update({
              processed: true,
              processed_at: new Date().toISOString()
            })
            .eq('id', event.id);

          processedCount++;
        } catch (error) { 
          console.error(`❌ Error processing sync event ${event.id}:`, error);
          
          // Update retry count and error message
          await this.supabase
            .from('conversation_sync_events')
            .update({
              retry_count: event.retry_count + 1,
              error_message: error instanceof Error ? error.message : 'Unknown error'
            })
            .eq('id', event.id);
        }
      }

      return processedCount;
    } catch (error) { 
      console.error('❌ Error in processPendingSyncEvents:', error);
      throw error;
    }
  }

  /**
   * Process a single sync event
   */
  private async processSyncEvent(event: ConversationSyncEvent): Promise<void> {
    switch (event.event_type) {
      case 'message_received':
        await this.handleMessageReceivedEvent(event);
        break;
      case 'message_sent':
        await this.handleMessageSentEvent(event);
        break;
      case 'status_update':
        await this.handleStatusUpdateEvent(event);
        break;
      default:
    }
  }

  /**
   * Handle incoming message webhook event
   */
  private async handleMessageReceivedEvent(event: ConversationSyncEvent): Promise<void> {
    // Implementation depends on the specific webhook format
    // This is a placeholder for webhook processing logic
  }

  /**
   * Handle sent message webhook event
   */
  private async handleMessageSentEvent(event: ConversationSyncEvent): Promise<void> {
    // Implementation depends on the specific webhook format
  }

  /**
   * Handle status update webhook event
   */
  private async handleStatusUpdateEvent(event: ConversationSyncEvent): Promise<void> {
    // Implementation depends on the specific webhook format
  }

  /**
   * Map Evolution API message type to unified message type
   */
  private mapMessageType(messageType?: string): 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'contact' | 'sticker' | 'reaction' {
    switch (messageType) {
      case 'imageMessage':
        return 'image';
      case 'audioMessage':
        return 'audio';
      case 'videoMessage':
        return 'video';
      case 'documentMessage':
        return 'document';
      case 'locationMessage':
        return 'location';
      case 'contactMessage':
        return 'contact';
      case 'stickerMessage':
        return 'sticker';
      case 'reactionMessage':
        return 'reaction';
      default:
        return 'text';
    }
  }

  /**
   * Archive conversations for a deleted instance
   */
  async archiveInstanceConversations(instanceKey: string): Promise<number> {
    try {
      
      const { data, error } = await this.supabase
        .from('conversations')
        .update({
          status: 'archived',
          sync_status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('instance_key', instanceKey)
        .select('id');

      if (error) {
        console.error('❌ Error archiving conversations:', error);
        throw error;
      }

      const archivedCount = data?.length || 0;
      return archivedCount;
    } catch (error) { 
      console.error('❌ Error in archiveInstanceConversations:', error);
      throw error;
    }
  }

  /**
   * Delete all conversations for a deleted instance
   */
  async deleteInstanceConversations(instanceKey: string): Promise<number> {
    try {
      
      // First delete all messages for these conversations
      const { data: conversations } = await this.supabase
        .from('conversations')
        .select('id')
        .eq('instance_key', instanceKey);

      if (conversations && conversations.length > 0) {
        const conversationIds = conversations.map(c => c.id);
        
        // Delete all messages for these conversations
        const { error: messagesError } = await this.supabase
          .from('conversation_messages')
          .delete()
          .in('conversation_id', conversationIds);

        if (messagesError) {
          console.error('❌ Error deleting conversation messages:', messagesError);
          throw messagesError;
        }
      }

      // Then delete the conversations
      const { data, error } = await this.supabase
        .from('conversations')
        .delete()
        .eq('instance_key', instanceKey)
        .select('id');

      if (error) {
        console.error('❌ Error deleting conversations:', error);
        throw error;
      }

      const deletedCount = data?.length || 0;
      return deletedCount;
    } catch (error) { 
      console.error('❌ Error in deleteInstanceConversations:', error);
      throw error;
    }
  }

  /**
   * Sync all messages for all conversations from Evolution API (for RAG)
   */
  async syncAllMessagesForRAG(userId: string, instanceKey?: string): Promise<{
    totalConversations: number;
    totalMessagesSynced: number;
    errors: string[];
  }> {
    try {
      
      // Get all WhatsApp instances for the user
      let instanceQuery = this.supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'connected');

      if (instanceKey) {
        instanceQuery = instanceQuery.eq('instance_key', instanceKey);
      }

      const { data: instances, error: instanceError } = await instanceQuery;

      if (instanceError) {
        throw new Error(`Failed to get instances: ${instanceError.message}`);
      }

      if (!instances || instances.length === 0) {
        return {
          totalConversations: 0,
          totalMessagesSynced: 0,
          errors: ['No connected WhatsApp instances found']
        };
      }

      let totalConversations = 0;
      let totalMessagesSynced = 0;
      const errors: string[] = [];

      // Sync messages for each instance
      for (const instance of instances) {
        try {

          // Get Evolution API configuration
          const evolutionApiUrl = import.meta.env.VITE_EVOLUTION_API_URL;
          const evolutionApiKey = import.meta.env.VITE_EVOLUTION_API_KEY;

          if (!evolutionApiUrl || !evolutionApiKey) {
            const error = 'Evolution API URL or key not configured';
            console.error('❌', error);
            errors.push(error);
            continue;
          }

          // Use the evolution message sync service
          const syncResult = await getEvolutionMessageSyncService().syncAllMessages(
            instance.instance_key
          );

          if (syncResult.status === 'completed') {
            totalMessagesSynced += syncResult.processedMessages;
          } else {
            errors.push(...syncResult.errors);
          }

          // Count conversations for this instance
          const { count } = await this.supabase
            .from('conversations')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('integration_type', 'whatsapp')
            .eq('integration_id', instance.id);

          totalConversations += count || 0;

        } catch (error) { 
          const errorMsg = `Error syncing instance ${instance.instance_key}: ${error.message}`;
          console.error('❌', errorMsg);
          errors.push(errorMsg);
        }
      }

      console.log(`🎉 Message sync completed:`, {
        totalConversations,
        totalMessagesSynced,
        errorCount: errors.length
      });

      return {
        totalConversations,
        totalMessagesSynced,
        errors
      };

    } catch (error) { 
      console.error('❌ Error in syncAllMessagesForRAG:', error);
      throw error;
    }
  }

  /**
   * Get messages for RAG context with filtering options
   */
  async getMessagesForRAG(conversationId: string, options?: {
    limit?: number;
    includeHistorical?: boolean;
    messageTypes?: string[];
    dateRange?: {
      from: Date;
      to: Date;
    };
  }): Promise<{
    messages: UnifiedMessage[];
    conversationContext: {
      summary: string;
      keyTopics: string[];
      messageCount: number;
      timeSpan: { start: Date; end: Date } | null;
    };
  }> {
    try {
      // Use the evolution message sync service for advanced filtering
      const messagesResult = await getEvolutionMessageSyncService().getMessagesForRAG(conversationId, options);
      const contextResult = await getEvolutionMessageSyncService().getConversationContext(conversationId);

      return {
        messages: messagesResult.messages as UnifiedMessage[],
        conversationContext: contextResult
      };
    } catch (error) { 
      console.error('❌ Error getting messages for RAG:', error);
      
      // Fallback to basic conversation messages
      const messages = await this.getConversationMessages(conversationId, options?.limit || 50);
      
      return {
        messages,
        conversationContext: {
          summary: `Conversation with ${messages.length} messages`,
          keyTopics: [],
          messageCount: messages.length,
          timeSpan: messages.length > 0 ? {
            start: new Date(messages[0].created_at),
            end: new Date(messages[messages.length - 1].created_at)
          } : null
        }
      };
    }
  }

  /**
   * Get sync progress for an instance
   */
  getSyncProgress(instanceKey: string) {
    return getEvolutionMessageSyncService().getSyncProgress(instanceKey);
  }
}

export const conversationService = new ConversationService(); 