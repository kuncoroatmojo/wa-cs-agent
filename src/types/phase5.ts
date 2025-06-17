// Phase 5: Advanced Features & Performance Optimization Types
import type { ChatMessage, ChatSession, AIConfiguration, Document, WebPage, DocumentEmbedding, Profile } from './index'

export interface ConversationContext {
  recentMessages: ChatMessage[]
  summary: string
  topics: string[]
  sentiment: 'positive' | 'neutral' | 'negative'
  complexity?: number
  urgency?: 'low' | 'medium' | 'high'
  handoffProbability?: number
}

export interface DocumentChunk {
  id: string
  content: string
  similarity: number
  source_id: string
  source_type: 'document' | 'webpage'
  chunk_index: number
  metadata: Record<string, any>
}

export interface RAGContext {
  id: string
  message_id: string
  source_documents: string[]
  similarity_scores: number[]
  context_used: string
  retrieval_query: string
  created_at: string
}

export interface UsageMetrics {
  total_sessions: number
  total_messages: number
  avg_response_time: number
  total_tokens_used: number
  handoff_rate: number
  avg_confidence: number
  active_sessions: number
}

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

export interface RAGMetrics {
  avg_similarity_score: number
  documents_used: number
  successful_retrievals: number
  failed_retrievals: number
}

export interface HandoffRequest {
  id: string
  session_id: string
  reason: string
  urgency: 'low' | 'medium' | 'high'
  status: 'pending' | 'assigned' | 'resolved' | 'cancelled'
  assigned_agent_id?: string
  created_at: string
  assigned_at?: string
  resolved_at?: string
  metadata: Record<string, any>
  resolution_notes?: string
}

export interface AgentAvailability {
  id: string
  agent_id: string
  is_available: boolean
  status: 'online' | 'busy' | 'away' | 'offline'
  max_concurrent_chats: number
  current_chat_count: number
  last_activity: string
  working_hours: Record<string, any>
  created_at: string
  updated_at: string
}

export interface ConversationAnalytics {
  messageCount: number
  avgResponseTime: number
  sentimentScore: number
  complexityScore: number
  handoffProbability: number
  topTopics: string[]
  confidenceDistribution: Array<{
    range: string
    count: number
  }>
  timeline: Array<{
    date: string
    messageCount: number
  }>
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

export interface AIModelConfiguration {
  provider: 'openai' | 'anthropic' | 'custom'
  model_name: string
  temperature: number
  max_tokens: number
  system_prompt?: string
  api_key: string
  api_endpoint?: string
  custom_headers?: Record<string, string>
}

export interface RAGConfiguration {
  search_threshold: number
  max_sources: number
  chunk_size: number
  chunk_overlap: number
  embedding_model: string
  include_conversation_context: boolean
  context_weight: number
}

export interface CacheMetrics {
  namespace: string
  hits: number
  misses: number
  hitRate: number
  totalEntries: number
  memoryUsage: number
  evictions: number
}

export interface PerformanceTrend {
  metric: string
  trend: 'improving' | 'stable' | 'degrading'
  current_value: number
  previous_value: number
  change_percentage: number
  timeframe: string
}

export interface SecurityAuditLog {
  id: string
  user_id: string
  action: string
  resource_type: string
  resource_id?: string
  ip_address: string
  user_agent: string
  success: boolean
  error_message?: string
  metadata: Record<string, any>
  created_at: string
}

export interface APIUsageMetrics {
  endpoint: string
  method: string
  total_requests: number
  avg_response_time: number
  error_rate: number
  rate_limit_hits: number
  last_24h: {
    requests: number
    errors: number
    avg_time: number
  }
}

export interface ResourceUsage {
  cpu_usage: number
  memory_usage: number
  disk_usage: number
  network_io: {
    incoming: number
    outgoing: number
  }
  database_connections: number
  active_sessions: number
  timestamp: string
}

export interface AlertRule {
  id: string
  name: string
  metric: string
  operator: '>' | '<' | '=' | '>=' | '<='
  threshold: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  enabled: boolean
  notification_channels: string[]
  cooldown_minutes: number
  created_at: string
  updated_at: string
}

export interface AlertNotification {
  id: string
  rule_id: string
  metric: string
  value: number
  threshold: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  status: 'fired' | 'resolved'
  fired_at: string
  resolved_at?: string
}

export interface BackupConfiguration {
  id: string
  name: string
  schedule: string // Cron expression
  retention_days: number
  include_files: boolean
  include_database: boolean
  encryption_enabled: boolean
  last_backup: string
  next_backup: string
  status: 'active' | 'paused' | 'error'
}

export interface MaintenanceWindow {
  id: string
  name: string
  start_time: string
  end_time: string
  timezone: string
  recurring: boolean
  recurrence_pattern?: string
  description: string
  impact_level: 'low' | 'medium' | 'high'
  notification_advance_hours: number
  created_at: string
}

export interface FeatureFlag {
  id: string
  name: string
  key: string
  description: string
  enabled: boolean
  rollout_percentage: number
  target_users?: string[]
  target_groups?: string[]
  conditions?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface ABTestConfiguration {
  id: string
  name: string
  description: string
  status: 'draft' | 'running' | 'completed' | 'paused'
  start_date: string
  end_date?: string
  variants: Array<{
    name: string
    percentage: number
    configuration: Record<string, any>
  }>
  metrics: string[]
  hypothesis: string
  results?: Record<string, any>
}

export interface QualityMetrics {
  response_accuracy: number
  hallucination_rate: number
  factual_consistency: number
  relevance_score: number
  user_satisfaction: number
  resolution_rate: number
  escalation_rate: number
  avg_conversation_length: number
}

export interface ModelPerformanceMetrics {
  model_name: string
  version: string
  latency_p50: number
  latency_p95: number
  latency_p99: number
  throughput: number
  error_rate: number
  accuracy: number
  confidence_distribution: Record<string, number>
  cost_per_request: number
  token_efficiency: number
}

export interface ConversationFlow {
  id: string
  session_id: string
  steps: Array<{
    step_id: string
    step_type: 'user_message' | 'ai_response' | 'handoff' | 'resolution'
    timestamp: string
    data: Record<string, any>
    duration_ms?: number
  }>
  total_duration_ms: number
  outcome: 'resolved' | 'escalated' | 'abandoned'
  satisfaction_score?: number
}

// Re-export commonly used types from main types file
export type {
  ChatSession,
  ChatMessage,
  AIConfiguration,
  Document,
  WebPage,
  DocumentEmbedding,
  Profile
} 