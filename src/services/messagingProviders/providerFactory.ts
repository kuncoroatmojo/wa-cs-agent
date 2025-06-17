import { BaseMessagingProvider } from './baseProvider'
import { WhatsAppProvider } from './whatsappProvider'
import { WhatWutProvider } from './whatwutProvider'
import type { ConnectionConfig } from './baseProvider'

export type ProviderType = 'whatsapp' | 'whatwut' | 'telegram' | 'custom'

export interface ProviderTemplate {
  type: ProviderType
  name: string
  description: string
  supportedConnectionTypes: ('api' | 'web' | 'webhook')[]
  requiredCredentials: string[]
  optionalCredentials: string[]
}

export const PROVIDER_TEMPLATES: Record<ProviderType, ProviderTemplate> = {
  whatsapp: {
    type: 'whatsapp',
    name: 'WhatsApp',
    description: 'WhatsApp Business API and WhatsApp Web integration',
    supportedConnectionTypes: ['api', 'web'],
    requiredCredentials: ['accessToken', 'phoneNumberId'], // for Cloud API
    optionalCredentials: ['businessAccountId', 'webhookSecret', 'instanceKey'] // instanceKey for Baileys
  },
  whatwut: {
    type: 'whatwut',
    name: 'WhatWut',
    description: 'WhatWut platform integration for WhatsApp messaging',
    supportedConnectionTypes: ['api', 'webhook'],
    requiredCredentials: ['apiKey', 'instanceId'],
    optionalCredentials: ['baseUrl', 'webhookSecret']
  },
  telegram: {
    type: 'telegram',
    name: 'Telegram',
    description: 'Telegram Bot API integration',
    supportedConnectionTypes: ['api', 'webhook'],
    requiredCredentials: ['botToken'],
    optionalCredentials: ['webhookUrl', 'webhookSecret']
  },
  custom: {
    type: 'custom',
    name: 'Custom Provider',
    description: 'Generic integration for custom messaging APIs',
    supportedConnectionTypes: ['api', 'webhook'],
    requiredCredentials: ['apiKey'],
    optionalCredentials: ['baseUrl', 'webhookUrl', 'webhookSecret']
  }
}

export class MessagingProviderFactory {
  private static instances = new Map<string, BaseMessagingProvider>()

  /**
   * Create a messaging provider instance
   */
  static createProvider(
    providerType: ProviderType, 
    config: ConnectionConfig,
    instanceId?: string
  ): BaseMessagingProvider {
    // Create a cache key for the instance
    const cacheKey = instanceId || `${providerType}-${JSON.stringify(config)}`
    
    // Return existing instance if available
    if (this.instances.has(cacheKey)) {
      return this.instances.get(cacheKey)!
    }

    let provider: BaseMessagingProvider

    switch (providerType) {
      case 'whatsapp':
        provider = new WhatsAppProvider(config)
        break
      case 'whatwut':
        provider = new WhatWutProvider(config)
        break
      case 'telegram':
        provider = this.createTelegramProvider(config)
        break
      case 'custom':
        provider = this.createCustomProvider(config)
        break
      default:
        throw new Error(`Unsupported provider type: ${providerType}`)
    }

    // Cache the instance
    this.instances.set(cacheKey, provider)
    
    return provider
  }

  /**
   * Get existing provider instance
   */
  static getProvider(instanceId: string): BaseMessagingProvider | null {
    return this.instances.get(instanceId) || null
  }

  /**
   * Remove provider instance from cache
   */
  static removeProvider(instanceId: string): void {
    const provider = this.instances.get(instanceId)
    if (provider) {
      // Disconnect before removing
      provider.disconnect().catch(console.error)
      this.instances.delete(instanceId)
    }
  }

  /**
   * Clear all provider instances
   */
  static clearAll(): void {
    this.instances.forEach((provider) => {
      provider.disconnect().catch(console.error)
    })
    this.instances.clear()
  }

  /**
   * Get available provider templates
   */
  static getProviderTemplates(): ProviderTemplate[] {
    return Object.values(PROVIDER_TEMPLATES)
  }

  /**
   * Get template for specific provider type
   */
  static getProviderTemplate(providerType: ProviderType): ProviderTemplate {
    const template = PROVIDER_TEMPLATES[providerType]
    if (!template) {
      throw new Error(`No template found for provider type: ${providerType}`)
    }
    return template
  }

  /**
   * Validate provider configuration
   */
  static validateProviderConfig(
    providerType: ProviderType, 
    config: ConnectionConfig
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = []
    const template = this.getProviderTemplate(providerType)

    // Check if connection type is supported
    if (!template.supportedConnectionTypes.includes(config.type)) {
      errors.push(`Connection type '${config.type}' is not supported for ${template.name}`)
    }

    // Check required credentials
    template.requiredCredentials.forEach(credential => {
      if (!config.credentials[credential]) {
        errors.push(`Missing required credential: ${credential}`)
      }
    })

    // Validate credential types
    if (typeof config.credentials !== 'object') {
      errors.push('Credentials must be an object')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Create provider configuration from integration data
   */
  static createConfigFromIntegration(integration: {
    integration_type: string
    api_key?: string
    webhook_url?: string
    settings?: Record<string, any>
  }): { providerType: ProviderType; config: ConnectionConfig } {
    const providerType = integration.integration_type as ProviderType
    
    if (!PROVIDER_TEMPLATES[providerType]) {
      throw new Error(`Unknown integration type: ${integration.integration_type}`)
    }

    const credentials: Record<string, any> = {
      ...(integration.api_key && { apiKey: integration.api_key }),
      ...(integration.webhook_url && { webhookUrl: integration.webhook_url }),
      ...integration.settings
    }

    // Provider-specific credential mapping
    if (providerType === 'whatsapp') {
      // Map common fields to WhatsApp-specific fields
      if (credentials.accessToken || credentials.access_token) {
        credentials.accessToken = credentials.accessToken || credentials.access_token
      }
      if (credentials.phoneNumberId || credentials.phone_number_id) {
        credentials.phoneNumberId = credentials.phoneNumberId || credentials.phone_number_id
      }
    }

    const config: ConnectionConfig = {
      type: integration.webhook_url ? 'webhook' : 'api',
      credentials,
      settings: integration.settings
    }

    return { providerType, config }
  }

  // Create Telegram provider (placeholder for future implementation)
  private static createTelegramProvider(config: ConnectionConfig): BaseMessagingProvider {
    // For now, return a basic implementation
    // This would be replaced with a proper TelegramProvider class
    return new (class TelegramProvider extends BaseMessagingProvider {
      async connect() {
        return { status: 'connected' as const, message: 'Telegram provider not implemented' }
      }
      async disconnect() {
        // Implementation placeholder
      }
      async sendMessage() {
        return false
      }
      async getStatus() {
        return { status: 'disconnected' as const }
      }
      async processWebhook() {
        return null
      }
    })(config)
  }

  // Create custom provider (placeholder for future implementation)
  private static createCustomProvider(config: ConnectionConfig): BaseMessagingProvider {
    // For now, return a basic implementation
    // This would be replaced with a proper CustomProvider class
    return new (class CustomProvider extends BaseMessagingProvider {
      async connect() {
        return { status: 'connected' as const, message: 'Custom provider not implemented' }
      }
      async disconnect() {
        // Implementation placeholder
      }
      async sendMessage() {
        return false
      }
      async getStatus() {
        return { status: 'disconnected' as const }
      }
      async processWebhook() {
        return null
      }
    })(config)
  }
}

// Utility functions for provider management
export class ProviderManager {
  /**
   * Get all active providers
   */
  static getActiveProviders(): Map<string, BaseMessagingProvider> {
    return new Map(MessagingProviderFactory['instances'])
  }

  /**
   * Get provider status for all active providers
   */
  static async getAllProviderStatuses(): Promise<Map<string, any>> {
    const statuses = new Map()
    const providers = this.getActiveProviders()
    
    for (const [instanceId, provider] of providers) {
      try {
        const status = await provider.getStatus()
        statuses.set(instanceId, status)
      } catch (error) {
        statuses.set(instanceId, {
          status: 'error',
          message: error instanceof Error ? error.message : 'Status check failed'
        })
      }
    }
    
    return statuses
  }

  /**
   * Disconnect all providers
   */
  static async disconnectAll(): Promise<void> {
    const providers = this.getActiveProviders()
    const disconnectPromises = Array.from(providers.values()).map(provider => 
      provider.disconnect().catch(console.error)
    )
    
    await Promise.allSettled(disconnectPromises)
    MessagingProviderFactory.clearAll()
  }
} 