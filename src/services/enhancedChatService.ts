import { supabase } from '../lib/supabase'
import { ragService } from './ragService'
import { handoffService } from './handoffService'
import type { 
  ChatSession, 
  ChatMessage, 
  ConversationContext,
  UsageMetrics,
  PerformanceMetrics,
  RAGMetrics
} from '../types'

export interface EnhancedChatResponse {
  message: ChatMessage
  ragResponse?: {
    sources: any[]
    confidence: number
    responseTimeMs: number
  }
  handoffEvaluation?: {
    shouldHandoff: boolean
    reason: string
    urgency: 'low' | 'medium' | 'high'
  }
  conversationContext: ConversationContext
  metrics: {
    tokensUsed: number
    responseTimeMs: number
    confidenceScore: number
  }
}

export interface ChatServiceOptions {
  useRAG?: boolean
  enableHandoffEvaluation?: boolean
  maxContextMessages?: number
  ragOptions?: {
    searchThreshold?: number
    maxSources?: number
    includeConversationContext?: boolean
  }
}

export class EnhancedChatService {
  private static instance: EnhancedChatService

  static getInstance(): EnhancedChatService {
    if (!EnhancedChatService.instance) {
      EnhancedChatService.instance = new EnhancedChatService()
    }
    return EnhancedChatService.instance
  }

  /**
   * Process an incoming message with full RAG and handoff evaluation
   */
  async processMessage(
    userId: string,
    sessionId: string,
    messageContent: string,
    options: ChatServiceOptions = {}
  ): Promise<EnhancedChatResponse> {
    const startTime = Date.now()
    
    try {
      // Default options
      const {
        useRAG = true,
        enableHandoffEvaluation = true,
        maxContextMessages = 10,
        ragOptions = {}
      } = options

      // Get or create session
      const session = await this.getSession(sessionId)
      if (!session) {
        throw new Error('Session not found')
      }

      // Store user message
      const userMessage = await this.storeMessage(sessionId, {
        role: 'user',
        content: messageContent,
        message_type: 'text',
        metadata: {}
      })

      // Get conversation context
      const conversationContext = await ragService.getConversationContext(sessionId)
      
      // Get conversation history for RAG
      const conversationHistory = conversationContext.recentMessages.slice(0, maxContextMessages)

      // Generate AI response using RAG
      const ragResponse = await ragService.generateContextualResponse(
        userId,
        sessionId,
        messageContent,
        conversationHistory,
        useRAG,
        ragOptions
      )

      // Store AI response
      const assistantMessage = await this.storeMessage(sessionId, {
        role: 'assistant',
        content: ragResponse.response,
        message_type: 'text',
        metadata: {
          rag_sources: ragResponse.sources,
          confidence: ragResponse.confidence,
          tokens_used: ragResponse.tokensUsed
        },
        tokens_used: ragResponse.tokensUsed,
        confidence_score: ragResponse.confidence,
        response_time_ms: ragResponse.responseTimeMs
      })

      // Store RAG context
      if (ragResponse.ragContext) {
        await ragService.storeRAGContext(assistantMessage.id, ragResponse.ragContext)
      }

      // Evaluate handoff need
      let handoffEvaluation
      if (enableHandoffEvaluation) {
        handoffEvaluation = await handoffService.evaluateHandoffNeed(
          userMessage,
          conversationContext,
          ragResponse.confidence,
          {
            sources: ragResponse.sources,
            responseTimeMs: ragResponse.responseTimeMs
          }
        )

        // Create handoff request if needed
        if (handoffEvaluation.shouldHandoff) {
          await handoffService.createHandoffRequest(sessionId, handoffEvaluation, {
            user_message: messageContent,
            ai_response: ragResponse.response,
            confidence: ragResponse.confidence
          })
        }
      }

      // Update session metadata
      await this.updateSessionMetadata(sessionId, {
        last_confidence: ragResponse.confidence,
        last_response_time: ragResponse.responseTimeMs,
        message_count: conversationHistory.length + 2, // +2 for new user and assistant messages
        handoff_evaluation: handoffEvaluation
      })

      const totalResponseTime = Date.now() - startTime

      return {
        message: assistantMessage,
        ragResponse: {
          sources: ragResponse.sources,
          confidence: ragResponse.confidence,
          responseTimeMs: ragResponse.responseTimeMs
        },
        handoffEvaluation,
        conversationContext,
        metrics: {
          tokensUsed: ragResponse.tokensUsed,
          responseTimeMs: totalResponseTime,
          confidenceScore: ragResponse.confidence
        }
      }
    } catch { // Ignored 
      console.error('Error processing message:', error)
      
      // Fallback response
      const fallbackMessage = await this.storeMessage(sessionId, {
        role: 'assistant',
        content: "I apologize, but I'm experiencing technical difficulties. Please try again or contact human support if the issue persists.",
        message_type: 'text',
        metadata: { error: true },
        confidence_score: 0.1,
        response_time_ms: Date.now() - startTime
      })

      const conversationContext = await ragService.getConversationContext(sessionId)

      return {
        message: fallbackMessage,
        conversationContext,
        metrics: {
          tokensUsed: 0,
          responseTimeMs: Date.now() - startTime,
          confidenceScore: 0.1
        }
      }
    }
  }

  /**
   * Get sessions with enhanced analytics
   */
  async getSessionsWithAnalytics(
    userId: string,
    options?: {
      includeMetrics?: boolean
      limit?: number
      offset?: number
      filterActive?: boolean
    }
  ): Promise<{
    sessions: ChatSession[]
    totalCount: number
    analytics?: {
      totalSessions: number
      activeSessions: number
      avgMessagesPerSession: number
      avgConfidence: number
      handoffRate: number
    }
  }> {
    try {
      const {
        includeMetrics = false,
        limit = 50,
        offset = 0,
        filterActive
      } = options || {}

      // Build query
      let query = supabase
        .from('chat_sessions')
        .select(`
          *,
          messages:chat_messages(
            id,
            role,
            content,
            created_at,
            confidence_score,
            tokens_used,
            response_time_ms
          ),
          handoff_requests(
            id,
            reason,
            urgency,
            status,
            created_at
          )
        `, { count: 'exact' })
        .eq('user_id', userId)
        .order('last_message_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (filterActive !== undefined) {
        query = query.eq('is_active', filterActive)
      }

      const { data, error, count } = await query

      if (error) throw error

      const sessions = data || []

      let analytics
      if (includeMetrics) {
        analytics = await this.calculateSessionAnalytics(userId)
      }

      return {
        sessions,
        totalCount: count || 0,
        analytics
      }
    } catch { // Ignored 
      console.error('Error fetching sessions with analytics:', error)
      return {
        sessions: [],
        totalCount: 0
      }
    }
  }

  /**
   * Get detailed conversation analytics
   */
  async getConversationAnalytics(sessionId: string): Promise<{
    messageCount: number
    avgResponseTime: number
    sentimentScore: number
    complexityScore: number
    handoffProbability: number
    topTopics: string[]
    confidenceDistribution: { range: string; count: number }[]
    timeline: { date: string; messageCount: number }[]
  }> {
    try {
      // Get basic metrics from database function
      const { data: metrics, error } = await supabase.rpc('analyze_conversation_metrics', {
        session_id: sessionId
      })

      if (error) throw error

      const basicMetrics = metrics[0] || {
        message_count: 0,
        avg_response_time_ms: 0,
        sentiment_score: 0.5,
        complexity_score: 0.5,
        handoff_probability: 0
      }

      // Get additional analytics
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })

      const conversationMessages = messages || []

      // Extract topics
      const topTopics = this.extractTopTopics(conversationMessages)

      // Calculate confidence distribution
      const confidenceDistribution = this.calculateConfidenceDistribution(conversationMessages)

      // Generate timeline
      const timeline = this.generateMessageTimeline(conversationMessages)

      return {
        messageCount: basicMetrics.message_count,
        avgResponseTime: basicMetrics.avg_response_time_ms,
        sentimentScore: basicMetrics.sentiment_score,
        complexityScore: basicMetrics.complexity_score,
        handoffProbability: basicMetrics.handoff_probability,
        topTopics,
        confidenceDistribution,
        timeline
      }
    } catch { // Ignored 
      console.error('Error fetching conversation analytics:', error)
      return {
        messageCount: 0,
        avgResponseTime: 0,
        sentimentScore: 0.5,
        complexityScore: 0.5,
        handoffProbability: 0,
        topTopics: [],
        confidenceDistribution: [],
        timeline: []
      }
    }
  }

  /**
   * Get usage metrics for dashboard
   */
  async getUsageMetrics(
    userId: string,
    timeRange?: { start: string; end: string }
  ): Promise<UsageMetrics> {
    try {
      const startDate = timeRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const endDate = timeRange?.end || new Date().toISOString()

      const { data, error } = await supabase.rpc('get_usage_statistics', {
        user_id: userId,
        start_date: startDate,
        end_date: endDate
      })

      if (error) throw error

      const stats = data[0] || {
        total_sessions: 0,
        total_messages: 0,
        avg_response_time: 0,
        total_tokens_used: 0,
        handoff_rate: 0,
        avg_confidence: 0,
        active_sessions: 0
      }

      return {
        total_sessions: stats.total_sessions,
        total_messages: stats.total_messages,
        avg_response_time: stats.avg_response_time,
        total_tokens_used: stats.total_tokens_used,
        handoff_rate: stats.handoff_rate,
        avg_confidence: stats.avg_confidence,
        active_sessions: stats.active_sessions
      }
    } catch { // Ignored 
      console.error('Error fetching usage metrics:', error)
      return {
        total_sessions: 0,
        total_messages: 0,
        avg_response_time: 0,
        total_tokens_used: 0,
        handoff_rate: 0,
        avg_confidence: 0,
        active_sessions: 0
      }
    }
  }

  /**
   * Get RAG performance metrics
   */
  async getRAGMetrics(
    userId: string,
    timeRange?: { start: string; end: string }
  ): Promise<RAGMetrics> {
    try {
      const startDate = timeRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const endDate = timeRange?.end || new Date().toISOString()

      const { data: ragContexts, error } = await supabase
        .from('rag_contexts')
        .select(`
          *,
          message:chat_messages(
            session_id,
            confidence_score,
            created_at,
            session:chat_sessions(user_id)
          )
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .eq('message.session.user_id', userId)

      if (error) throw error

      const contexts = ragContexts || []

      // Calculate metrics
      const avgSimilarityScore = contexts.length > 0
        ? contexts.reduce((sum, ctx) => {
            const avgScore = ctx.similarity_scores.reduce((a: number, b: number) => a + b, 0) / ctx.similarity_scores.length
            return sum + avgScore
          }, 0) / contexts.length
        : 0

      const documentsUsed = new Set(
        contexts.flatMap(ctx => ctx.source_documents)
      ).size

      const successfulRetrievals = contexts.filter(ctx => 
        ctx.source_documents.length > 0
      ).length

      const failedRetrievals = contexts.length - successfulRetrievals

      return {
        avg_similarity_score: avgSimilarityScore,
        documents_used: documentsUsed,
        successful_retrievals: successfulRetrievals,
        failed_retrievals: failedRetrievals
      }
    } catch { // Ignored 
      console.error('Error fetching RAG metrics:', error)
      return {
        avg_similarity_score: 0,
        documents_used: 0,
        successful_retrievals: 0,
        failed_retrievals: 0
      }
    }
  }

  /**
   * Batch process multiple messages for testing or import
   */
  async batchProcessMessages(
    userId: string,
    sessionId: string,
    messages: Array<{
      content: string
      sender: 'user' | 'system'
      timestamp?: string
    }>,
    options: ChatServiceOptions = {}
  ): Promise<{
    processedCount: number
    errors: Array<{ index: number; error: string }>
    responses: EnhancedChatResponse[]
  }> {
    const responses: EnhancedChatResponse[] = []
    const errors: Array<{ index: number; error: string }> = []
    let processedCount = 0

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i]
      
      try {
        if (message.sender === 'user') {
          const response = await this.processMessage(
            userId,
            sessionId,
            message.content,
            {
              ...options,
              // Disable handoff evaluation for batch processing by default
              enableHandoffEvaluation: options.enableHandoffEvaluation ?? false
            }
          )
          responses.push(response)
        } else {
          // Store system message directly
          const systemMessage = await this.storeMessage(sessionId, {
            role: 'system',
            content: message.content,
            message_type: 'text',
            metadata: { batch_import: true }
          })
          
          // Create a mock response for consistency
          const conversationContext = await ragService.getConversationContext(sessionId)
          responses.push({
            message: systemMessage,
            conversationContext,
            metrics: {
              tokensUsed: 0,
              responseTimeMs: 0,
              confidenceScore: 1
            }
          })
        }
        
        processedCount++
      } catch { // Ignored 
        errors.push({
          index: i,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return {
      processedCount,
      errors,
      responses
    }
  }

  /**
   * Archive old conversations
   */
  async archiveConversations(
    userId: string,
    criteria: {
      olderThanDays?: number
      inactive?: boolean
      resolved?: boolean
    }
  ): Promise<{
    archivedCount: number
    archivedSessions: string[]
  }> {
    try {
      const {
        olderThanDays = 90,
        inactive = true,
        resolved = true
      } = criteria

      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString()

      // Build query conditions
      let query = supabase
        .from('chat_sessions')
        .select('id')
        .eq('user_id', userId)
        .lt('last_message_at', cutoffDate)

      if (inactive) {
        query = query.eq('is_active', false)
      }

      const { data: sessionsToArchive, error } = await query

      if (error) throw error

      const sessionIds = (sessionsToArchive || []).map(s => s.id)

      if (sessionIds.length === 0) {
        return { archivedCount: 0, archivedSessions: [] }
      }

      // Update sessions to archived status
      const { error: updateError } = await supabase
        .from('chat_sessions')
        .update({
          is_active: false,
          session_metadata: {
            archived_at: new Date().toISOString(),
            archived_reason: 'automatic_archival'
          }
        })
        .in('id', sessionIds)

      if (updateError) throw updateError

      return {
        archivedCount: sessionIds.length,
        archivedSessions: sessionIds
      }
    } catch { // Ignored 
      console.error('Error archiving conversations:', error)
      return { archivedCount: 0, archivedSessions: [] }
    }
  }

  // Private helper methods

  private async getSession(sessionId: string): Promise<ChatSession | null> {
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

  private async storeMessage(
    sessionId: string,
    messageData: {
      role: 'user' | 'assistant' | 'system'
      content: string
      message_type: string
      metadata: Record<string, any>
      tokens_used?: number
      confidence_score?: number
      response_time_ms?: number
    }
  ): Promise<ChatMessage> {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        ...messageData
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  private async updateSessionMetadata(
    sessionId: string,
    metadata: Record<string, any>
  ): Promise<void> {
    const { error } = await supabase
      .from('chat_sessions')
      .update({
        session_metadata: metadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    if (error) {
      console.error('Error updating session metadata:', error)
    }
  }

  private async calculateSessionAnalytics(userId: string) {
    const { data: sessionStats } = await supabase
      .from('chat_sessions')
      .select(`
        id,
        is_active,
        messages:chat_messages(confidence_score),
        handoff_requests(id)
      `)
      .eq('user_id', userId)

    const sessions = sessionStats || []
    const totalSessions = sessions.length
    const activeSessions = sessions.filter(s => s.is_active).length
    
    const totalMessages = sessions.reduce((sum, s) => sum + (s.messages?.length || 0), 0)
    const avgMessagesPerSession = totalSessions > 0 ? totalMessages / totalSessions : 0
    
    const confidenceScores = sessions
      .flatMap(s => s.messages || [])
      .map(m => m.confidence_score)
      .filter(score => score !== null && score !== undefined)
    
    const avgConfidence = confidenceScores.length > 0
      ? confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length
      : 0

    const handoffCount = sessions.reduce((sum, s) => sum + (s.handoff_requests?.length || 0), 0)
    const handoffRate = totalSessions > 0 ? (handoffCount / totalSessions) * 100 : 0

    return {
      totalSessions,
      activeSessions,
      avgMessagesPerSession,
      avgConfidence,
      handoffRate
    }
  }

  private extractTopTopics(messages: ChatMessage[]): string[] {
    // Simple topic extraction - could be enhanced with NLP
    const userMessages = messages
      .filter(m => m.role === 'user')
      .map(m => m.content.toLowerCase())
    
    const wordCounts: Record<string, number> = {}
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'])
    
    userMessages.forEach(message => {
      const words = message
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3 && !stopWords.has(word))
      
      words.forEach(word => {
        wordCounts[word] = (wordCounts[word] || 0) + 1
      })
    })
    
    return Object.entries(wordCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word)
  }

  private calculateConfidenceDistribution(messages: ChatMessage[]): { range: string; count: number }[] {
    const assistantMessages = messages.filter(m => 
      m.role === 'assistant' && 
      m.confidence_score !== null && 
      m.confidence_score !== undefined
    )
    
    const ranges = [
      { range: '0.0-0.2', min: 0, max: 0.2 },
      { range: '0.2-0.4', min: 0.2, max: 0.4 },
      { range: '0.4-0.6', min: 0.4, max: 0.6 },
      { range: '0.6-0.8', min: 0.6, max: 0.8 },
      { range: '0.8-1.0', min: 0.8, max: 1.0 }
    ]
    
    return ranges.map(range => ({
      range: range.range,
      count: assistantMessages.filter(m => 
        m.confidence_score! >= range.min && m.confidence_score! < range.max
      ).length
    }))
  }

  private generateMessageTimeline(messages: ChatMessage[]): { date: string; messageCount: number }[] {
    const dailyCounts: Record<string, number> = {}
    
    messages.forEach(message => {
      const date = new Date(message.created_at).toISOString().split('T')[0]
      dailyCounts[date] = (dailyCounts[date] || 0) + 1
    })
    
    return Object.entries(dailyCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, messageCount]) => ({ date, messageCount }))
  }
}

// Export singleton instance
export const enhancedChatService = EnhancedChatService.getInstance() 