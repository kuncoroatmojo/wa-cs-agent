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
  connectionType: 'baileys' | 'cloud_api';
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

// RAG and AI Types
export interface Document {
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