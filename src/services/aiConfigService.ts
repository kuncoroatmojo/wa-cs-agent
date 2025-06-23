import { supabase } from '../lib/supabase'
import type { AIConfiguration } from '../types'

export class AIConfigService {
  async getConfigurations(userId: string): Promise<AIConfiguration[]> {
    const { data, error } = await supabase
      .from('ai_configurations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  async getActiveConfiguration(userId: string): Promise<AIConfiguration | null> {
    const { data, error } = await supabase
      .from('ai_configurations')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return null
      }
      throw error
    }

    return data
  }

  async createConfiguration(
    config: Omit<AIConfiguration, 'id' | 'created_at' | 'updated_at'>
  ): Promise<AIConfiguration> {
    // If this config is being set as active, deactivate others
    if (config.is_active) {
      await this.deactivateAllConfigurations(config.user_id)
    }

    const { data, error } = await supabase
      .from('ai_configurations')
      .insert(config)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async updateConfiguration(
    configId: string,
    updates: Partial<AIConfiguration>
  ): Promise<AIConfiguration> {
    // If activating this config, deactivate others first
    if (updates.is_active) {
      const currentConfig = await supabase
        .from('ai_configurations')
        .select('user_id')
        .eq('id', configId)
        .single()

      if (currentConfig.data) {
        await this.deactivateAllConfigurations(currentConfig.data.user_id)
      }
    }

    const { data, error } = await supabase
      .from('ai_configurations')
      .update(updates)
      .eq('id', configId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteConfiguration(configId: string): Promise<void> {
    const { error } = await supabase
      .from('ai_configurations')
      .delete()
      .eq('id', configId)

    if (error) throw error
  }

  async setActiveConfiguration(configId: string): Promise<AIConfiguration> {
    // Get the config to find user_id
    const { data: config, error: fetchError } = await supabase
      .from('ai_configurations')
      .select('user_id')
      .eq('id', configId)
      .single()

    if (fetchError) throw fetchError

    // Deactivate all other configs for this user
    await this.deactivateAllConfigurations(config.user_id)

    // Activate this config
    return this.updateConfiguration(configId, { is_active: true })
  }

  private async deactivateAllConfigurations(userId: string): Promise<void> {
    const { error } = await supabase
      .from('ai_configurations')
      .update({ is_active: false })
      .eq('user_id', userId)

    if (error) throw error
  }

  async duplicateConfiguration(configId: string, newName: string): Promise<AIConfiguration> {
    const { data: originalConfig, error } = await supabase
      .from('ai_configurations')
      .select('*')
      .eq('id', configId)
      .single()

    if (error) throw error

    const duplicatedConfig = {
      ...originalConfig,
      name: newName,
      is_active: false // Duplicated configs should not be active by default
    }

    // Remove id and timestamps
    delete (duplicatedConfig as any).id
    delete (duplicatedConfig as any).created_at
    delete (duplicatedConfig as any).updated_at

    return this.createConfiguration(duplicatedConfig)
  }

  async testConfiguration(config: AIConfiguration): Promise<boolean> {
    try {
      // This would test the AI configuration by making a simple API call
      // For now, we'll just validate the structure
      const requiredFields = ['provider', 'api_key', 'model_name']
      for (const field of requiredFields) {
        if (!config[field as keyof AIConfiguration]) {
          return false
        }
      }

      // TODO: In Phase 2, implement actual API testing
      // const testResult = await supabase.functions.invoke('test-ai-config', {
      //   body: { config }
      // })

      return true
    } catch (error) { 
      console.error('Error testing AI configuration:', error)
      return false
    }
  }

  async getConfigurationsByProvider(userId: string, provider: string): Promise<AIConfiguration[]> {
    const { data, error } = await supabase
      .from('ai_configurations')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', provider)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  async getDefaultConfiguration(userId: string): Promise<AIConfiguration | null> {
    // First try to get the active configuration
    let config = await this.getActiveConfiguration(userId)
    
    if (!config) {
      // If no active config, get the first one
      const configs = await this.getConfigurations(userId)
      config = configs[0] || null
    }

    return config
  }

  async ensureActiveConfiguration(userId: string): Promise<AIConfiguration> {
    let config = await this.getActiveConfiguration(userId)
    
    if (!config) {
      // Create a default configuration if none exists
      config = await this.createConfiguration({
        user_id: userId,
        name: 'Default Configuration',
        provider: 'openai',
        api_key: '', // User will need to set this
        model_name: 'gpt-4o',
        temperature: 0.7,
        max_tokens: 1000,
        is_active: true
      })
    }

    return config
  }
}

export const aiConfigService = new AIConfigService() 