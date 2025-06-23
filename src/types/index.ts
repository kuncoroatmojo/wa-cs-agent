// User and Authentication Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'user' | 'agent';
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// WhatsApp Connection Types
export interface WhatsAppInstance {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  connectionType: 'baileys' | 'cloud_api' | 'evolution_api';
  instanceKey: string;
  phoneNumber?: string;
  qrCode?: string;
  lastSeen?: string;
  userId: string;
  settings: WhatsAppSettings;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppSettings {
  autoReply: boolean;
  businessHours: {
    enabled: boolean;
    timezone: string;
    schedule: {
      [key: string]: { start: string; end: string; enabled: boolean };
    };
  };
  welcomeMessage: string;
  outOfHoursMessage: string;
  humanHandoffKeywords: string[];
  maxResponseTime: number;
}

export interface WhatsAppMessage {
  id: string;
  instanceId: string;
  from: string;
  to: string;
  body: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document';
  timestamp: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  isFromBot: boolean;
  metadata?: Record<string, any>;
}

export interface Message {
  id: string;
  instance_id: string;
  phone_number: string;
  message_id: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact';
  content: string;
  direction: 'inbound' | 'outbound';
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  metadata?: any;
  created_at?: string;
  updated_at?: string;
}

// RAG and AI Types - Legacy interface kept for compatibility
export interface LegacyDocument {
  id: string;
  title: string;
  content: string;
  source: 'google_drive' | 'manual_upload' | 'web_scrape';
  sourceId?: string;
  metadata: {
    fileType?: string;
    url?: string;
    lastModified?: string;
    author?: string;
    tags?: string[];
  };
  embedding?: number[];
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface RAGConfig {
  id: string;
  userId: string;
  name: string;
  description: string;
  model: 'gpt-4' | 'gpt-3.5-turbo' | 'claude-3-sonnet';
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  tools: RAGTool[];
  documentSources: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RAGTool {
  id: string;
  name: string;
  description: string;
  type: 'vector_search' | 'web_scrape' | 'google_drive' | 'custom_api';
  config: Record<string, any>;
  isEnabled: boolean;
}

// Chat and Conversation Types
export interface Conversation {
  id: string;
  instanceId: string;
  contactPhone: string;
  contactName?: string;
  status: 'active' | 'resolved' | 'handed_off' | 'archived';
  assignedAgent?: string;
  messages: WhatsAppMessage[];
  tags: string[];
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  lastMessagePreview?: string;
  remoteJid?: string; // Evolution API remote JID for message filtering
}

// Google Drive Integration Types
export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  modifiedTime: string;
  webViewLink: string;
  parents: string[];
}

export interface GoogleDriveFolder {
  id: string;
  name: string;
  files: GoogleDriveFile[];
  folders: GoogleDriveFolder[];
  isWatched: boolean;
  lastSyncAt?: string;
}

// Analytics and Reporting Types
export interface Analytics {
  messagesCount: {
    total: number;
    byDay: { date: string; count: number }[];
    byHour: { hour: number; count: number }[];
  };
  conversationsCount: {
    total: number;
    active: number;
    resolved: number;
    handedOff: number;
  };
  responseTime: {
    average: number;
    median: number;
    p95: number;
  };
  topKeywords: { keyword: string; count: number }[];
  userSatisfaction: {
    average: number;
    distribution: { rating: number; count: number }[];
  };
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Form and UI Types
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'select' | 'textarea' | 'number' | 'checkbox' | 'file';
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

export interface NotificationMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  actions?: { label: string; onClick: () => void }[];
}

// Webhook and Event Types
export interface WebhookEvent {
  id: string;
  type: 'message_received' | 'message_sent' | 'status_update' | 'connection_change';
  instanceId: string;
  data: Record<string, any>;
  timestamp: string;
  processed: boolean;
}

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

// Evolution API Types
export interface EvolutionAPIInstance {
  instanceName: string;
  status: string;
  serverUrl: string;
  apikey: string;
  owner: string;
  profileName?: string;
  profilePicUrl?: string;
  integration?: string;
}

export interface EvolutionAPIWebhook {
  enabled: boolean;
  url: string;
  events: string[];
  webhook_by_events: boolean;
}

// Supabase Edge Function Types
export interface EdgeFunctionResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

// Bot Configuration Types
export interface BotSchedule {
  id: string;
  instanceId: string;
  isEnabled: boolean;
  timezone: string;
  schedule: {
    monday: { enabled: boolean; start: string; end: string };
    tuesday: { enabled: boolean; start: string; end: string };
    wednesday: { enabled: boolean; start: string; end: string };
    thursday: { enabled: boolean; start: string; end: string };
    friday: { enabled: boolean; start: string; end: string };
    saturday: { enabled: boolean; start: string; end: string };
    sunday: { enabled: boolean; start: string; end: string };
  };
  holidays: { date: string; name: string }[];
  createdAt: string;
  updatedAt: string;
}

// Core Wacanda Types - Phase 1
// Based on comprehensive development plan

export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface AIConfiguration {
  id: string;
  user_id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'custom';
  api_key: string;
  model_name: string;
  temperature: number;
  max_tokens: number;
  system_prompt?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  sender_id: string;
  sender_name?: string;
  sender_type: 'whatsapp' | 'whatwut' | 'api' | 'dashboard';
  session_metadata: Record<string, any>;
  last_message_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  messages?: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  message_type: 'text' | 'image' | 'document' | 'audio';
  metadata: Record<string, any>;
  tokens_used?: number;
  model_used?: string;
  confidence_score?: number;
  response_time_ms?: number;
  created_at: string;
  rag_context?: RAGContext;
}

export interface Document {
  id: string;
  user_id: string;
  title: string;
  content?: string;
  file_path?: string;
  file_type?: string;
  file_size?: number;
  folder_path: string;
  upload_date: string;
  processed_date?: string;
  status: 'pending' | 'processing' | 'ready' | 'error';
  error_message?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface WebPage {
  id: string;
  user_id: string;
  url: string;
  title?: string;
  content?: string;
  scraped_at?: string;
  status: 'pending' | 'scraping' | 'ready' | 'error';
  include_children: boolean;
  max_depth: number;
  error_message?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DocumentEmbedding {
  id: string;
  user_id: string;
  source_id: string;
  source_type: 'document' | 'webpage';
  chunk_text: string;
  chunk_index: number;
  embedding: number[];
  metadata: Record<string, any>;
  created_at: string;
}

export interface RAGContext {
  id: string;
  message_id: string;
  source_documents: string[];
  similarity_scores: number[];
  context_used: string;
  retrieval_query: string;
  created_at: string;
}

export interface WhatsAppIntegration {
  id: string;
  user_id: string;
  name: string;
  connection_type: 'baileys' | 'cloud_api';
  phone_number?: string;
  instance_key: string;
  qr_code?: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  credentials: Record<string, any>;
  settings: Record<string, any>;
  last_connected_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ExternalIntegration {
  id: string;
  user_id: string;
  name: string;
  integration_type: string;
  api_key?: string;
  webhook_url?: string;
  settings: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Additional utility types
export interface DocumentChunk {
  id: string;
  content: string;
  similarity: number;
  source_id: string;
  source_type: 'document' | 'webpage';
  metadata: Record<string, any>;
}

export interface ConversationContext {
  recentMessages: ChatMessage[];
  summary: string;
  topics: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface UsageMetrics {
  total_sessions: number;
  total_messages: number;
  avg_response_time: number;
  total_tokens_used: number;
  handoff_rate: number;
  avg_confidence: number;
  active_sessions: number;
}

export interface PerformanceMetrics {
  uptime: number;
  error_rate: number;
  avg_database_query_time: number;
  active_users: number;
}

export interface RAGMetrics {
  avg_similarity_score: number;
  documents_used: number;
  successful_retrievals: number;
  failed_retrievals: number;
}

export interface UnifiedMessage {
  id: string;
  conversation_id: string;
  content: string;
  message_type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'contact' | 'sticker' | 'reaction';
  media_url?: string;
  media_metadata: Record<string, any>;
  direction: 'inbound' | 'outbound';
  sender_type: 'contact' | 'agent' | 'bot';
  sender_name?: string;
  sender_id?: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  ai_processed: boolean;
  ai_response_time_ms?: number;
  ai_model_used?: string;
  ai_confidence_score?: number;
  ai_tokens_used?: number;
  external_message_id?: string;
  external_timestamp?: string;
  external_metadata: Record<string, any>;
  rag_context_used?: string;
  rag_sources?: string[];
  rag_similarity_scores?: number[];
  created_at: string;
  updated_at: string;
} 