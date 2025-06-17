import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RAGService } from '../../../src/services/ragService'

// Mock dependencies
const mockSupabase = {
  rpc: vi.fn(),
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn()
  }))
}

const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn()
    }
  },
  embeddings: {
    create: vi.fn()
  }
}

vi.mock('../../../src/lib/supabase', () => ({
  supabase: mockSupabase
}))

describe('RAGService', () => {
  let ragService: RAGService
  
  beforeEach(() => {
    ragService = new RAGService('test-api-key')
    // Replace the OpenAI instance with our mock
    // @ts-ignore
    ragService.openai = mockOpenAI
    // @ts-ignore
    ragService.anthropic = {
      messages: {
        create: vi.fn()
      }
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('performSemanticSearch', () => {
    it('should perform semantic search with correct parameters', async () => {
      const mockEmbedding = new Array(1536).fill(0.1)
      const mockResults = [
        {
          id: 'doc1',
          content: 'Test content 1',
          similarity: 0.85,
          metadata: {}
        }
      ]

      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }]
      })

      mockSupabase.rpc.mockResolvedValue({
        data: mockResults,
        error: null
      })

      const result = await ragService.performSemanticSearch(
        'test-user-id',
        'test query',
        5,
        0.7
      )

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'test query'
      })

      expect(mockSupabase.rpc).toHaveBeenCalledWith('match_documents', {
        query_embedding: mockEmbedding,
        match_threshold: 0.7,
        match_count: 5,
        user_id: 'test-user-id'
      })

      expect(result).toEqual(mockResults)
    })

    it('should handle search errors gracefully', async () => {
      mockOpenAI.embeddings.create.mockRejectedValue(new Error('API Error'))

      await expect(
        ragService.performSemanticSearch('test-user-id', 'test query')
      ).rejects.toThrow('API Error')
    })

    it('should use default parameters when not provided', async () => {
      const mockEmbedding = new Array(1536).fill(0.1)
      
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }]
      })

      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null
      })

      await ragService.performSemanticSearch('test-user-id', 'test query')

      expect(mockSupabase.rpc).toHaveBeenCalledWith('match_documents', {
        query_embedding: mockEmbedding,
        match_threshold: 0.7,
        match_count: 10,
        user_id: 'test-user-id'
      })
    })
  })

  describe('generateContextualResponse', () => {
    beforeEach(() => {
      // Mock getActiveAIConfig
      vi.spyOn(ragService as any, 'getActiveAIConfig').mockResolvedValue({
        model_name: 'gpt-4o',
        temperature: 0.7,
        max_tokens: 1000,
        system_prompt: 'Test system prompt',
        provider: 'openai'
      })

      // Mock performSemanticSearch
      vi.spyOn(ragService, 'performSemanticSearch').mockResolvedValue([
        {
          id: 'doc1',
          content: 'Relevant context',
          similarity: 0.85,
          metadata: {}
        }
      ])
    })

    it('should generate response with RAG context', async () => {
      const mockCompletion = {
        choices: [{ message: { content: 'AI generated response' } }],
        usage: { total_tokens: 150 }
      }

      mockOpenAI.chat.completions.create.mockResolvedValue(mockCompletion)

      const conversationHistory = [
        {
          role: 'user',
          content: 'Previous message',
          id: 'msg1',
          session_id: 'session1',
          message_type: 'text',
          metadata: {},
          created_at: '2024-01-01T00:00:00Z'
        }
      ]

      const result = await ragService.generateContextualResponse(
        'test-user-id',
        'test-session-id',
        'Current user message',
        conversationHistory,
        true
      )

      expect(ragService.performSemanticSearch).toHaveBeenCalledWith(
        'test-user-id',
        'Current user message'
      )

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o',
        temperature: 0.7,
        max_tokens: 1000,
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user', content: 'Current user message' })
        ])
      })

      expect(result).toEqual({
        response: 'AI generated response',
        sources: expect.any(Array),
        confidence: expect.any(Number),
        tokensUsed: 150
      })
    })

    it('should generate response without RAG when disabled', async () => {
      const mockCompletion = {
        choices: [{ message: { content: 'AI response without RAG' } }],
        usage: { total_tokens: 75 }
      }

      mockOpenAI.chat.completions.create.mockResolvedValue(mockCompletion)

      const result = await ragService.generateContextualResponse(
        'test-user-id',
        'test-session-id',
        'User message',
        [],
        false
      )

      expect(ragService.performSemanticSearch).not.toHaveBeenCalled()
      expect(result.sources).toEqual([])
      expect(result.response).toBe('AI response without RAG')
    })

    it('should handle Anthropic provider', async () => {
      // Mock getActiveAIConfig for Anthropic
      vi.spyOn(ragService as any, 'getActiveAIConfig').mockResolvedValue({
        model_name: 'claude-3-opus-20240229',
        temperature: 0.7,
        max_tokens: 1000,
        system_prompt: 'Test system prompt',
        provider: 'anthropic'
      })

      const mockResponse = {
        content: [{ text: 'Claude response' }],
        usage: { input_tokens: 50, output_tokens: 50 }
      }

      // @ts-ignore
      ragService.anthropic.messages.create.mockResolvedValue(mockResponse)

      const result = await ragService.generateContextualResponse(
        'test-user-id',
        'test-session-id',
        'Test message',
        [],
        false
      )

      expect(result.response).toBe('Claude response')
      expect(result.tokensUsed).toBe(100)
    })
  })

  describe('enhanceContextWithConversation', () => {
    it('should enhance context with conversation history', async () => {
      const conversationHistory = [
        {
          id: 'msg1',
          role: 'user',
          content: 'What is your return policy?',
          session_id: 'session1',
          message_type: 'text',
          metadata: {},
          created_at: '2024-01-01T10:00:00Z'
        },
        {
          id: 'msg2',
          role: 'assistant',
          content: 'Our return policy allows 30 days...',
          session_id: 'session1',
          message_type: 'text',
          metadata: {},
          created_at: '2024-01-01T10:01:00Z'
        }
      ]

      const ragSources = [
        {
          id: 'doc1',
          content: 'Return policy: 30 days with receipt',
          similarity: 0.9,
          metadata: { document_title: 'Return Policy' }
        }
      ]

      const result = await ragService.enhanceContextWithConversation(
        conversationHistory,
        ragSources,
        'Can I return without receipt?'
      )

      expect(result.conversationContext).toContain('What is your return policy?')
      expect(result.enhancedQuery).toContain('return without receipt')
      expect(result.contextRelevanceScore).toBeGreaterThan(0)
    })
  })

  describe('calculateMultiFactorConfidence', () => {
    it('should calculate confidence based on multiple factors', () => {
      const sources = [
        { similarity: 0.9, metadata: {} },
        { similarity: 0.8, metadata: {} }
      ]

      const factors = {
        sourceQuality: 0.85,
        queryComplexity: 0.7,
        responseCoherence: 0.9
      }

      const confidence = ragService.calculateMultiFactorConfidence(
        sources,
        'test query',
        factors
      )

      expect(confidence).toBeGreaterThan(0)
      expect(confidence).toBeLessThanOrEqual(1)
    })

    it('should return low confidence for no sources', () => {
      const confidence = ragService.calculateMultiFactorConfidence(
        [],
        'test query',
        {}
      )

      expect(confidence).toBe(0.3)
    })
  })

  describe('optimizeQuery', () => {
    it('should optimize query for better retrieval', async () => {
      const result = await ragService.optimizeQuery(
        'How do I return something I bought?',
        ['product', 'return', 'refund']
      )

      expect(result.optimizedQuery).toContain('return')
      expect(result.searchTerms).toContain('return')
      expect(result.intentClassification).toBeDefined()
    })
  })

  describe('cacheResponse', () => {
    it('should cache response with proper key', async () => {
      const mockCacheSet = vi.fn()
      // @ts-ignore
      ragService.cache = { set: mockCacheSet }

      await ragService.cacheResponse(
        'test-user-id',
        'test query',
        {
          response: 'Test response',
          sources: [],
          confidence: 0.8,
          tokensUsed: 100
        }
      )

      expect(mockCacheSet).toHaveBeenCalledWith(
        expect.stringContaining('test-user-id'),
        expect.any(Object),
        expect.any(Number)
      )
    })
  })

  describe('error handling', () => {
    it('should handle OpenAI API errors', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error('OpenAI API rate limit exceeded')
      )

      await expect(
        ragService.generateContextualResponse(
          'test-user-id',
          'test-session-id',
          'test message',
          []
        )
      ).rejects.toThrow('OpenAI API rate limit exceeded')
    })

    it('should handle database errors', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database connection error' }
      })

      await expect(
        ragService.performSemanticSearch('test-user-id', 'test query')
      ).rejects.toThrow('Database connection error')
    })
  })
}) 