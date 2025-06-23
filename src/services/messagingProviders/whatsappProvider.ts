import { BaseMessagingProvider } from './baseProvider'
import type { 
  ConnectionConfig, 
  ConnectionStatus, 
  SendMessageOptions, 
  WebhookData, 
  MessageData 
} from './baseProvider'

export interface WhatsAppCloudCredentials {
  accessToken: string
  phoneNumberId: string
  businessAccountId: string
  webhookSecret?: string
}

export interface WhatsAppBaileysCredentials {
  instanceKey: string
  sessionPath?: string
}

export class WhatsAppProvider extends BaseMessagingProvider {
  private readonly baseUrl = 'https://graph.facebook.com/v18.0'

  constructor(config: ConnectionConfig) {
    super(config)
  }

  async connect(): Promise<ConnectionStatus> {
    try {
      this.updateStatus({ status: 'connecting' })

      if (this.config.type === 'api') {
        return await this.connectCloudAPI()
      } else if (this.config.type === 'web') {
        return await this.connectBaileys()
      } else {
        throw new Error(`Unsupported WhatsApp connection type: ${this.config.type}`)
      }
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
    try {
      if (this.config.type === 'web') {
        await this.disconnectBaileys()
      }
      this.updateStatus({ 
        status: 'disconnected',
        message: 'Disconnected successfully',
        qrCode: undefined 
      })
    } catch (error) {
      this.updateStatus({ 
        status: 'error',
        message: error instanceof Error ? error.message : 'Disconnect failed'
      })
    }
  }

  async sendMessage(options: SendMessageOptions): Promise<boolean> {
    try {
      if (!this.validateMessage(options.message)) {
        throw new Error('Invalid message content')
      }

      const normalizedTo = this.normalizePhoneNumber(options.to)

      if (this.config.type === 'api') {
        return await this.sendCloudAPIMessage(normalizedTo, options)
      } else if (this.config.type === 'web') {
        return await this.sendBaileysMessage(normalizedTo, options)
      } else {
        throw new Error(`Unsupported send method for type: ${this.config.type}`)
      }
    } catch (error) {
      console.error('WhatsApp send message error:', error)
      return false
    }
  }

  async getStatus(): Promise<ConnectionStatus> {
    try {
      if (this.config.type === 'api') {
        return await this.getCloudAPIStatus()
      } else if (this.config.type === 'web') {
        return await this.getBaileysStatus()
      } else {
        return this.getCurrentStatus()
      }
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Status check failed'
      }
    }
  }

  async processWebhook(data: WebhookData): Promise<MessageData | null> {
    try {
      if (this.config.type === 'api') {
        return this.processCloudAPIWebhook(data)
      } else if (this.config.type === 'web') {
        return this.processBaileysWebhook(data)
      } else {
        throw new Error(`Unsupported webhook processing for type: ${this.config.type}`)
      }
    } catch (error) {
      console.error('WhatsApp webhook processing error:', error)
      return null
    }
  }

  // Cloud API specific methods
  private async connectCloudAPI(): Promise<ConnectionStatus> {
    const credentials = this.config.credentials as WhatsAppCloudCredentials
    
    if (!credentials.accessToken || !credentials.phoneNumberId) {
      throw new Error('Missing required Cloud API credentials')
    }

    // Test the connection by getting phone number info
    const response = await fetch(
      `${this.baseUrl}/${credentials.phoneNumberId}`,
      {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Cloud API connection failed: ${error}`)
    }

    const phoneInfo = await response.json()
    const status: ConnectionStatus = {
      status: 'connected',
      message: 'Connected to WhatsApp Cloud API',
      lastConnected: new Date(),
      metadata: {
        phoneNumber: phoneInfo.display_phone_number,
        verifiedName: phoneInfo.verified_name
      }
    }

    this.updateStatus(status)
    return status
  }

  private async sendCloudAPIMessage(to: string, options: SendMessageOptions): Promise<boolean> {
    const credentials = this.config.credentials as WhatsAppCloudCredentials
    
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: {
        body: options.message
      }
    }

    const response = await fetch(
      `${this.baseUrl}/${credentials.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    )

    return response.ok
  }

  private async getCloudAPIStatus(): Promise<ConnectionStatus> {
    const credentials = this.config.credentials as WhatsAppCloudCredentials
    
    try {
      const response = await fetch(
        `${this.baseUrl}/${credentials.phoneNumberId}`,
        {
          headers: {
            'Authorization': `Bearer ${credentials.accessToken}`
          }
        }
      )

      if (response.ok) {
        const status: ConnectionStatus = {
          status: 'connected',
          message: 'Cloud API connection active',
          lastConnected: new Date()
        }
        this.updateStatus(status)
        return status
      } else {
        const status: ConnectionStatus = {
          status: 'error',
          message: 'Cloud API connection lost'
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

  private processCloudAPIWebhook(data: WebhookData): MessageData | null {
    // Process WhatsApp Cloud API webhook format
    if (!data.message) return null

    const message = data.message
    return {
      from: this.normalizePhoneNumber(message.from),
      to: message.to,
      body: message.body,
      timestamp: message.timestamp,
      messageId: message.messageId,
      type: message.type,
      mediaUrl: message.mediaUrl,
      metadata: {
        provider: 'whatsapp-cloud',
        instanceKey: data.instanceKey,
        ...message.metadata
      }
    }
  }

  // Baileys (WhatsApp Web) specific methods
  private async connectBaileys(): Promise<ConnectionStatus> {
    // This would integrate with Baileys library
    // For now, simulate the connection process
    
    const credentials = this.config.credentials as WhatsAppBaileysCredentials
    
    if (!credentials.instanceKey) {
      throw new Error('Missing instance key for Baileys connection')
    }

    // In a real implementation, this would:
    // 1. Initialize Baileys connection
    // 2. Generate QR code if needed
    // 3. Handle connection events
    
    const status: ConnectionStatus = {
      status: 'connecting',
      message: 'Generating QR code for WhatsApp Web',
      qrCode: await this.generateMockQRCode(),
      metadata: {
        instanceKey: credentials.instanceKey
      }
    }

    this.updateStatus(status)
    return status
  }

  private async disconnectBaileys(): Promise<void> {
    // In a real implementation, this would properly close the Baileys connection
  }

  private async sendBaileysMessage(to: string, options: SendMessageOptions): Promise<boolean> {
    // In a real implementation, this would send through Baileys
    return true
  }

  private async getBaileysStatus(): Promise<ConnectionStatus> {
    // In a real implementation, this would check actual Baileys connection status
    return this.getCurrentStatus()
  }

  private processBaileysWebhook(data: WebhookData): MessageData | null {
    // Process Baileys webhook format
    if (!data.message) return null

    const message = data.message
    return {
      from: this.normalizePhoneNumber(message.from),
      to: message.to,
      body: message.body,
      timestamp: message.timestamp,
      messageId: message.messageId,
      type: message.type,
      mediaUrl: message.mediaUrl,
      metadata: {
        provider: 'whatsapp-baileys',
        instanceKey: data.instanceKey,
        ...message.metadata
      }
    }
  }

  private async generateMockQRCode(): Promise<string> {
    // In a real implementation, this would generate an actual QR code
    // For now, return a placeholder
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="white"/>
        <text x="100" y="100" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="16">
          QR Code Placeholder
        </text>
      </svg>
    `)}`
  }

  // Utility method to normalize WhatsApp phone numbers
  protected normalizePhoneNumber(phone: string): string {
    const cleaned = phone.replace(/[^\d+]/g, '')
    
    // WhatsApp uses phone numbers without + in their API
    if (this.config.type === 'api') {
      return cleaned.startsWith('+') ? cleaned.substring(1) : cleaned
    }
    
    // For other methods, keep the + prefix
    return cleaned.startsWith('+') ? cleaned : `+${cleaned}`
  }
} 