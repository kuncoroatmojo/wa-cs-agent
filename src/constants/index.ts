// API Configuration
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'https://api.wacanda.com',
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RATE_LIMIT: 100, // requests per minute
} as const;

// AI Providers
export const AI_PROVIDERS = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic'
} as const;

export const AI_MODELS = {
  [AI_PROVIDERS.OPENAI]: [
    'gpt-4o',
    'gpt-4o-mini', 
    'gpt-4-turbo',
    'gpt-3.5-turbo'
  ],
  [AI_PROVIDERS.ANTHROPIC]: [
    'claude-3-5-sonnet-20241022',
    'claude-3-opus-20240229',
    'claude-3-haiku-20240307'
  ],
  [AI_PROVIDERS.GOOGLE]: [
    'gemini-1.5-pro',
    'gemini-1.5-flash'
  ],
  [AI_PROVIDERS.AZURE]: [
    'gpt-4',
    'gpt-35-turbo'
  ]
} as const;

// Default AI Configuration
export const DEFAULT_AI_CONFIG = {
  temperature: 0.7,
  max_tokens: 1000,
  top_p: 1.0,
  frequency_penalty: 0.0,
  presence_penalty: 0.0
} as const;

// Document Processing
export const DOCUMENT_CONFIG = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_TYPES: [
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
    'application/json'
  ],
  CHUNK_SIZE: 1000,
  CHUNK_OVERLAP: 200,
  MAX_DOCUMENTS_PER_USER: {
    free: 10,
    pro: 100,
    enterprise: 1000
  }
} as const;

// Web Page Scraping
export const WEB_PAGE_CONFIG = {
  MAX_PAGES_PER_USER: {
    free: 5,
    pro: 50,
    enterprise: 500
  },
  MAX_DEPTH: 3,
  DEFAULT_TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  MIN_CONTENT_LENGTH: 100
} as const;

// Chat Configuration
export const CHAT_CONFIG = {
  MAX_MESSAGE_LENGTH: 4000,
  MAX_SESSIONS_PER_USER: {
    free: 10,
    pro: 100,
    enterprise: 1000
  },
  MESSAGE_BATCH_SIZE: 50,
  SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
  MAX_CONTEXT_MESSAGES: 20
} as const;

// WhatsApp Integration
export const WHATSAPP_CONFIG = {
  MAX_INTEGRATIONS_PER_USER: {
    free: 1,
    pro: 3,
    enterprise: 10
  },
  QR_CODE_TIMEOUT: 60000, // 1 minute
  RECONNECT_INTERVAL: 30000, // 30 seconds
  MAX_RECONNECT_ATTEMPTS: 5,
  MESSAGE_DELAY: 1000 // 1 second between messages
} as const;

// Subscription Tiers
export const SUBSCRIPTION_TIERS = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise'
} as const;

export const SUBSCRIPTION_LIMITS = {
  [SUBSCRIPTION_TIERS.FREE]: {
    documents: 10,
    web_pages: 5,
    chat_sessions: 10,
    whatsapp_integrations: 1,
    external_integrations: 1,
    monthly_messages: 100,
    ai_requests_per_month: 500,
    storage_mb: 100,
    support: 'community'
  },
  [SUBSCRIPTION_TIERS.PRO]: {
    documents: 100,
    web_pages: 50,
    chat_sessions: 100,
    whatsapp_integrations: 3,
    external_integrations: 5,
    monthly_messages: 1000,
    ai_requests_per_month: 5000,
    storage_mb: 1000,
    support: 'email'
  },
  [SUBSCRIPTION_TIERS.ENTERPRISE]: {
    documents: 1000,
    web_pages: 500,
    chat_sessions: 1000,
    whatsapp_integrations: 10,
    external_integrations: 20,
    monthly_messages: 10000,
    ai_requests_per_month: 50000,
    storage_mb: 10000,
    support: 'priority'
  }
} as const;

// User Roles
export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin'
} as const;

// Integration Types
export const INTEGRATION_TYPES = {
  WHATSAPP: 'whatsapp',
  TELEGRAM: 'telegram',
  SLACK: 'slack',
  DISCORD: 'discord',
  WEBHOOK: 'webhook',
  API: 'api',
  WHATWUT: 'whatwut'
} as const;

// Document Status
export const DOCUMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  READY: 'ready',
  ERROR: 'error'
} as const;

// Web Page Status
export const WEB_PAGE_STATUS = {
  PENDING: 'pending',
  SCRAPING: 'scraping',
  PROCESSING: 'processing', 
  READY: 'ready',
  ERROR: 'error'
} as const;

// Chat Session Status
export const CHAT_SESSION_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived'
} as const;

// WhatsApp Status
export const WHATSAPP_STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error'
} as const;

// Message Roles
export const MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system'
} as const;

// Error Types
export const ERROR_TYPES = {
  VALIDATION: 'validation',
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  NOT_FOUND: 'not_found',
  RATE_LIMIT: 'rate_limit',
  EXTERNAL_API: 'external_api',
  INTERNAL: 'internal'
} as const;

// Cache Configuration
export const CACHE_CONFIG = {
  TTL: {
    PROFILE: 5 * 60 * 1000, // 5 minutes
    DOCUMENTS: 2 * 60 * 1000, // 2 minutes
    CHAT_SESSIONS: 1 * 60 * 1000, // 1 minute
    AI_CONFIG: 10 * 60 * 1000, // 10 minutes
    INTEGRATIONS: 5 * 60 * 1000 // 5 minutes
  },
  MAX_SIZE: 100 // Max items in cache
} as const;

// Realtime Channels
export const REALTIME_CHANNELS = {
  CHAT_UPDATES: 'chat_updates',
  DOCUMENT_PROCESSING: 'document_processing',
  INTEGRATION_STATUS: 'integration_status',
  PROFILE_UPDATES: 'profile_updates'
} as const;

// Default Settings
export const DEFAULT_SETTINGS = {
  theme: 'light',
  language: 'en',
  notifications: {
    email: true,
    browser: true,
    whatsapp: false
  },
  privacy: {
    data_retention_days: 30,
    analytics: true,
    marketing: false
  },
  ai: {
    default_temperature: 0.7,
    default_max_tokens: 1000,
    default_model: 'gpt-4o'
  }
} as const;

// Feature Flags
export const FEATURES = {
  DOCUMENT_UPLOAD: true,
  WEB_PAGE_SCRAPING: true,
  WHATSAPP_INTEGRATION: true,
  EXTERNAL_INTEGRATIONS: true,
  CHAT_EXPORT: true,
  ANALYTICS: true,
  BETA_FEATURES: false
} as const;

// Validation Rules
export const VALIDATION = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD_MIN_LENGTH: 8,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
  URL: /^https?:\/\/.+/,
  PHONE: /^\+?[\d\s\-\(\)]+$/
} as const; 