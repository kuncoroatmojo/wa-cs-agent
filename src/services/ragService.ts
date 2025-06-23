import { supabase } from '../lib/supabase'
import type { ChatMessage, DocumentChunk, AIConfiguration, ConversationContext } from '../types'

export interface DocumentChunk {
  id: string
  content: string
  similarity: number
  source_id: string
  source_type: 'document' | 'webpage'
  metadata: Record<string, any>
}

export interface RAGResponse {
  response: string
  sources: DocumentChunk[]
  confidence: number
  tokensUsed: number
  responseTimeMs: number
  ragContext: {
    retrievalQuery: string
    sourceDocuments: string[]
    similarityScores: number[]
    contextUsed: string
  }
}

export class RAGService {
  private static instance: RAGService
  private openaiApiKey: string | null = null
  private anthropicApiKey: string | null = null

  constructor() {
    // Singleton pattern to avoid multiple instances
  }

  static getInstance(): RAGService {
    if (!RAGService.instance) {
      RAGService.instance = new RAGService()
    }
    return RAGService.instance
  }

  /**
   * Initialize with API keys from active AI configuration
   */
  async initialize(userId: string): Promise<void> {
    const aiConfig = await this.getActiveAIConfig(userId)
    if (aiConfig) {
      if (aiConfig.provider === 'openai') {
        this.openaiApiKey = aiConfig.api_key
      } else if (aiConfig.provider === 'anthropic') {
        this.anthropicApiKey = aiConfig.api_key
      }
    }
  }

  /**
   * Perform semantic search across user's knowledge base
   */
  async performSemanticSearch(
    userId: string,
    query: string,
    limit: number = 10,
    threshold: number = 0.7,
    sourceTypes?: ('document' | 'webpage')[]
  ): Promise<DocumentChunk[]> {
    try {
      // Generate query embedding
      const embedding = await this.generateEmbedding(query, userId)
      if (!embedding) {
        return []
      }
      
      // Build query with optional source type filtering
      let rpcQuery = supabase.rpc('match_documents', {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: limit,
        user_id: userId
      })

      if (sourceTypes && sourceTypes.length > 0) {
        // Note: This would require updating the RPC function to support source type filtering
      }

      const { data, error } = await rpcQuery

      if (error) {
        console.error('Semantic search error:', error)
        return []
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        content: item.chunk_text,
        similarity: item.similarity,
        source_id: item.source_id,
        source_type: item.source_type,
        metadata: item.metadata || {}
      }))
    } catch { // Ignored 
      console.error('Error in semantic search:', error)
      return []
    }
  }

  /**
   * Generate contextual response using RAG with conversation history
   */
  async generateContextualResponse(
    userId: string,
    sessionId: string,
    userMessage: string,
    conversationHistory: ChatMessage[],
    useRAG: boolean = true,
    ragOptions?: {
      searchThreshold?: number
      maxSources?: number
      includeConversationContext?: boolean
    }
  ): Promise<RAGResponse> {
    const startTime = Date.now()
    
    try {
      // Initialize API keys
      await this.initialize(userId)

      let context = ""
      let sources: DocumentChunk[] = []
      let retrievalQuery = userMessage
      
      if (useRAG) {
        // Enhance query with conversation context for better retrieval
        if (ragOptions?.includeConversationContext !== false && conversationHistory.length > 0) {
          retrievalQuery = this.enhanceQueryWithContext(userMessage, conversationHistory)
        }

        // Retrieve relevant documents
        sources = await this.performSemanticSearch(
          userId, 
          retrievalQuery,
          ragOptions?.maxSources || 8,
          ragOptions?.searchThreshold || 0.7
        )
        
        // Build context from sources
        context = this.buildContextFromSources(sources)
      }

      // Build conversation context
      const conversationContext = this.buildConversationContext(conversationHistory)

      // Get AI configuration
      const aiConfig = await this.getActiveAIConfig(userId)
      if (!aiConfig) {
        throw new Error('No active AI configuration found')
      }
      
      // Generate response based on provider
      const response = await this.generateResponse(
        aiConfig,
        userMessage,
        context,
        conversationContext
      )

      // Calculate confidence and metrics
      const confidence = this.calculateConfidence(sources, userMessage, response.content)
      const responseTimeMs = Date.now() - startTime

      // Store RAG context for future reference
      const ragContextData = {
        retrievalQuery,
        sourceDocuments: sources.map(s => s.source_id),
        similarityScores: sources.map(s => s.similarity),
        contextUsed: context
      }

      return {
        response: response.content,
        sources,
        confidence,
        tokensUsed: response.tokensUsed,
        responseTimeMs,
        ragContext: ragContextData
      }
    } catch { // Ignored 
      console.error('Error generating contextual response:', error)
      
      // Fallback response
      return {
        response: "I apologize, but I'm experiencing technical difficulties. Please try again or contact human support if the issue persists.",
        sources: [],
        confidence: 0.1,
        tokensUsed: 0,
        responseTimeMs: Date.now() - startTime,
        ragContext: {
          retrievalQuery: userMessage,
          sourceDocuments: [],
          similarityScores: [],
          contextUsed: ""
        }
      }
    }
  }

  /**
   * Enhanced query generation using conversation context
   */
  private enhanceQueryWithContext(userMessage: string, conversationHistory: ChatMessage[]): string {
    // Get recent context (last 3-5 messages)
    const recentMessages = conversationHistory
      .slice(-5)
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content)

    // Extract key topics and entities from conversation
    const topics = this.extractTopicsFromHistory(conversationHistory)
    
    // Enhance query with context
    let enhancedQuery = userMessage
    
    if (topics.length > 0) {
      enhancedQuery += ` Context: ${topics.join(', ')}`
    }

    if (recentMessages.length > 1) {
      enhancedQuery += ` Previous questions: ${recentMessages.slice(0, -1).join('; ')}`
    }

    return enhancedQuery
  }

  /**
   * Build context string from retrieved document chunks
   */
  private buildContextFromSources(sources: DocumentChunk[]): string {
    if (sources.length === 0) return ""

    // Group sources by document/webpage and rank by similarity
    const groupedSources = sources.reduce((acc, source) => {
      const key = `${source.source_type}:${source.source_id}`
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(source)
      return acc
    }, {} as Record<string, DocumentChunk[]>)

    // Build context with source attribution
    const contextSections = Object.entries(groupedSources).map(([sourceKey, chunks]) => {
      const [sourceType, sourceId] = sourceKey.split(':')
      const topChunks = chunks
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 3) // Top 3 chunks per source
      
      const content = topChunks.map(chunk => chunk.content).join('\n\n')
      return `[Source: ${sourceType} ${sourceId}]\n${content}`
    })

    return contextSections.join('\n\n---\n\n')
  }

  /**
   * Build conversation context for AI
   */
  private buildConversationContext(conversationHistory: ChatMessage[]): string {
    // Get last 10 messages for context
    const contextMessages = conversationHistory
      .slice(-10)
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n')

    return contextMessages
  }

  /**
   * Generate AI response based on provider
   */
  private async generateResponse(
    aiConfig: AIConfiguration,
    userMessage: string,
    context: string,
    conversationContext: string
  ): Promise<{ content: string; tokensUsed: number }> {
    const systemPrompt = aiConfig.system_prompt || this.getDefaultSystemPrompt()
    
    if (aiConfig.provider === 'openai' && this.openaiApiKey) {
      return await this.generateOpenAIResponse(
        aiConfig,
        systemPrompt,
        userMessage,
        context,
        conversationContext
      )
    } else if (aiConfig.provider === 'anthropic' && this.anthropicApiKey) {
      return await this.generateAnthropicResponse(
        aiConfig,
        systemPrompt,
        userMessage,
        context,
        conversationContext
      )
    } else {
      throw new Error(`Unsupported AI provider: ${aiConfig.provider}`)
    }
  }

  /**
   * Generate response using OpenAI
   */
  private async generateOpenAIResponse(
    aiConfig: AIConfiguration,
    systemPrompt: string,
    userMessage: string,
    context: string,
    conversationContext: string
  ): Promise<{ content: string; tokensUsed: number }> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: aiConfig.model_name,
        temperature: aiConfig.temperature,
        max_tokens: aiConfig.max_tokens,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          ...(context ? [{
            role: 'system',
            content: `Knowledge Base Context:\n${context}`
          }] : []),
          ...(conversationContext ? [{
            role: 'system',
            content: `Conversation History:\n${conversationContext}`
          }] : []),
          {
            role: 'user',
            content: userMessage
          }
        ]
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const data = await response.json()
    
    return {
      content: data.choices[0]?.message?.content || '',
      tokensUsed: data.usage?.total_tokens || 0
    }
  }

  /**
   * Generate response using Anthropic Claude
   */
  private async generateAnthropicResponse(
    aiConfig: AIConfiguration,
    systemPrompt: string,
    userMessage: string,
    context: string,
    conversationContext: string
  ): Promise<{ content: string; tokensUsed: number }> {
    // Build full prompt for Claude
    let fullPrompt = systemPrompt
    
    if (context) {
      fullPrompt += `\n\nKnowledge Base Context:\n${context}`
    }
    
    if (conversationContext) {
      fullPrompt += `\n\nConversation History:\n${conversationContext}`
    }
    
    fullPrompt += `\n\nHuman: ${userMessage}\n\nAssistant:`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.anthropicApiKey!,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: aiConfig.model_name,
        max_tokens: aiConfig.max_tokens,
        temperature: aiConfig.temperature,
        messages: [
          {
            role: 'user',
            content: fullPrompt
          }
        ]
      })
    })

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`)
    }

    const data = await response.json()
    
    return {
      content: data.content[0]?.text || '',
      tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens || 0
    }
  }

  /**
   * Generate embedding for text
   */
  private async generateEmbedding(text: string, userId: string): Promise<number[] | null> {
    if (!this.openaiApiKey) {
      return null
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text.substring(0, 8000) // Limit input length
        })
      })

      if (!response.ok) {
        throw new Error(`OpenAI Embedding API error: ${response.statusText}`)
      }

      const data = await response.json()
      return data.data[0]?.embedding || null
    } catch { // Ignored 
      console.error('Error generating embedding:', error)
      return null
    }
  }

  /**
   * Calculate confidence score based on various factors
   */
  private calculateConfidence(
    sources: DocumentChunk[], 
    query: string, 
    response: string
  ): number {
    if (sources.length === 0) return 0.3 // Low confidence without sources
    
    // Factor 1: Average similarity score of sources
    const avgSimilarity = sources.reduce((sum, source) => sum + source.similarity, 0) / sources.length
    
    // Factor 2: Number of sources (more sources = higher confidence, up to a point)
    const sourceCountFactor = Math.min(sources.length / 5, 1) // Normalize to 0-1
    
    // Factor 3: Response length vs query complexity (heuristic)
    const responseQuality = Math.min(response.length / (query.length * 2), 1)
    
    // Factor 4: Keyword overlap between query and sources
    const keywordOverlap = this.calculateKeywordOverlap(query, sources)
    
    // Weighted combination
    const confidence = (
      avgSimilarity * 0.4 + 
      sourceCountFactor * 0.2 + 
      responseQuality * 0.2 + 
      keywordOverlap * 0.2
    )
    
    return Math.min(Math.max(confidence, 0.1), 1.0) // Clamp between 0.1 and 1.0
  }

  /**
   * Calculate keyword overlap between query and sources
   */
  private calculateKeywordOverlap(query: string, sources: DocumentChunk[]): number {
    const queryWords = this.extractKeywords(query)
    const sourceText = sources.map(s => s.content).join(' ')
    const sourceWords = this.extractKeywords(sourceText)
    
    if (queryWords.length === 0) return 0
    
    const overlap = queryWords.filter(word => sourceWords.includes(word)).length
    return overlap / queryWords.length
  }

  /**
   * Extract keywords from text (simple implementation)
   */
  private extractKeywords(text: string): string[] {
    // Simple keyword extraction - remove common words and get unique terms
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'])
    
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word))
      .filter((word, index, array) => array.indexOf(word) === index) // Unique words
  }

  /**
   * Extract topics from conversation history
   */
  private extractTopicsFromHistory(conversationHistory: ChatMessage[]): string[] {
    // Simple topic extraction from recent messages
    const recentText = conversationHistory
      .slice(-5)
      .map(msg => msg.content)
      .join(' ')
    
    return this.extractKeywords(recentText).slice(0, 3) // Top 3 topics
  }

  /**
   * Get active AI configuration for user
   */
  private async getActiveAIConfig(userId: string): Promise<AIConfiguration | null> {
    try {
      const { data, error } = await supabase
        .from('ai_configurations')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single()

      if (error) {
        console.error('Error fetching AI config:', error)
        return null
      }

      return data
    } catch { // Ignored 
      console.error('Error in getActiveAIConfig:', error)
      return null
    }
  }

  /**
   * Default system prompt
   */
  private getDefaultSystemPrompt(): string {
    return `You are Wacanda, an intelligent AI customer service assistant.

Your core capabilities:
- Provide accurate, helpful responses using the knowledge base context
- Maintain a professional yet friendly tone
- Escalate to human agents when needed
- Remember conversation context and refer to previous messages when relevant
- Always cite sources when using specific information from the knowledge base

Guidelines:
- If you're unsure about information, say so clearly and suggest contacting human support
- Ask clarifying questions when the user's intent is unclear
- Keep responses concise but complete
- Use the conversation history to maintain context and avoid repeating information
- When confidence is low, recommend human agent assistance
- If you cannot find relevant information in the knowledge base, be honest about limitations
- Prioritize customer satisfaction and problem resolution

Response format:
- Start with a direct answer to the customer's question
- Provide relevant details from the knowledge base when available
- End with a helpful follow-up question or next step when appropriate
- Use a warm, professional tone throughout`
  }

  /**
   * Store RAG context for a message
   */
  async storeRAGContext(
    messageId: string,
    ragContext: RAGResponse['ragContext']
  ): Promise<void> {
    try {
      await supabase.from('rag_contexts').insert({
        message_id: messageId,
        source_documents: ragContext.sourceDocuments,
        similarity_scores: ragContext.similarityScores,
        context_used: ragContext.contextUsed,
        retrieval_query: ragContext.retrievalQuery
      })
    } catch { // Ignored 
      console.error('Error storing RAG context:', error)
    }
  }

  /**
   * Get conversation context for session
   */
  async getConversationContext(sessionId: string): Promise<ConversationContext> {
    try {
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error('Error fetching conversation context:', error)
        return this.getDefaultConversationContext()
      }

      // Analyze conversation for context
      const recentMessages = messages || []
      const summary = this.generateConversationSummary(recentMessages)
      const topics = this.extractTopicsFromHistory(recentMessages)
      const sentiment = this.analyzeSentiment(recentMessages)

      return {
        recentMessages,
        summary,
        topics,
        sentiment
      }
    } catch { // Ignored 
      console.error('Error in getConversationContext:', error)
      return this.getDefaultConversationContext()
    }
  }

  /**
   * Generate conversation summary
   */
  private generateConversationSummary(messages: ChatMessage[]): string {
    if (messages.length === 0) return "No previous conversation"
    
    // Simple summary generation
    const userMessages = messages.filter(m => m.role === 'user').slice(0, 3)
    const topics = this.extractTopicsFromHistory(messages)
    
    return `Recent conversation about: ${topics.join(', ')}. User's main concerns: ${userMessages.map(m => m.content.substring(0, 50)).join('; ')}`
  }

  /**
   * Simple sentiment analysis
   */
  private analyzeSentiment(messages: ChatMessage[]): 'positive' | 'neutral' | 'negative' {
    if (messages.length === 0) return 'neutral'
    
    const recentUserMessages = messages
      .filter(m => m.role === 'user')
      .slice(0, 3)
      .map(m => m.content.toLowerCase())
    
    const negativeWords = ['angry', 'frustrated', 'upset', 'disappointed', 'terrible', 'awful', 'hate', 'worst', 'bad', 'problem', 'issue', 'broken', 'wrong']
    const positiveWords = ['great', 'good', 'excellent', 'love', 'perfect', 'amazing', 'wonderful', 'thank', 'thanks', 'appreciate', 'happy', 'satisfied']
    
    let score = 0
    recentUserMessages.forEach(message => {
      negativeWords.forEach(word => {
        if (message.includes(word)) score -= 1
      })
      positiveWords.forEach(word => {
        if (message.includes(word)) score += 1
      })
    })
    
    if (score < -1) return 'negative'
    if (score > 1) return 'positive'
    return 'neutral'
  }

  /**
   * Default conversation context
   */
  private getDefaultConversationContext(): ConversationContext {
    return {
      recentMessages: [],
      summary: "No previous conversation",
      topics: [],
      sentiment: 'neutral'
    }
  }
}

// Export singleton instance
export const ragService = RAGService.getInstance() 