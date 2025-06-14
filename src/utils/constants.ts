// App Configuration
export const APP_CONFIG = {
  NAME: 'WhatsApp AI Assistant',
  VERSION: '1.0.0',
  DESCRIPTION: 'AI-powered WhatsApp customer support with RAG capabilities',
  AUTHOR: 'Your Name',
  GITHUB: 'https://github.com/your-username/wa-cs-agent',
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  EVOLUTION: {
    INSTANCE: {
      CREATE: '/instance/create',
      CONNECT: '/instance/connect',
      INFO: '/instance/connectionState',
      QR: '/instance/qrcode',
      LOGOUT: '/instance/logout',
      DELETE: '/instance/delete',
      RESTART: '/instance/restart',
    },
    MESSAGE: {
      SEND_TEXT: '/message/sendText',
      SEND_MEDIA: '/message/sendMedia',
    },
    CHAT: {
      FIND_CHATS: '/chat/findChats',
      FIND_MESSAGES: '/chat/findMessages',
      MARK_READ: '/chat/markMessageAsRead',
    },
    WEBHOOK: {
      SET: '/webhook/set',
      FIND: '/webhook/find',
    },
  },
} as const;

// Database Tables
export const DB_TABLES = {
  USERS: 'users',
  WHATSAPP_INSTANCES: 'whatsapp_instances',
  MESSAGES: 'messages',
  CONVERSATIONS: 'conversations',
  DOCUMENTS: 'documents',
  RAG_CONFIGS: 'rag_configs',
  ANALYTICS: 'analytics',
  SETTINGS: 'settings',
} as const;

// WhatsApp Message Types
export const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  DOCUMENT: 'document',
  LOCATION: 'location',
  CONTACT: 'contact',
  STICKER: 'sticker',
} as const;

// Connection Statuses
export const CONNECTION_STATUS = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  ERROR: 'error',
} as const;

// Message Directions
export const MESSAGE_DIRECTION = {
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
} as const;

// Message Status
export const MESSAGE_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
} as const;

// Conversation Status
export const CONVERSATION_STATUS = {
  ACTIVE: 'active',
  RESOLVED: 'resolved',
  HANDED_OFF: 'handed_off',
  ARCHIVED: 'archived',
} as const;

// User Roles
export const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  AGENT: 'agent',
} as const;

// Notification Types
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
} as const;

// File Types
export const FILE_TYPES = {
  GOOGLE_DOCS: 'application/vnd.google-apps.document',
  GOOGLE_SHEETS: 'application/vnd.google-apps.spreadsheet',
  PDF: 'application/pdf',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  TXT: 'text/plain',
} as const;

// AI Models
export const AI_MODELS = {
  GPT_4: 'gpt-4',
  GPT_3_5_TURBO: 'gpt-3.5-turbo',
  CLAUDE_3_SONNET: 'claude-3-sonnet',
} as const;

// Webhook Events
export const WEBHOOK_EVENTS = {
  MESSAGE_RECEIVED: 'messages.upsert',
  CONNECTION_UPDATE: 'connection.update',
  QR_CODE_UPDATE: 'qrcode.updated',
  INSTANCE_DELETE: 'instance.delete',
} as const;

// Default Settings
export const DEFAULT_SETTINGS = {
  WHATSAPP: {
    AUTO_REPLY: true,
    WELCOME_MESSAGE: 'Hello! How can I help you today?',
    OUT_OF_HOURS_MESSAGE: 'Thank you for your message. We are currently out of office hours and will respond as soon as possible.',
    MAX_RESPONSE_TIME: 5000, // 5 seconds
    HUMAN_HANDOFF_KEYWORDS: ['human', 'agent', 'support', 'help'],
  },
  RAG: {
    TEMPERATURE: 0.7,
    MAX_TOKENS: 1000,
    SYSTEM_PROMPT: 'You are a helpful customer support assistant. Use the provided documents to answer questions accurately and helpfully.',
  },
  ANALYTICS: {
    RETENTION_DAYS: 90,
    CHART_COLORS: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
  },
} as const;

// Regex Patterns
export const REGEX_PATTERNS = {
  PHONE_NUMBER: /^\+?[1-9]\d{1,14}$/,
  BRAZILIAN_PHONE: /^55\d{10,11}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  URL: /^https?:\/\/.+/,
} as const;

// Time Constants
export const TIME_CONSTANTS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'wa-cs-auth-token',
  USER_PREFERENCES: 'wa-cs-user-preferences',
  THEME: 'wa-cs-theme',
  LANGUAGE: 'wa-cs-language',
} as const;

// Routes
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  INSTANCES: '/instances',
  CONVERSATIONS: '/conversations',
  DOCUMENTS: '/documents',
  RAG_CONFIG: '/rag-config',
  ANALYTICS: '/analytics',
  SETTINGS: '/settings',
} as const; 