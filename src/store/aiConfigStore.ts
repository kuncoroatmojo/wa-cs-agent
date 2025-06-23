import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { AIConfiguration } from '../types'
import { supabase } from '../lib/supabase'

interface AIConfigState {
  configurations: AIConfiguration[]
  activeConfig: AIConfiguration | null
  loading: boolean
  error: string | null
  
  // Actions
  fetchConfigurations: () => Promise<void>
  createConfiguration: (config: Omit<AIConfiguration, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>
  updateConfiguration: (id: string, updates: Partial<AIConfiguration>) => Promise<void>
  deleteConfiguration: (id: string) => Promise<void>
  setActiveConfiguration: (id: string) => Promise<void>
  testConfiguration: (config: Partial<AIConfiguration>) => Promise<boolean>
  clearError: () => void
}

export const useAIConfigStore = create<AIConfigState>()(
  devtools(
    (set, get) => ({
      // Initial state
      configurations: [],
      activeConfig: null,
      loading: false,
      error: null,

      // Fetch all AI configurations
      fetchConfigurations: async () => {
        try {
          set({ loading: true, error: null })
          
          const { data, error } = await supabase
            .from('ai_configurations')
            .select('*')
            .eq('user_id', 'current-user-id') // Replace with actual user ID
            .order('created_at', { ascending: false })

          if (error) throw error

          const configurations = data || []
          const activeConfig = configurations.find(config => config.is_active) || null

          set({ 
            configurations,
            activeConfig,
            loading: false 
          })
        } catch { // Ignored 
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch configurations',
            loading: false
          })
        }
      },

      // Create new AI configuration
      createConfiguration: async (configData) => {
        try {
          set({ loading: true, error: null })
          
          const { data, error } = await supabase
            .from('ai_configurations')
            .insert({
              ...configData,
              user_id: 'current-user-id', // Replace with actual user ID
            })
            .select()
            .single()

          if (error) throw error

          const { configurations } = get()
          set({
            configurations: [data, ...configurations],
            loading: false
          })

          // If this is the first configuration, make it active
          if (configurations.length === 0) {
            await get().setActiveConfiguration(data.id)
          }
        } catch { // Ignored 
          set({
            error: error instanceof Error ? error.message : 'Failed to create configuration',
            loading: false
          })
        }
      },

      // Update AI configuration
      updateConfiguration: async (id: string, updates) => {
        try {
          set({ loading: true, error: null })
          
          const { data, error } = await supabase
            .from('ai_configurations')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

          if (error) throw error

          const { configurations, activeConfig } = get()
          const updatedConfigurations = configurations.map(config => 
            config.id === id ? data : config
          )

          set({
            configurations: updatedConfigurations,
            activeConfig: activeConfig?.id === id ? data : activeConfig,
            loading: false
          })
        } catch { // Ignored 
          set({
            error: error instanceof Error ? error.message : 'Failed to update configuration',
            loading: false
          })
        }
      },

      // Delete AI configuration
      deleteConfiguration: async (id: string) => {
        try {
          set({ loading: true, error: null })
          
          const { error } = await supabase
            .from('ai_configurations')
            .delete()
            .eq('id', id)

          if (error) throw error

          const { configurations, activeConfig } = get()
          const updatedConfigurations = configurations.filter(config => config.id !== id)
          
          set({
            configurations: updatedConfigurations,
            activeConfig: activeConfig?.id === id ? null : activeConfig,
            loading: false
          })

          // If we deleted the active config and there are others, activate the first one
          if (activeConfig?.id === id && updatedConfigurations.length > 0) {
            await get().setActiveConfiguration(updatedConfigurations[0].id)
          }
        } catch { // Ignored 
          set({
            error: error instanceof Error ? error.message : 'Failed to delete configuration',
            loading: false
          })
        }
      },

      // Set active configuration
      setActiveConfiguration: async (id: string) => {
        try {
          set({ loading: true, error: null })
          
          // First, deactivate all configurations
          await supabase
            .from('ai_configurations')
            .update({ is_active: false })
            .eq('user_id', 'current-user-id') // Replace with actual user ID

          // Then activate the selected one
          const { data, error } = await supabase
            .from('ai_configurations')
            .update({ is_active: true })
            .eq('id', id)
            .select()
            .single()

          if (error) throw error

          const { configurations } = get()
          const updatedConfigurations = configurations.map(config => ({
            ...config,
            is_active: config.id === id
          }))

          set({
            configurations: updatedConfigurations,
            activeConfig: data,
            loading: false
          })
        } catch { // Ignored 
          set({
            error: error instanceof Error ? error.message : 'Failed to set active configuration',
            loading: false
          })
        }
      },

      // Test AI configuration
      testConfiguration: async (config: Partial<AIConfiguration>) => {
        try {
          set({ loading: true, error: null })
          
          // Test the configuration by making a simple API call
          const testPrompt = "Hello, this is a test message. Please respond with 'Configuration test successful.'"
          
          let response: Response
          
          if (config.provider === 'openai') {
            response = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${config.api_key}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: config.model_name || 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: testPrompt }],
                max_tokens: 50,
                temperature: config.temperature || 0.7
              })
            })
          } else if (config.provider === 'anthropic') {
            response = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'x-api-key': config.api_key!,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
              },
              body: JSON.stringify({
                model: config.model_name || 'claude-3-haiku-20240307',
                max_tokens: 50,
                messages: [{ role: 'user', content: testPrompt }]
              })
            })
          } else {
            throw new Error('Unsupported AI provider')
          }

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error?.message || 'API test failed')
          }

          set({ loading: false })
          return true
        } catch { // Ignored 
          set({
            error: error instanceof Error ? error.message : 'Configuration test failed',
            loading: false
          })
          return false
        }
      },

      // Clear error
      clearError: () => {
        set({ error: null })
      }
    }),
    { name: 'ai-config-store' }
  )
) 