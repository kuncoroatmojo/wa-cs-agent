export interface MessageData {
  from: string
  to?: string
  body: string
  timestamp: string
  messageId: string
  type: 'text' | 'image' | 'document' | 'audio' | 'video'
  mediaUrl?: string
  metadata?: Record<string, any>
}

export interface ConnectionConfig {
  type: 'api' | 'web' | 'webhook'
  credentials: Record<string, any>
  settings?: Record<string, any>
}

export interface ConnectionStatus {
  status: 'connected' | 'connecting' | 'disconnected' | 'error'
  message?: string
  lastConnected?: Date
  qrCode?: string
  metadata?: Record<string, any>
}

export interface SendMessageOptions {
  to: string
  message: string
  type?: 'text' | 'image' | 'document'
  mediaUrl?: string
  metadata?: Record<string, any>
}

export interface WebhookData {
  provider: string
  instanceKey?: string
  message?: MessageData
  event?: {
    type: string
    data: Record<string, any>
  }
  metadata?: Record<string, any>
}

export abstract class BaseMessagingProvider {
  protected config: ConnectionConfig
  protected status: ConnectionStatus = {
    status: 'disconnected'
  }

  constructor(config: ConnectionConfig) {
    this.config = config
  }

  // Abstract methods that must be implemented by providers
  abstract connect(): Promise<ConnectionStatus>
  abstract disconnect(): Promise<void>
  abstract sendMessage(options: SendMessageOptions): Promise<boolean>
  abstract getStatus(): Promise<ConnectionStatus>
  abstract processWebhook(data: WebhookData): Promise<MessageData | null>

  // Common utility methods
  protected normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters except +
    const cleaned = phone.replace(/[^\d+]/g, '')
    
    // If it starts with +, keep it, otherwise add country code logic
    if (cleaned.startsWith('+')) {
      return cleaned
    }
    
    // Default to adding + if not present (can be overridden by providers)
    return `+${cleaned}`
  }

  protected generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  protected validateMessage(message: string): boolean {
    return Boolean(message && message.trim().length > 0 && message.length <= 4096)
  }

  // Getter for current status
  public getCurrentStatus(): ConnectionStatus {
    return { ...this.status }
  }

  // Update status helper
  protected updateStatus(newStatus: Partial<ConnectionStatus>): void {
    this.status = { ...this.status, ...newStatus }
  }
} 