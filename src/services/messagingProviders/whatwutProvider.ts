import { BaseMessagingProvider } from './baseProvider'
import type { 
  ConnectionConfig, 
  ConnectionStatus, 
  SendMessageOptions, 
  WebhookData, 
  MessageData 
} from './baseProvider'

export interface WhatWutCredentials {
  apiKey: string
  instanceId: string
  baseUrl?: string
  webhookSecret?: string
}

export class WhatWutProvider extends BaseMessagingProvider {
  private readonly defaultBaseUrl = 'https://api.whatwut.com/v1'

  constructor(config: ConnectionConfig) {
    super(config)
  }

  async connect(): Promise<ConnectionStatus> {
    try {
      this.updateStatus({ status: 'connecting' })

      const credentials = this.config.credentials as WhatWutCredentials
      
      if (!credentials.apiKey || !credentials.instanceId) {
        throw new Error('Missing required WhatWut credentials')
      }

      // Test the connection
      const baseUrl = credentials.baseUrl || this.defaultBaseUrl
      const response = await fetch(`${baseUrl}/instances/${credentials.instanceId}/status`, {
        headers: {
          'Authorization': `Bearer ${credentials.apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`WhatWut connection failed: ${error}`)
      }

      const instanceData = await response.json()
      const status: ConnectionStatus = {
        status: 'connected',
        message: 'Connected to WhatWut API',
        lastConnected: new Date(),
        metadata: {
          instanceId: credentials.instanceId,
          instanceName: instanceData.name,
          webhookUrl: instanceData.webhook_url
        }
      }

      this.updateStatus(status)
      return status
    } catch (error) {
      const errorStatus: ConnectionStatus = {
        status: 'error',
        message: error instanceof Error ? error.message : 'Connection failed'
      }
      this.updateStatus(errorStatus)
      return errorStatus
    }
  }

  async disconnect(): Promise<void> {
    this.updateStatus({ 
      status: 'disconnected',
      message: 'Disconnected from WhatWut',
      qrCode: undefined 
    })
  }

  async sendMessage(options: SendMessageOptions): Promise<boolean> {
    try {
      if (!this.validateMessage(options.message)) {
        throw new Error('Invalid message content')
      }

      const credentials = this.config.credentials as WhatWutCredentials
      const baseUrl = credentials.baseUrl || this.defaultBaseUrl
      const normalizedTo = this.normalizePhoneNumber(options.to)

      const payload = {
        to: normalizedTo,
        message: options.message,
        type: options.type || 'text',
        ...(options.mediaUrl && { media_url: options.mediaUrl }),
        ...(options.metadata && { metadata: options.metadata })
      }

      const response = await fetch(
        `${baseUrl}/instances/${credentials.instanceId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${credentials.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      )

      if (!response.ok) {
        console.error('WhatWut send message failed:', await response.text())
        return false
      }

      return true
    } catch (error) {
      console.error('WhatWut send message error:', error)
      return false
    }
  }

  async getStatus(): Promise<ConnectionStatus> {
    try {
      const credentials = this.config.credentials as WhatWutCredentials
      const baseUrl = credentials.baseUrl || this.defaultBaseUrl
      
      const response = await fetch(
        `${baseUrl}/instances/${credentials.instanceId}/status`,
        {
          headers: {
            'Authorization': `Bearer ${credentials.apiKey}`
          }
        }
      )

      if (response.ok) {
        const instanceData = await response.json()
        const status: ConnectionStatus = {
          status: instanceData.connected ? 'connected' : 'disconnected',
          message: instanceData.status_message || 'Status check successful',
          lastConnected: instanceData.last_seen ? new Date(instanceData.last_seen) : undefined,
          metadata: {
            instanceId: credentials.instanceId,
            qrCodeNeeded: instanceData.qr_code_needed,
            batteryLevel: instanceData.battery_level,
            phoneNumber: instanceData.phone_number
          }
        }
        this.updateStatus(status)
        return status
      } else {
        const status: ConnectionStatus = {
          status: 'error',
          message: 'Failed to get WhatWut status'
        }
        this.updateStatus(status)
        return status
      }
    } catch (error) {
      const status: ConnectionStatus = {
        status: 'error',
        message: error instanceof Error ? error.message : 'Status check failed'
      }
      this.updateStatus(status)
      return status
    }
  }

  async processWebhook(data: WebhookData): Promise<MessageData | null> {
    try {
      // Process WhatWut webhook format
      if (!data.message && !data.event) return null

      // Handle incoming message events
      if (data.message) {
        const message = data.message
        return {
          from: this.normalizePhoneNumber(message.from),
          to: message.to,
          body: message.body,
          timestamp: message.timestamp,
          messageId: message.messageId || this.generateMessageId(),
          type: message.type,
          mediaUrl: message.mediaUrl,
          metadata: {
            provider: 'whatwut',
            instanceKey: data.instanceKey,
            ...message.metadata
          }
        }
      }

      // Handle other event types (status updates, etc.)
      if (data.event) {
        console.log('WhatWut event received:', data.event.type, data.event.data)
        
        // Update connection status based on events
        if (data.event.type === 'connection_status') {
          const eventData = data.event.data
          this.updateStatus({
            status: eventData.connected ? 'connected' : 'disconnected',
            message: eventData.message
          })
        }
      }

      return null
    } catch (error) {
      console.error('WhatWut webhook processing error:', error)
      return null
    }
  }

  // WhatWut-specific utility methods
  async generateQRCode(): Promise<string | null> {
    try {
      const credentials = this.config.credentials as WhatWutCredentials
      const baseUrl = credentials.baseUrl || this.defaultBaseUrl
      
      const response = await fetch(
        `${baseUrl}/instances/${credentials.instanceId}/qr`,
        {
          headers: {
            'Authorization': `Bearer ${credentials.apiKey}`
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        return data.qr_code
      }

      return null
    } catch (error) {
      console.error('Failed to generate QR code:', error)
      return null
    }
  }

  async getWebhookUrl(): Promise<string | null> {
    try {
      const credentials = this.config.credentials as WhatWutCredentials
      const baseUrl = credentials.baseUrl || this.defaultBaseUrl
      
      const response = await fetch(
        `${baseUrl}/instances/${credentials.instanceId}/webhook`,
        {
          headers: {
            'Authorization': `Bearer ${credentials.apiKey}`
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        return data.webhook_url
      }

      return null
    } catch (error) {
      console.error('Failed to get webhook URL:', error)
      return null
    }
  }

  async setWebhookUrl(webhookUrl: string): Promise<boolean> {
    try {
      const credentials = this.config.credentials as WhatWutCredentials
      const baseUrl = credentials.baseUrl || this.defaultBaseUrl
      
      const response = await fetch(
        `${baseUrl}/instances/${credentials.instanceId}/webhook`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${credentials.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ webhook_url: webhookUrl })
        }
      )

      return response.ok
    } catch (error) {
      console.error('Failed to set webhook URL:', error)
      return false
    }
  }

  // Override phone number normalization for WhatWut format
  protected normalizePhoneNumber(phone: string): string {
    const cleaned = phone.replace(/[^\d+]/g, '')
    
    // WhatWut typically expects numbers with country code but without +
    if (cleaned.startsWith('+')) {
      return cleaned.substring(1)
    }
    
    // If no country code, you might want to add a default one
    // This depends on your specific WhatWut configuration
    return cleaned
  }
} 