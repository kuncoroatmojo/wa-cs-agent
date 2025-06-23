import { supabase } from '../lib/supabase'
import type { ChatSession, ChatMessage } from '../types'

export class ChatService {
  async getSessionsBySender(userId: string): Promise<ChatSession[]> {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  async createOrGetSession(
    userId: string,
    senderId: string,
    senderType: string,
    senderName?: string
  ): Promise<ChatSession> {
    // Check if session exists
    const { data: existing } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('sender_id', senderId)
      .eq('sender_type', senderType)
      .single()

    if (existing) return existing

    // Create new session
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: userId,
        sender_id: senderId,
        sender_type: senderType,
        sender_name: senderName,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (error) {
      console.error('Error fetching session:', error)
      return null
    }
    return data
  }

  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  }

  async sendMessage(
    sessionId: string,
    content: string,
    role: 'user' | 'assistant' = 'user',
    metadata: Record<string, any> = {}
  ): Promise<ChatMessage> {
    const message = {
      session_id: sessionId,
      role,
      content,
      metadata
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .insert(message)
      .select()
      .single()

    if (error) throw error

    // Update session last_message_at
    await supabase
      .from('chat_sessions')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', sessionId)

    return data
  }

  /**
   * Send message with RAG-powered AI response
   */
  async sendMessageWithRAG(
    sessionId: string,
    content: string,
    options: {
      useRAG?: boolean;
      senderType?: string;
      senderId?: string;
    } = {}
  ): Promise<{ userMessage: ChatMessage; aiResponse: ChatMessage }> {
    const { useRAG = true, senderType = 'dashboard', senderId = 'user' } = options

    // Store user message
    const userMessage = await this.sendMessage(sessionId, content, 'user')

    try {
      // Generate AI response using RAG
      const { data, error } = await supabase.functions.invoke('chat-completion', {
        body: {
          session_id: sessionId,
          message: content,
          sender_id: senderId,
          sender_type: senderType,
          use_rag: useRAG
        }
      })

      if (error) throw error

      // The Edge Function already stores the AI response, so we need to fetch it
      const { data: aiMessage, error: fetchError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('id', data.message_id)
        .single()

      if (fetchError) throw fetchError

      return {
        userMessage,
        aiResponse: aiMessage
      }
    } catch (error) { 
      // If AI response fails, store an error message
      const errorMessage = await this.sendMessage(
        sessionId,
        'I apologize, but I encountered an error processing your request. Please try again.',
        'assistant',
        { error: true, error_message: error instanceof Error ? error.message : 'Unknown error' }
      )

      return {
        userMessage,
        aiResponse: errorMessage
      }
    }
  }

  async updateSessionStatus(sessionId: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('chat_sessions')
      .update({ is_active: isActive })
      .eq('id', sessionId)

    if (error) throw error
  }

  async deleteSession(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId)

    if (error) throw error
  }

  // Real-time subscription for chat updates
  subscribeToSession(sessionId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`session_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${sessionId}`
        },
        callback
      )
      .subscribe()
  }
}

export const chatService = new ChatService() 