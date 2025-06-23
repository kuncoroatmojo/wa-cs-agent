import { supabase } from '../lib/supabase'

export interface PerformanceMetrics {
  system: {
    uptime: number
    memoryUsage: number
    cpuUsage: number
    requestCount: number
    errorRate: number
  }
  database: {
    connectionCount: number
    queryPerformance: {
      averageTime: number
      slowQueries: number
    }
    cacheHitRate: number
  }
  ai: {
    averageResponseTime: number
    tokensPerSecond: number
    errorRate: number
    apiLatency: number
  }
  rag: {
    averageSearchTime: number
    embeddingGenerationTime: number
    contextRetrievalSuccess: number
  }
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical'
  issues: Array<{
    type: 'performance' | 'error' | 'capacity' | 'security'
    severity: 'low' | 'medium' | 'high' | 'critical'
    message: string
    metric?: string
    value?: number
    threshold?: number
  }>
  recommendations: string[]
  lastChecked: string
}

export interface OptimizationSuggestion {
  type: 'query' | 'index' | 'cache' | 'configuration'
  priority: 'low' | 'medium' | 'high'
  description: string
  impact: string
  implementation: string
  estimatedGain: string
}

export class PerformanceService {
  private static instance: PerformanceService
  private metricsCache: Map<string, { data: any; timestamp: number }> = new Map()
  private readonly CACHE_TTL = 60000 // 1 minute

  static getInstance(): PerformanceService {
    if (!PerformanceService.instance) {
      PerformanceService.instance = new PerformanceService()
    }
    return PerformanceService.instance
  }

  /**
   * Get comprehensive performance metrics
   */
  async getPerformanceMetrics(timeRange?: {
    start: string
    end: string
  }): Promise<PerformanceMetrics> {
    const cacheKey = `performance_metrics_${timeRange?.start || 'default'}_${timeRange?.end || 'default'}`
    
    // Check cache first
    const cached = this.getCachedData(cacheKey)
    if (cached) return cached

    try {
      const [systemMetrics, databaseMetrics, aiMetrics, ragMetrics] = await Promise.all([
        this.getSystemMetrics(timeRange),
        this.getDatabaseMetrics(timeRange),
        this.getAIMetrics(timeRange),
        this.getRAGMetrics(timeRange)
      ])

      const metrics: PerformanceMetrics = {
        system: systemMetrics,
        database: databaseMetrics,
        ai: aiMetrics,
        rag: ragMetrics
      }

      // Cache the results
      this.setCachedData(cacheKey, metrics)
      
      return metrics
    } catch (error) { 
      console.error('Error fetching performance metrics:', error)
      return this.getDefaultMetrics()
    }
  }

  /**
   * Check system health status
   */
  async checkSystemHealth(): Promise<SystemHealth> {
    try {
      const metrics = await this.getPerformanceMetrics()
      const issues: SystemHealth['issues'] = []
      const recommendations: string[] = []

      // Check system performance
      if (metrics.system.errorRate > 5) {
        issues.push({
          type: 'error',
          severity: 'high',
          message: `High error rate: ${metrics.system.errorRate}%`,
          metric: 'error_rate',
          value: metrics.system.errorRate,
          threshold: 5
        })
        recommendations.push('Investigate error logs and implement additional error handling')
      }

      if (metrics.system.memoryUsage > 80) {
        issues.push({
          type: 'performance',
          severity: 'medium',
          message: `High memory usage: ${metrics.system.memoryUsage}%`,
          metric: 'memory_usage',
          value: metrics.system.memoryUsage,
          threshold: 80
        })
        recommendations.push('Consider optimizing memory usage or scaling up resources')
      }

      // Check AI performance
      if (metrics.ai.averageResponseTime > 5000) {
        issues.push({
          type: 'performance',
          severity: 'medium',
          message: `Slow AI response time: ${metrics.ai.averageResponseTime}ms`,
          metric: 'ai_response_time',
          value: metrics.ai.averageResponseTime,
          threshold: 5000
        })
        recommendations.push('Optimize AI model configuration or consider caching responses')
      }

      // Check database performance
      if (metrics.database.queryPerformance.averageTime > 1000) {
        issues.push({
          type: 'performance',
          severity: 'medium',
          message: `Slow database queries: ${metrics.database.queryPerformance.averageTime}ms`,
          metric: 'db_query_time',
          value: metrics.database.queryPerformance.averageTime,
          threshold: 1000
        })
        recommendations.push('Review and optimize slow database queries, consider adding indexes')
      }

      // Check RAG performance
      if (metrics.rag.averageSearchTime > 2000) {
        issues.push({
          type: 'performance',
          severity: 'medium',
          message: `Slow RAG search: ${metrics.rag.averageSearchTime}ms`,
          metric: 'rag_search_time',
          value: metrics.rag.averageSearchTime,
          threshold: 2000
        })
        recommendations.push('Optimize vector search queries or reduce embedding dimensions')
      }

      // Determine overall health status
      let status: SystemHealth['status'] = 'healthy'
      if (issues.some(issue => issue.severity === 'critical')) {
        status = 'critical'
      } else if (issues.some(issue => issue.severity === 'high')) {
        status = 'critical'
      } else if (issues.length > 0) {
        status = 'warning'
      }

      return {
        status,
        issues,
        recommendations,
        lastChecked: new Date().toISOString()
      }
    } catch (error) { 
      console.error('Error checking system health:', error)
      return {
        status: 'critical',
        issues: [{
          type: 'error',
          severity: 'critical',
          message: 'Unable to check system health'
        }],
        recommendations: ['Check system connectivity and service status'],
        lastChecked: new Date().toISOString()
      }
    }
  }

  /**
   * Get optimization suggestions
   */
  async getOptimizationSuggestions(): Promise<OptimizationSuggestion[]> {
    try {
      const metrics = await this.getPerformanceMetrics()
      const suggestions: OptimizationSuggestion[] = []

      // Query optimization suggestions
      if (metrics.database.queryPerformance.slowQueries > 10) {
        suggestions.push({
          type: 'query',
          priority: 'high',
          description: 'Multiple slow database queries detected',
          impact: 'Reducing query time will improve overall response times',
          implementation: 'Review slow query log and add appropriate indexes',
          estimatedGain: '30-50% improvement in response time'
        })
      }

      // Index suggestions
      const indexSuggestions = await this.analyzeIndexNeeds()
      suggestions.push(...indexSuggestions)

      // Cache optimization
      if (metrics.database.cacheHitRate < 80) {
        suggestions.push({
          type: 'cache',
          priority: 'medium',
          description: 'Low database cache hit rate',
          impact: 'Improving cache utilization reduces database load',
          implementation: 'Tune cache settings and implement application-level caching',
          estimatedGain: '20-30% reduction in database queries'
        })
      }

      // AI optimization
      if (metrics.ai.averageResponseTime > 3000) {
        suggestions.push({
          type: 'configuration',
          priority: 'medium',
          description: 'AI response times could be optimized',
          impact: 'Faster AI responses improve user experience',
          implementation: 'Optimize model parameters, implement response caching',
          estimatedGain: '40-60% faster AI responses'
        })
      }

      // RAG optimization
      if (metrics.rag.averageSearchTime > 1500) {
        suggestions.push({
          type: 'configuration',
          priority: 'medium',
          description: 'Vector search performance could be improved',
          impact: 'Faster semantic search improves RAG response quality',
          implementation: 'Optimize vector indexes and search parameters',
          estimatedGain: '25-40% faster semantic search'
        })
      }

      return suggestions.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 }
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      })
    } catch (error) { 
      console.error('Error getting optimization suggestions:', error)
      return []
    }
  }

  /**
   * Run performance optimization
   */
  async runOptimization(optimizationType: 'indexes' | 'cleanup' | 'cache' | 'all'): Promise<{
    success: boolean
    results: Array<{
      type: string
      description: string
      impact: string
    }>
    errors: string[]
  }> {
    const results: Array<{ type: string; description: string; impact: string }> = []
    const errors: string[] = []

    try {
      if (optimizationType === 'cleanup' || optimizationType === 'all') {
        await this.runDataCleanup(results, errors)
      }

      if (optimizationType === 'indexes' || optimizationType === 'all') {
        await this.optimizeIndexes(results, errors)
      }

      if (optimizationType === 'cache' || optimizationType === 'all') {
        await this.optimizeCache(results, errors)
      }

      return {
        success: errors.length === 0,
        results,
        errors
      }
    } catch (error) { 
      console.error('Error running optimization:', error)
      return {
        success: false,
        results,
        errors: [...errors, error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }

  /**
   * Monitor real-time performance
   */
  async startPerformanceMonitoring(callback: (metrics: PerformanceMetrics) => void): Promise<() => void> {
    const interval = setInterval(async () => {
      try {
        const metrics = await this.getPerformanceMetrics()
        callback(metrics)
      } catch (error) { 
        console.error('Error in performance monitoring:', error)
      }
    }, 30000) // Update every 30 seconds

    // Return cleanup function
    return () => clearInterval(interval)
  }

  /**
   * Get historical performance trends
   */
  async getPerformanceTrends(days: number = 7): Promise<{
    timeline: Array<{
      timestamp: string
      responseTime: number
      errorRate: number
      throughput: number
    }>
    trends: {
      responseTime: 'improving' | 'stable' | 'degrading'
      errorRate: 'improving' | 'stable' | 'degrading'
      throughput: 'improving' | 'stable' | 'degrading'
    }
  }> {
    try {
      // This would typically query a time-series database or logs
      // For now, we'll simulate with sample data
      const timeline = await this.generateSampleTimeline(days)
      const trends = this.analyzeTrends(timeline)

      return { timeline, trends }
    } catch (error) { 
      console.error('Error fetching performance trends:', error)
      return {
        timeline: [],
        trends: {
          responseTime: 'stable',
          errorRate: 'stable',
          throughput: 'stable'
        }
      }
    }
  }

  // Private helper methods

  private async getSystemMetrics(timeRange?: { start: string; end: string }) {
    // In a real implementation, this would collect actual system metrics
    return {
      uptime: 99.9,
      memoryUsage: 65,
      cpuUsage: 45,
      requestCount: 1500,
      errorRate: 0.5
    }
  }

  private async getDatabaseMetrics(timeRange?: { start: string; end: string }) {
    try {
      // Get actual database metrics where possible
      const { data: slowQueries } = await supabase.rpc('get_slow_queries') || { data: [] }
      
      return {
        connectionCount: 15,
        queryPerformance: {
          averageTime: 250,
          slowQueries: slowQueries?.length || 0
        },
        cacheHitRate: 85
      }
    } catch (error) { 
      return {
        connectionCount: 0,
        queryPerformance: {
          averageTime: 0,
          slowQueries: 0
        },
        cacheHitRate: 0
      }
    }
  }

  private async getAIMetrics(timeRange?: { start: string; end: string }) {
    try {
      const startDate = timeRange?.start || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const endDate = timeRange?.end || new Date().toISOString()

      const { data: messages } = await supabase
        .from('chat_messages')
        .select('response_time_ms, tokens_used, created_at')
        .eq('role', 'assistant')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('response_time_ms', 'is', null)

      const validMessages = (messages || []).filter(m => m.response_time_ms > 0)

      if (validMessages.length === 0) {
        return {
          averageResponseTime: 0,
          tokensPerSecond: 0,
          errorRate: 0,
          apiLatency: 0
        }
      }

      const averageResponseTime = validMessages.reduce((sum, m) => sum + m.response_time_ms, 0) / validMessages.length
      const totalTokens = validMessages.reduce((sum, m) => sum + (m.tokens_used || 0), 0)
      const totalTime = validMessages.reduce((sum, m) => sum + m.response_time_ms, 0) / 1000 // Convert to seconds
      const tokensPerSecond = totalTime > 0 ? totalTokens / totalTime : 0

      return {
        averageResponseTime: Math.round(averageResponseTime),
        tokensPerSecond: Math.round(tokensPerSecond),
        errorRate: 0.2, // Would calculate from actual error logs
        apiLatency: Math.round(averageResponseTime * 0.7) // Estimate API latency as portion of total time
      }
    } catch (error) { 
      console.error('Error fetching AI metrics:', error)
      return {
        averageResponseTime: 0,
        tokensPerSecond: 0,
        errorRate: 0,
        apiLatency: 0
      }
    }
  }

  private async getRAGMetrics(timeRange?: { start: string; end: string }) {
    try {
      const startDate = timeRange?.start || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const endDate = timeRange?.end || new Date().toISOString()

      // Get RAG context data for timing analysis
      const { data: ragContexts } = await supabase
        .from('rag_contexts')
        .select('created_at, source_documents')
        .gte('created_at', startDate)
        .lte('created_at', endDate)

      const contexts = ragContexts || []
      const successfulRetrievals = contexts.filter(ctx => ctx.source_documents.length > 0).length

      return {
        averageSearchTime: 800, // Would measure actual search time
        embeddingGenerationTime: 200, // Would measure actual embedding time
        contextRetrievalSuccess: contexts.length > 0 ? (successfulRetrievals / contexts.length) * 100 : 0
      }
    } catch (error) { 
      console.error('Error fetching RAG metrics:', error)
      return {
        averageSearchTime: 0,
        embeddingGenerationTime: 0,
        contextRetrievalSuccess: 0
      }
    }
  }

  private async analyzeIndexNeeds(): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = []

    try {
      // Analyze common query patterns and suggest indexes
      // This is a simplified example - real implementation would analyze query logs
      
      suggestions.push({
        type: 'index',
        priority: 'medium',
        description: 'Consider composite index on chat_messages(session_id, created_at)',
        impact: 'Faster conversation history retrieval',
        implementation: 'CREATE INDEX idx_messages_session_time ON chat_messages(session_id, created_at)',
        estimatedGain: '40-60% faster message queries'
      })

      suggestions.push({
        type: 'index',
        priority: 'low',
        description: 'Partial index on active sessions could improve performance',
        impact: 'Faster active session queries',
        implementation: 'CREATE INDEX idx_active_sessions ON chat_sessions(user_id, last_message_at) WHERE is_active = true',
        estimatedGain: '20-30% faster session queries'
      })
    } catch (error) { 
      console.error('Error analyzing index needs:', error)
    }

    return suggestions
  }

  private async runDataCleanup(results: any[], errors: string[]) {
    try {
      const { data: cleanupResults, error } = await supabase.rpc('cleanup_old_data', {
        days_to_keep: 90
      })

      if (error) throw error

      results.push({
        type: 'cleanup',
        description: 'Cleaned up old data',
        impact: `Removed old records: ${JSON.stringify(cleanupResults)}`
      })
    } catch (error) { 
      errors.push(`Data cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async optimizeIndexes(results: any[], errors: string[]) {
    try {
      // Run ANALYZE to update table statistics
      await supabase.rpc('run_maintenance_tasks')

      results.push({
        type: 'indexes',
        description: 'Updated table statistics',
        impact: 'Improved query planning and performance'
      })
    } catch (error) { 
      errors.push(`Index optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async optimizeCache(results: any[], errors: string[]) {
    try {
      // Clear internal cache to force refresh
      this.metricsCache.clear()

      results.push({
        type: 'cache',
        description: 'Cleared performance metrics cache',
        impact: 'Fresh metrics will be loaded on next request'
      })
    } catch (error) { 
      errors.push(`Cache optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private getCachedData(key: string): any | null {
    const cached = this.metricsCache.get(key)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data
    }
    return null
  }

  private setCachedData(key: string, data: any): void {
    this.metricsCache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  private getDefaultMetrics(): PerformanceMetrics {
    return {
      system: {
        uptime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        requestCount: 0,
        errorRate: 0
      },
      database: {
        connectionCount: 0,
        queryPerformance: {
          averageTime: 0,
          slowQueries: 0
        },
        cacheHitRate: 0
      },
      ai: {
        averageResponseTime: 0,
        tokensPerSecond: 0,
        errorRate: 0,
        apiLatency: 0
      },
      rag: {
        averageSearchTime: 0,
        embeddingGenerationTime: 0,
        contextRetrievalSuccess: 0
      }
    }
  }

  private async generateSampleTimeline(days: number) {
    // Generate sample data for demonstration
    const timeline = []
    for (let i = days; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      timeline.push({
        timestamp: date.toISOString(),
        responseTime: 1000 + Math.random() * 500,
        errorRate: Math.random() * 2,
        throughput: 50 + Math.random() * 20
      })
    }
    return timeline
  }

  private analyzeTrends(timeline: any[]) {
    if (timeline.length < 2) {
      return {
        responseTime: 'stable' as const,
        errorRate: 'stable' as const,
        throughput: 'stable' as const
      }
    }

    const first = timeline[0]
    const last = timeline[timeline.length - 1]

    const responseTimeTrend = last.responseTime < first.responseTime ? 'improving' : 
                             last.responseTime > first.responseTime * 1.1 ? 'degrading' : 'stable'
    
    const errorRateTrend = last.errorRate < first.errorRate ? 'improving' :
                          last.errorRate > first.errorRate * 1.1 ? 'degrading' : 'stable'
    
    const throughputTrend = last.throughput > first.throughput ? 'improving' :
                           last.throughput < first.throughput * 0.9 ? 'degrading' : 'stable'

    return {
      responseTime: responseTimeTrend,
      errorRate: errorRateTrend,
      throughput: throughputTrend
    }
  }
}

// Export singleton instance
export const performanceService = PerformanceService.getInstance() 