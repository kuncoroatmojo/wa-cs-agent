import { supabase } from '../lib/supabase'
import type { ChatMessage, ConversationContext } from '../types'

export interface HandoffTrigger {
  triggered: boolean
  reason: string
  urgency: 'low' | 'medium' | 'high'
  confidence: number
}

export interface HandoffEvaluation {
  shouldHandoff: boolean
  reason: string
  urgency: 'low' | 'medium' | 'high'
  triggers: HandoffTrigger[]
  score: number
}

export interface HandoffRequest {
  id: string
  session_id: string
  reason: string
  urgency: 'low' | 'medium' | 'high'
  status: 'pending' | 'assigned' | 'resolved' | 'cancelled'
  assigned_agent_id?: string
  created_at: string
  resolved_at?: string
  metadata: Record<string, any>
}

export class HandoffService {
  private static instance: HandoffService

  static getInstance(): HandoffService {
    if (!HandoffService.instance) {
      HandoffService.instance = new HandoffService()
    }
    return HandoffService.instance
  }

  /**
   * Evaluate if a conversation needs human handoff
   */
  async evaluateHandoffNeed(
    message: ChatMessage,
    context: ConversationContext,
    confidence: number,
    ragResponse?: {
      sources: any[]
      responseTimeMs: number
    }
  ): Promise<HandoffEvaluation> {
    const triggers: HandoffTrigger[] = [
      this.checkConfidenceThreshold(confidence),
      this.checkKeywordTriggers(message.content),
      this.checkSentimentTriggers(context.sentiment),
      this.checkComplexityTriggers(message.content),
      this.checkEscalationRequest(message.content),
      this.checkRepetitiveIssues(context.recentMessages),
      this.checkUrgencyIndicators(message.content),
      this.checkBusinessHours(),
      this.checkResponseQuality(ragResponse),
      this.checkConversationLength(context.recentMessages)
    ]

    const activeTriggers = triggers.filter(t => t.triggered)
    
    if (activeTriggers.length > 0) {
      const urgency = this.determineUrgency(activeTriggers)
      const score = this.calculateHandoffScore(activeTriggers)
      
      return {
        shouldHandoff: score > 0.6, // Threshold for handoff decision
        reason: activeTriggers.map(t => t.reason).join(', '),
        urgency,
        triggers: activeTriggers,
        score
      }
    }

    return {
      shouldHandoff: false,
      reason: '',
      urgency: 'low',
      triggers: [],
      score: 0
    }
  }

  /**
   * Check if AI confidence is below threshold
   */
  private checkConfidenceThreshold(confidence: number): HandoffTrigger {
    const lowThreshold = 0.6
    const veryLowThreshold = 0.4
    
    if (confidence < veryLowThreshold) {
      return {
        triggered: true,
        reason: 'Very low AI confidence',
        urgency: 'high',
        confidence: 0.9
      }
    } else if (confidence < lowThreshold) {
      return {
        triggered: true,
        reason: 'Low AI confidence',
        urgency: 'medium',
        confidence: 0.7
      }
    }
    
    return {
      triggered: false,
      reason: '',
      urgency: 'low',
      confidence: 0
    }
  }

  /**
   * Check for urgent keywords that require human attention
   */
  private checkKeywordTriggers(content: string): HandoffTrigger {
    const urgentKeywords = {
      high: ['emergency', 'urgent', 'legal', 'lawsuit', 'lawyer', 'attorney', 'sue', 'court', 'police', 'death', 'injury', 'accident', 'fraud', 'scam', 'security breach', 'hack'],
      medium: ['cancel', 'cancellation', 'refund', 'billing', 'charge', 'payment', 'account', 'suspended', 'locked', 'blocked', 'unauthorized', 'dispute'],
      low: ['complaint', 'angry', 'frustrated', 'disappointed', 'terrible', 'awful', 'worst', 'horrible', 'unacceptable']
    }
    
    const contentLower = content.toLowerCase()
    
    // Check high priority keywords first
    for (const keyword of urgentKeywords.high) {
      if (contentLower.includes(keyword)) {
        return {
          triggered: true,
          reason: `High priority keyword detected: ${keyword}`,
          urgency: 'high',
          confidence: 0.95
        }
      }
    }
    
    // Check medium priority keywords
    for (const keyword of urgentKeywords.medium) {
      if (contentLower.includes(keyword)) {
        return {
          triggered: true,
          reason: `Medium priority keyword detected: ${keyword}`,
          urgency: 'medium',
          confidence: 0.8
        }
      }
    }
    
    // Check low priority keywords
    for (const keyword of urgentKeywords.low) {
      if (contentLower.includes(keyword)) {
        return {
          triggered: true,
          reason: `Negative sentiment keyword detected: ${keyword}`,
          urgency: 'low',
          confidence: 0.6
        }
      }
    }
    
    return {
      triggered: false,
      reason: '',
      urgency: 'low',
      confidence: 0
    }
  }

  /**
   * Check conversation sentiment for escalation
   */
  private checkSentimentTriggers(sentiment: 'positive' | 'neutral' | 'negative'): HandoffTrigger {
    if (sentiment === 'negative') {
      return {
        triggered: true,
        reason: 'Negative customer sentiment detected',
        urgency: 'medium',
        confidence: 0.7
      }
    }
    
    return {
      triggered: false,
      reason: '',
      urgency: 'low',
      confidence: 0
    }
  }

  /**
   * Check message complexity that might need human intelligence
   */
  private checkComplexityTriggers(content: string): HandoffTrigger {
    const complexityIndicators = [
      'custom', 'exception', 'special case', 'unique situation', 'never seen', 'not standard',
      'complicated', 'complex', 'multiple issues', 'several problems', 'various concerns'
    ]
    
    const contentLower = content.toLowerCase()
    const sentences = content.split(/[.!?]+/).length
    const words = content.split(/\s+/).length
    
    // Check for complexity indicators
    const hasComplexityIndicator = complexityIndicators.some(indicator => 
      contentLower.includes(indicator)
    )
    
    // Check message length and structure complexity
    const isLongMessage = words > 100 || sentences > 5
    
    if (hasComplexityIndicator || isLongMessage) {
      return {
        triggered: true,
        reason: 'Complex query detected that may require human expertise',
        urgency: 'medium',
        confidence: 0.6
      }
    }
    
    return {
      triggered: false,
      reason: '',
      urgency: 'low',
      confidence: 0
    }
  }

  /**
   * Check for explicit escalation requests
   */
  private checkEscalationRequest(content: string): HandoffTrigger {
    const escalationPhrases = [
      'speak to human', 'human agent', 'real person', 'manager', 'supervisor',
      'escalate', 'transfer me', 'live agent', 'customer service', 'representative',
      'human help', 'talk to someone', 'human support'
    ]
    
    const contentLower = content.toLowerCase()
    
    for (const phrase of escalationPhrases) {
      if (contentLower.includes(phrase)) {
        return {
          triggered: true,
          reason: 'Customer explicitly requested human agent',
          urgency: 'high',
          confidence: 0.95
        }
      }
    }
    
    return {
      triggered: false,
      reason: '',
      urgency: 'low',
      confidence: 0
    }
  }

  /**
   * Check for repetitive issues that AI can't resolve
   */
  private checkRepetitiveIssues(recentMessages: ChatMessage[]): HandoffTrigger {
    if (recentMessages.length < 6) {
      return {
        triggered: false,
        reason: '',
        urgency: 'low',
        confidence: 0
      }
    }
    
    // Check if customer keeps asking similar questions
    const userMessages = recentMessages
      .filter(m => m.role === 'user')
      .slice(-3)
    
    // Simple repetition detection
    const repeatedTopics = this.detectRepeatedTopics(userMessages)
    
    if (repeatedTopics) {
      return {
        triggered: true,
        reason: 'Customer repeating similar questions - AI may not be providing satisfactory answers',
        urgency: 'medium',
        confidence: 0.8
      }
    }
    
    return {
      triggered: false,
      reason: '',
      urgency: 'low',
      confidence: 0
    }
  }

  /**
   * Check for urgency indicators
   */
  private checkUrgencyIndicators(content: string): HandoffTrigger {
    const urgencyPhrases = [
      'asap', 'immediately', 'right now', 'urgent', 'emergency', 'critical',
      'deadline', 'time sensitive', 'quickly', 'fast', 'soon as possible'
    ]
    
    const contentLower = content.toLowerCase()
    
    for (const phrase of urgencyPhrases) {
      if (contentLower.includes(phrase)) {
        return {
          triggered: true,
          reason: 'Urgency indicators detected',
          urgency: 'high',
          confidence: 0.8
        }
      }
    }
    
    return {
      triggered: false,
      reason: '',
      urgency: 'low',
      confidence: 0
    }
  }

  /**
   * Check if it's outside business hours
   */
  private checkBusinessHours(): HandoffTrigger {
    const now = new Date()
    const hour = now.getHours()
    const day = now.getDay() // 0 = Sunday, 6 = Saturday
    
    // Assume business hours: Monday-Friday 9AM-6PM
    const isWeekend = day === 0 || day === 6
    const isOutsideHours = hour < 9 || hour >= 18
    
    if (isWeekend || isOutsideHours) {
      return {
        triggered: true,
        reason: 'Outside business hours - human agents may not be available',
        urgency: 'low',
        confidence: 0.5
      }
    }
    
    return {
      triggered: false,
      reason: '',
      urgency: 'low',
      confidence: 0
    }
  }

  /**
   * Check response quality indicators
   */
  private checkResponseQuality(ragResponse?: {
    sources: any[]
    responseTimeMs: number
  }): HandoffTrigger {
    if (!ragResponse) {
      return {
        triggered: false,
        reason: '',
        urgency: 'low',
        confidence: 0
      }
    }
    
    // Check if AI had no relevant sources
    if (ragResponse.sources.length === 0) {
      return {
        triggered: true,
        reason: 'No relevant information found in knowledge base',
        urgency: 'medium',
        confidence: 0.7
      }
    }
    
    // Check if response took too long (may indicate processing issues)
    if (ragResponse.responseTimeMs > 10000) { // 10 seconds
      return {
        triggered: true,
        reason: 'AI response time too slow - may indicate issues',
        urgency: 'low',
        confidence: 0.5
      }
    }
    
    return {
      triggered: false,
      reason: '',
      urgency: 'low',
      confidence: 0
    }
  }

  /**
   * Check conversation length for escalation
   */
  private checkConversationLength(recentMessages: ChatMessage[]): HandoffTrigger {
    const messageCount = recentMessages.length
    
    // If conversation is very long, might need human intervention
    if (messageCount > 20) {
      return {
        triggered: true,
        reason: 'Very long conversation - may benefit from human agent',
        urgency: 'low',
        confidence: 0.6
      }
    } else if (messageCount > 15) {
      return {
        triggered: true,
        reason: 'Long conversation - consider human agent',
        urgency: 'low',
        confidence: 0.4
      }
    }
    
    return {
      triggered: false,
      reason: '',
      urgency: 'low',
      confidence: 0
    }
  }

  /**
   * Determine overall urgency from active triggers
   */
  private determineUrgency(triggers: HandoffTrigger[]): 'low' | 'medium' | 'high' {
    if (triggers.some(t => t.urgency === 'high')) return 'high'
    if (triggers.some(t => t.urgency === 'medium')) return 'medium'
    return 'low'
  }

  /**
   * Calculate handoff score based on triggers
   */
  private calculateHandoffScore(triggers: HandoffTrigger[]): number {
    if (triggers.length === 0) return 0
    
    // Weight triggers by urgency and confidence
    const weightedScore = triggers.reduce((sum, trigger) => {
      let weight = 1
      if (trigger.urgency === 'high') weight = 3
      else if (trigger.urgency === 'medium') weight = 2
      
      return sum + (trigger.confidence * weight)
    }, 0)
    
    // Normalize by maximum possible score
    const maxPossibleScore = triggers.length * 3 // All high urgency with max confidence
    return Math.min(weightedScore / maxPossibleScore, 1.0)
  }

  /**
   * Detect repeated topics in user messages
   */
  private detectRepeatedTopics(userMessages: ChatMessage[]): boolean {
    if (userMessages.length < 2) return false
    
    // Simple keyword overlap detection
    const keywords = userMessages.map(msg => 
      msg.content
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3)
    )
    
    // Check if there's significant overlap between recent messages
    for (let i = 0; i < keywords.length - 1; i++) {
      for (let j = i + 1; j < keywords.length; j++) {
        const overlap = keywords[i].filter(word => keywords[j].includes(word)).length
        const similarity = overlap / Math.max(keywords[i].length, keywords[j].length)
        
        if (similarity > 0.5) { // 50% keyword overlap
          return true
        }
      }
    }
    
    return false
  }

  /**
   * Create a handoff request
   */
  async createHandoffRequest(
    sessionId: string,
    evaluation: HandoffEvaluation,
    additionalContext?: Record<string, any>
  ): Promise<HandoffRequest> {
    try {
      const { data, error } = await supabase
        .from('handoff_requests')
        .insert({
          session_id: sessionId,
          reason: evaluation.reason,
          urgency: evaluation.urgency,
          status: 'pending',
          metadata: {
            triggers: evaluation.triggers,
            score: evaluation.score,
            created_by: 'ai_system',
            ...additionalContext
          }
        })
        .select()
        .single()

      if (error) throw error

      // Notify available agents
      await this.notifyAvailableAgents(evaluation.urgency, data.id)

      // Update session to indicate handoff pending
      await this.updateSessionHandoffStatus(sessionId, 'pending')

      return data
    } catch (error) { 
      console.error('Error creating handoff request:', error)
      throw error
    }
  }

  /**
   * Get pending handoff requests
   */
  async getPendingHandoffRequests(urgency?: 'low' | 'medium' | 'high'): Promise<HandoffRequest[]> {
    try {
      let query = supabase
        .from('handoff_requests')
        .select(`
          *,
          session:chat_sessions(
            sender_id,
            sender_name,
            sender_type,
            last_message_at
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

      if (urgency) {
        query = query.eq('urgency', urgency)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    } catch (error) { 
      console.error('Error fetching pending handoff requests:', error)
      return []
    }
  }

  /**
   * Assign handoff request to agent
   */
  async assignHandoffRequest(
    handoffId: string,
    agentId: string
  ): Promise<HandoffRequest> {
    try {
      const { data, error } = await supabase
        .from('handoff_requests')
        .update({
          status: 'assigned',
          assigned_agent_id: agentId,
          metadata: {
            assigned_at: new Date().toISOString()
          }
        })
        .eq('id', handoffId)
        .select()
        .single()

      if (error) throw error

      // Update session status
      await this.updateSessionHandoffStatus(data.session_id, 'assigned')

      return data
    } catch (error) { 
      console.error('Error assigning handoff request:', error)
      throw error
    }
  }

  /**
   * Resolve handoff request
   */
  async resolveHandoffRequest(
    handoffId: string,
    resolution?: string
  ): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('handoff_requests')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          metadata: {
            resolution
          }
        })
        .eq('id', handoffId)
        .select('session_id')
        .single()

      if (error) throw error

      // Update session status back to AI
      await this.updateSessionHandoffStatus(data.session_id, 'resolved')
    } catch (error) { 
      console.error('Error resolving handoff request:', error)
      throw error
    }
  }

  /**
   * Update session handoff status
   */
  private async updateSessionHandoffStatus(
    sessionId: string,
    status: 'pending' | 'assigned' | 'resolved'
  ): Promise<void> {
    try {
      await supabase
        .from('chat_sessions')
        .update({
          session_metadata: {
            handoff_status: status,
            handoff_updated_at: new Date().toISOString()
          }
        })
        .eq('id', sessionId)
    } catch (error) { 
      console.error('Error updating session handoff status:', error)
    }
  }

  /**
   * Notify available agents about new handoff request
   */
  private async notifyAvailableAgents(
    urgency: 'low' | 'medium' | 'high',
    handoffId: string
  ): Promise<void> {
    try {
      // This could be enhanced with real-time notifications
      // For now, we'll create a notification record
      
      // Get available agents (this would need an agents table)
      // For now, we'll just log the notification
      
      // In a real implementation, this could:
      // 1. Send push notifications to agent apps
      // 2. Send emails to on-duty agents
      // 3. Post to Slack/Teams channels
      // 4. Create in-app notifications
      // 5. Send SMS for high priority items
      
      // Example with Supabase Realtime:
      await supabase
        .channel('agent-notifications')
        .send({
          type: 'broadcast',
          event: 'handoff-request',
          payload: {
            handoff_id: handoffId,
            urgency,
            created_at: new Date().toISOString()
          }
        })
    } catch (error) { 
      console.error('Error notifying agents:', error)
    }
  }

  /**
   * Get handoff statistics
   */
  async getHandoffStatistics(timeRange?: {
    start: string
    end: string
  }): Promise<{
    total: number
    pending: number
    assigned: number
    resolved: number
    byUrgency: Record<string, number>
    avgResolutionTime: number
  }> {
    try {
      let query = supabase.from('handoff_requests').select('*')
      
      if (timeRange) {
        query = query
          .gte('created_at', timeRange.start)
          .lte('created_at', timeRange.end)
      }

      const { data, error } = await query

      if (error) throw error

      const requests = data || []
      
      return {
        total: requests.length,
        pending: requests.filter(r => r.status === 'pending').length,
        assigned: requests.filter(r => r.status === 'assigned').length,
        resolved: requests.filter(r => r.status === 'resolved').length,
        byUrgency: {
          low: requests.filter(r => r.urgency === 'low').length,
          medium: requests.filter(r => r.urgency === 'medium').length,
          high: requests.filter(r => r.urgency === 'high').length
        },
        avgResolutionTime: this.calculateAverageResolutionTime(requests)
      }
    } catch (error) { 
      console.error('Error fetching handoff statistics:', error)
      return {
        total: 0,
        pending: 0,
        assigned: 0,
        resolved: 0,
        byUrgency: { low: 0, medium: 0, high: 0 },
        avgResolutionTime: 0
      }
    }
  }

  /**
   * Calculate average resolution time for resolved requests
   */
  private calculateAverageResolutionTime(requests: any[]): number {
    const resolvedRequests = requests.filter(r => 
      r.status === 'resolved' && r.resolved_at && r.created_at
    )
    
    if (resolvedRequests.length === 0) return 0
    
    const totalTime = resolvedRequests.reduce((sum, request) => {
      const created = new Date(request.created_at)
      const resolved = new Date(request.resolved_at)
      return sum + (resolved.getTime() - created.getTime())
    }, 0)
    
    // Return average time in minutes
    return Math.round(totalTime / resolvedRequests.length / 1000 / 60)
  }
}

// Export singleton instance
export const handoffService = HandoffService.getInstance() 