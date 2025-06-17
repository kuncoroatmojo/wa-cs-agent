import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HandoffService } from '../../../src/services/handoffService'
import type { ChatMessage, ConversationContext } from '../../../src/types'

// Mock dependencies
const mockSupabase = {
  from: vi.fn(() => ({
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn(() => Promise.resolve({ data: null, error: null }))
  })),
  rpc: vi.fn(() => Promise.resolve({ data: [], error: null }))
}

vi.mock('../../../src/lib/supabase', () => ({
  supabase: mockSupabase
}))

describe('HandoffService', () => {
  let handoffService: HandoffService

  beforeEach(() => {
    handoffService = new HandoffService()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('evaluateHandoffNeed', () => {
    const createMockMessage = (content: string): ChatMessage => ({
      id: 'test-message-id',
      session_id: 'test-session-id',
      role: 'user' as const,
      content,
      message_type: 'text',
      metadata: {},
      tokens_used: null,
      model_used: null,
      confidence_score: null,
      response_time_ms: null,
      created_at: '2024-01-01T00:00:00Z'
    })

    const createMockContext = (overrides = {}): ConversationContext => ({
      sessionId: 'test-session-id',
      messageCount: 5,
      averageConfidence: 0.8,
      sentiment: 'neutral',
      complexity: 'medium',
      topics: ['general'],
      lastActivity: '2024-01-01T00:00:00Z',
      ...overrides
    })

    it('should trigger handoff for low confidence', async () => {
      const message = createMockMessage('I need help with my order')
      const context = createMockContext()
      
      const result = await handoffService.evaluateHandoffNeed(message, context, 0.5)

      expect(result.shouldHandoff).toBe(true)
      expect(result.reason).toContain('Low AI confidence')
      expect(result.urgency).toBe('medium')
    })

    it('should trigger handoff for urgent keywords', async () => {
      const message = createMockMessage('I want to cancel my subscription immediately')
      const context = createMockContext()
      
      const result = await handoffService.evaluateHandoffNeed(message, context, 0.8)

      expect(result.shouldHandoff).toBe(true)
      expect(result.reason).toContain('Urgent keywords detected')
      expect(result.urgency).toBe('high')
    })

    it('should trigger handoff for explicit human request', async () => {
      const message = createMockMessage('Can I speak to a human agent please?')
      const context = createMockContext()
      
      const result = await handoffService.evaluateHandoffNeed(message, context, 0.9)

      expect(result.shouldHandoff).toBe(true)
      expect(result.reason).toContain('Customer requested human agent')
      expect(result.urgency).toBe('high')
    })

    it('should trigger handoff for negative sentiment', async () => {
      const message = createMockMessage('This is frustrating')
      const context = createMockContext({ sentiment: 'negative' })
      
      const result = await handoffService.evaluateHandoffNeed(message, context, 0.8)

      expect(result.shouldHandoff).toBe(true)
      expect(result.reason).toContain('Negative sentiment detected')
    })

    it('should not trigger handoff for normal conversation', async () => {
      const message = createMockMessage('What are your business hours?')
      const context = createMockContext({ sentiment: 'positive' })
      
      const result = await handoffService.evaluateHandoffNeed(message, context, 0.9)

      expect(result.shouldHandoff).toBe(false)
      expect(result.urgency).toBe('low')
    })

    it('should handle complex scenarios with multiple triggers', async () => {
      const message = createMockMessage('I am angry about this refund issue and want to speak to manager')
      const context = createMockContext({ 
        sentiment: 'negative',
        complexity: 'high',
        messageCount: 15
      })
      
      const result = await handoffService.evaluateHandoffNeed(message, context, 0.4)

      expect(result.shouldHandoff).toBe(true)
      expect(result.urgency).toBe('high')
      expect(result.reason).toContain('Multiple triggers')
    })
  })

  describe('createHandoffTicket', () => {
    it('should create handoff ticket with correct data', async () => {
      const insertMock = vi.fn().mockResolvedValue({ data: { id: 'ticket-id' }, error: null })
      mockSupabase.from.mockReturnValue({
        insert: insertMock,
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'ticket-id' }, error: null })
      })

      await handoffService.createHandoffTicket(
        'test-session-id',
        'Low confidence response',
        'medium'
      )

      expect(mockSupabase.from).toHaveBeenCalledWith('handoff_requests')
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: 'test-session-id',
          reason: 'Low confidence response',
          urgency: 'medium',
          status: 'pending'
        })
      )
    })

    it('should handle database errors gracefully', async () => {
      const insertMock = vi.fn().mockResolvedValue({ 
        data: null, 
        error: { message: 'Database error' } 
      })
      mockSupabase.from.mockReturnValue({
        insert: insertMock,
        select: vi.fn().mockReturnThis(),
        single: vi.fn()
      })

      await expect(
        handoffService.createHandoffTicket('test-session-id', 'Test reason', 'low')
      ).rejects.toThrow('Database error')
    })
  })

  describe('getAvailableAgents', () => {
    it('should return available agents', async () => {
      const mockAgents = [
        { id: 'agent1', name: 'Agent 1', workload: 3, status: 'available' },
        { id: 'agent2', name: 'Agent 2', workload: 1, status: 'available' }
      ]

      mockSupabase.rpc.mockResolvedValue({ data: mockAgents, error: null })

      const result = await handoffService.getAvailableAgents()

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_available_agents')
      expect(result).toEqual(mockAgents)
    })
  })

  describe('analyzeConversationPatterns', () => {
    it('should analyze conversation patterns for handoff prediction', async () => {
      const conversationHistory = [
        createMockMessage('Initial question'),
        createMockMessage('Follow up question'),
        createMockMessage('I am getting frustrated')
      ]

      const result = await handoffService.analyzeConversationPatterns(
        'test-session-id',
        conversationHistory
      )

      expect(result).toHaveProperty('escalationRisk')
      expect(result).toHaveProperty('sentimentTrend')
      expect(result).toHaveProperty('complexityScore')
      expect(result.escalationRisk).toBeGreaterThan(0)
    })
  })

  describe('trigger evaluation methods', () => {
    const mockMessage = createMockMessage('test message')

    it('should evaluate confidence threshold trigger', () => {
      const lowConfidenceTrigger = handoffService.checkConfidenceThreshold(0.4)
      const highConfidenceTrigger = handoffService.checkConfidenceThreshold(0.9)

      expect(lowConfidenceTrigger.triggered).toBe(true)
      expect(lowConfidenceTrigger.urgency).toBe('medium')
      expect(highConfidenceTrigger.triggered).toBe(false)
    })

    it('should evaluate keyword triggers', () => {
      const urgentMessage = 'I want to cancel my subscription'
      const normalMessage = 'What are your hours?'

      const urgentTrigger = handoffService.checkKeywordTriggers(urgentMessage)
      const normalTrigger = handoffService.checkKeywordTriggers(normalMessage)

      expect(urgentTrigger.triggered).toBe(true)
      expect(urgentTrigger.urgency).toBe('high')
      expect(normalTrigger.triggered).toBe(false)
    })

    it('should evaluate sentiment triggers', () => {
      const negativeContext = createMockContext({ sentiment: 'negative' })
      const positiveContext = createMockContext({ sentiment: 'positive' })

      const negativeTrigger = handoffService.checkSentimentTriggers(negativeContext.sentiment)
      const positiveTrigger = handoffService.checkSentimentTriggers(positiveContext.sentiment)

      expect(negativeTrigger.triggered).toBe(true)
      expect(positiveTrigger.triggered).toBe(false)
    })

    it('should evaluate escalation request triggers', () => {
      const escalationMessage = 'I want to speak to a manager'
      const normalMessage = 'Thank you for your help'

      const escalationTrigger = handoffService.checkEscalationRequest(escalationMessage)
      const normalTrigger = handoffService.checkEscalationRequest(normalMessage)

      expect(escalationTrigger.triggered).toBe(true)
      expect(escalationTrigger.urgency).toBe('high')
      expect(normalTrigger.triggered).toBe(false)
    })

    it('should evaluate repetitive issue triggers', () => {
      const context = createMockContext({ messageCount: 20 })
      
      const trigger = handoffService.checkRepetitiveIssues(context)

      expect(trigger.triggered).toBe(true)
      expect(trigger.reason).toContain('Repetitive conversation')
    })

    it('should evaluate complexity triggers', () => {
      const complexMessage = 'I need help with API integration for my custom application with OAuth2 and webhook configuration'
      const simpleMessage = 'What is your phone number?'

      const complexTrigger = handoffService.checkComplexityTriggers(complexMessage)
      const simpleTrigger = handoffService.checkComplexityTriggers(simpleMessage)

      expect(complexTrigger.triggered).toBe(true)
      expect(simpleTrigger.triggered).toBe(false)
    })
  })

  describe('notification system', () => {
    it('should notify available agents for high urgency', async () => {
      const notifySpy = vi.spyOn(handoffService as any, 'notifyAvailableAgents')
        .mockResolvedValue(undefined)

      await handoffService.createHandoffTicket(
        'test-session-id',
        'Urgent issue',
        'high'
      )

      expect(notifySpy).toHaveBeenCalledWith('high')
    })
  })

  describe('analytics and metrics', () => {
    it('should track handoff statistics', async () => {
      const stats = await handoffService.getHandoffStatistics('test-user-id')

      expect(stats).toHaveProperty('totalHandoffs')
      expect(stats).toHaveProperty('averageResponseTime')
      expect(stats).toHaveProperty('resolutionRate')
      expect(stats).toHaveProperty('topReasons')
    })

    it('should calculate handoff prevention success rate', async () => {
      const successRate = await handoffService.calculatePreventionSuccessRate('test-user-id')

      expect(typeof successRate).toBe('number')
      expect(successRate).toBeGreaterThanOrEqual(0)
      expect(successRate).toBeLessThanOrEqual(100)
    })
  })

  const createMockMessage = (content: string): ChatMessage => ({
    id: 'test-message-id',
    session_id: 'test-session-id',
    role: 'user' as const,
    content,
    message_type: 'text',
    metadata: {},
    tokens_used: null,
    model_used: null,
    confidence_score: null,
    response_time_ms: null,
    created_at: '2024-01-01T00:00:00Z'
  })
}) 