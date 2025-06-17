import { supabase } from '../lib/supabase'
import { 
  MessagingProviderFactory, 
  ProviderManager,
  type ProviderType,
  type MessageData,
  type SendMessageOptions 
} from './messagingProviders'
import type { WhatsAppIntegration, ExternalIntegration } from '../types'

export class IntegrationService {
  // WhatsApp Integration Methods
  async getWhatsAppIntegrations(userId: string): Promise<WhatsAppIntegration[]> {
    const { data, error } = await supabase
      .from('whatsapp_integrations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  async createWhatsAppIntegration(
    integration: Omit<WhatsAppIntegration, 'id' | 'created_at' | 'updated_at'>
  ): Promise<WhatsAppIntegration> {
    const { data, error } = await supabase
      .from('whatsapp_integrations')
      .insert(integration)
      .select()
      .single()

    if (error) throw error

    // Initialize WhatsApp connection (will be implemented in Phase 4)
    try {
      await supabase.functions.invoke('whatsapp-connect', {
        body: { integration_id: data.id }
      })
    } catch (connectError) {
      console.warn('WhatsApp connection failed to start:', connectError)
    }

    return data
  }

  async updateWhatsAppIntegration(
    integrationId: string,
    updates: Partial<WhatsAppIntegration>
  ): Promise<WhatsAppIntegration> {
    const { data, error } = await supabase
      .from('whatsapp_integrations')
      .update(updates)
      .eq('id', integrationId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteWhatsAppIntegration(integrationId: string): Promise<void> {
    // Disconnect first if connected
    try {
      await supabase.functions.invoke('whatsapp-disconnect', {
        body: { integration_id: integrationId }
      })
    } catch (disconnectError) {
      console.warn('WhatsApp disconnection failed:', disconnectError)
    }

    const { error } = await supabase
      .from('whatsapp_integrations')
      .delete()
      .eq('id', integrationId)

    if (error) throw error
  }

  async connectWhatsApp(integrationId: string): Promise<WhatsAppIntegration> {
    const integration = await this.updateWhatsAppIntegration(integrationId, {
      status: 'connecting'
    })

    try {
      await supabase.functions.invoke('whatsapp-connect', {
        body: { integration_id: integrationId }
      })
    } catch (error) {
      await this.updateWhatsAppIntegration(integrationId, {
        status: 'error'
      })
      throw error
    }

    return integration
  }

  async disconnectWhatsApp(integrationId: string): Promise<WhatsAppIntegration> {
    try {
      await supabase.functions.invoke('whatsapp-disconnect', {
        body: { integration_id: integrationId }
      })
    } catch (error) {
      console.warn('WhatsApp disconnection failed:', error)
    }

    return this.updateWhatsAppIntegration(integrationId, {
      status: 'disconnected'
    })
  }

  async getWhatsAppQRCode(integrationId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('whatsapp_integrations')
      .select('qr_code')
      .eq('id', integrationId)
      .single()

    if (error) return null
    return data.qr_code
  }

  // External Integration Methods
  async getExternalIntegrations(userId: string): Promise<ExternalIntegration[]> {
    const { data, error } = await supabase
      .from('external_integrations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  async createExternalIntegration(
    integration: Omit<ExternalIntegration, 'id' | 'created_at' | 'updated_at'>
  ): Promise<ExternalIntegration> {
    const { data, error } = await supabase
      .from('external_integrations')
      .insert(integration)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async updateExternalIntegration(
    integrationId: string,
    updates: Partial<ExternalIntegration>
  ): Promise<ExternalIntegration> {
    const { data, error } = await supabase
      .from('external_integrations')
      .update(updates)
      .eq('id', integrationId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteExternalIntegration(integrationId: string): Promise<void> {
    const { error } = await supabase
      .from('external_integrations')
      .delete()
      .eq('id', integrationId)

    if (error) throw error
  }

  // Specific External Integration Types
  async createWhatWutIntegration(
    userId: string,
    name: string,
    apiKey: string,
    webhookUrl: string
  ): Promise<ExternalIntegration> {
    return this.createExternalIntegration({
      user_id: userId,
      name,
      integration_type: 'whatwut',
      api_key: apiKey,
      webhook_url: webhookUrl,
      settings: {},
      is_active: true
    })
  }

  async testExternalIntegration(integrationId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('test-integration', {
        body: { integration_id: integrationId }
      })

      if (error) return false
      return data.success || false
    } catch (error) {
      console.error('Error testing external integration:', error)
      return false
    }
  }

  async toggleExternalIntegration(
    integrationId: string,
    isActive: boolean
  ): Promise<ExternalIntegration> {
    return this.updateExternalIntegration(integrationId, { is_active: isActive })
  }

  async getActiveExternalIntegrations(userId: string): Promise<ExternalIntegration[]> {
    const { data, error } = await supabase
      .from('external_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  async getIntegrationsByType(
    userId: string,
    integrationType: string
  ): Promise<ExternalIntegration[]> {
    const { data, error } = await supabase
      .from('external_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('integration_type', integrationType)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  // Webhook URL generation for external services
  generateWebhookUrl(userId: string, integrationType: string): string {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.wacanda.com'
    return `${baseUrl}/webhooks/${integrationType}/${userId}`
  }

  // Integration health check
  async getIntegrationStatus(userId: string): Promise<{
    whatsapp: { total: number; connected: number; error: number }
    external: { total: number; active: number; inactive: number }
  }> {
    const [whatsappIntegrations, externalIntegrations] = await Promise.all([
      this.getWhatsAppIntegrations(userId),
      this.getExternalIntegrations(userId)
    ])

    return {
      whatsapp: {
        total: whatsappIntegrations.length,
        connected: whatsappIntegrations.filter(i => i.status === 'connected').length,
        error: whatsappIntegrations.filter(i => i.status === 'error').length
      },
      external: {
        total: externalIntegrations.length,
        active: externalIntegrations.filter(i => i.is_active).length,
        inactive: externalIntegrations.filter(i => !i.is_active).length
      }
    }
  }

  // Real-time subscription for integration updates
  subscribeToIntegrations(userId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`integrations_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_integrations',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'external_integrations',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe()
  }

  // Messaging Provider Integration Methods
  
  /**
   * Create a messaging provider instance for an integration
   */
  async createMessagingProvider(integration: WhatsAppIntegration | ExternalIntegration) {
    try {
      // Handle different integration types
      const integrationData = 'integration_type' in integration 
        ? {
            integration_type: integration.integration_type,
            api_key: integration.api_key,
            webhook_url: integration.webhook_url,
            settings: integration.settings
          }
        : {
            integration_type: 'whatsapp',
            api_key: integration.credentials?.accessToken,
            webhook_url: undefined,
            settings: {
              phoneNumber: integration.phone_number,
              instanceKey: integration.instance_key,
              connectionType: integration.connection_type,
              ...integration.credentials,
              ...integration.settings
            }
          }

      const { providerType, config } = MessagingProviderFactory.createConfigFromIntegration(integrationData)

      const provider = MessagingProviderFactory.createProvider(
        providerType,
        config,
        integration.id
      )

      return provider
    } catch (error) {
      console.error('Failed to create messaging provider:', error)
      throw error
    }
  }

  /**
   * Send a message through a messaging provider
   */
  async sendMessage(
    integrationId: string, 
    options: SendMessageOptions
  ): Promise<boolean> {
    try {
      const provider = MessagingProviderFactory.getProvider(integrationId)
      if (!provider) {
        throw new Error('Messaging provider not found')
      }

      return await provider.sendMessage(options)
    } catch (error) {
      console.error('Failed to send message:', error)
      return false
    }
  }

  /**
   * Get messaging provider status
   */
  async getProviderStatus(integrationId: string) {
    try {
      const provider = MessagingProviderFactory.getProvider(integrationId)
      if (!provider) {
        return { status: 'disconnected', message: 'Provider not found' }
      }

      return await provider.getStatus()
    } catch (error) {
      console.error('Failed to get provider status:', error)
      return { 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Status check failed' 
      }
    }
  }

  /**
   * Connect a messaging provider
   */
  async connectProvider(integration: WhatsAppIntegration | ExternalIntegration) {
    try {
      const provider = await this.createMessagingProvider(integration)
      return await provider.connect()
    } catch (error) {
      console.error('Failed to connect provider:', error)
      return { 
        status: 'error' as const, 
        message: error instanceof Error ? error.message : 'Connection failed' 
      }
    }
  }

  /**
   * Disconnect a messaging provider
   */
  async disconnectProvider(integrationId: string): Promise<void> {
    try {
      const provider = MessagingProviderFactory.getProvider(integrationId)
      if (provider) {
        await provider.disconnect()
      }
      MessagingProviderFactory.removeProvider(integrationId)
    } catch (error) {
      console.error('Failed to disconnect provider:', error)
    }
  }

  /**
   * Process webhook data through messaging provider
   */
  async processWebhook(
    integrationId: string, 
    webhookData: any
  ): Promise<MessageData | null> {
    try {
      const provider = MessagingProviderFactory.getProvider(integrationId)
      if (!provider) {
        console.error('Messaging provider not found for webhook processing')
        return null
      }

      return await provider.processWebhook(webhookData)
    } catch (error) {
      console.error('Failed to process webhook:', error)
      return null
    }
  }

  /**
   * Get all active provider statuses
   */
  async getAllProviderStatuses(): Promise<Map<string, any>> {
    return await ProviderManager.getAllProviderStatuses()
  }

  /**
   * Disconnect all providers
   */
  async disconnectAllProviders(): Promise<void> {
    await ProviderManager.disconnectAll()
  }
}

export const integrationService = new IntegrationService() 