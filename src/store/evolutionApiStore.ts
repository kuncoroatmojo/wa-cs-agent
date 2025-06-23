import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { evolutionApiService } from '../services/evolutionApiService';
import type { EvolutionApiConfig, EvolutionInstance } from '../services/evolutionApiService';

interface EvolutionApiStore {
  // Configuration
  config: EvolutionApiConfig | null;
  isConfigured: boolean;
  
  // Instances
  instances: EvolutionInstance[];
  loading: boolean;
  error: string | null;
  
  // Actions
  setConfig: (config: EvolutionApiConfig) => void;
  clearConfig: () => void;
  testConnection: () => Promise<{ success: boolean; error?: string }>;
  
  // Instance management
  fetchInstances: () => Promise<void>;
  syncInstances: () => Promise<void>;
  createInstance: (instanceName: string, token?: string) => Promise<EvolutionInstance>;
  deleteInstance: (instanceName: string) => Promise<void>;
  connectInstance: (instanceName: string) => Promise<{ qrcode?: { code: string; base64: string } }>;
  disconnectInstance: (instanceName: string) => Promise<void>;
  getInstanceInfo: (instanceName: string) => Promise<{
    instance: EvolutionInstance | null;
    qrCode: { code: string; base64: string } | null;
    state: any;
  }>;
  
  // Utility
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  initialize: () => void;
}

// Initialize with environment variables if available
const getInitialConfig = (): EvolutionApiConfig | null => {
  const envUrl = import.meta.env.VITE_EVOLUTION_API_URL;
  const envKey = import.meta.env.VITE_EVOLUTION_API_KEY;
  
  if (envUrl && envKey) {
    return {
      baseUrl: envUrl,
      apiKey: envKey
    };
  }
  
  return null;
};

export const useEvolutionApiStore = create<EvolutionApiStore>()(
  persist(
    (set, get) => ({
      // Initial state - use environment variables if available
      config: getInitialConfig(),
      isConfigured: !!(import.meta.env.VITE_EVOLUTION_API_URL && import.meta.env.VITE_EVOLUTION_API_KEY),
      instances: [],
      loading: false,
      error: null,

      // Configuration actions
      setConfig: (config: EvolutionApiConfig) => {
        evolutionApiService.setConfig(config);
        set({ 
          config, 
          isConfigured: true,
          error: null 
        });
      },

      clearConfig: () => {
        set({ 
          config: null, 
          isConfigured: false,
          instances: [],
          error: null 
        });
      },

      testConnection: async () => {
        const { config } = get();
        if (!config) {
          return { success: false, error: 'No configuration set' };
        }

        set({ loading: true, error: null });
        
        try {
          const result = await evolutionApiService.testConnection();
          
          if (result.success && result.instances) {
            set({ 
              instances: result.instances,
              loading: false,
              error: null 
            });
          } else {
            set({ 
              loading: false,
              error: result.error || 'Connection test failed' 
            });
          }
          
          return result;
        } catch { // Ignored 
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          set({ 
            loading: false,
            error: errorMessage 
          });
          return { success: false, error: errorMessage };
        }
      },

      // Instance management actions
      fetchInstances: async () => {
        const { isConfigured } = get();
        if (!isConfigured) {
          set({ error: 'Evolution API not configured' });
          return;
        }

        set({ loading: true, error: null });
        
        try {
          const instances = await evolutionApiService.fetchInstances();
          set({ 
            instances,
            loading: false,
            error: null 
          });
        } catch { // Ignored 
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch instances';
          set({ 
            loading: false,
            error: errorMessage 
          });
        }
      },

      syncInstances: async () => {
        const { isConfigured } = get();
        if (!isConfigured) {
          set({ error: 'Evolution API not configured' });
          return;
        }

        set({ loading: true, error: null });
        
        try {
          await evolutionApiService.syncInstancesWithDatabase();
          // Refresh instances after sync
          const instances = await evolutionApiService.fetchInstances();
          set({ 
            instances,
            loading: false,
            error: null 
          });
        } catch { // Ignored 
          const errorMessage = error instanceof Error ? error.message : 'Failed to sync instances';
          set({ 
            loading: false,
            error: errorMessage 
          });
        }
      },

      createInstance: async (instanceName: string, token?: string) => {
        const { isConfigured } = get();
        if (!isConfigured) {
          throw new Error('Evolution API not configured');
        }

        set({ loading: true, error: null });
        
        try {
          const newInstance = await evolutionApiService.createInstance(instanceName, token);
          
          // Refresh instances list
          const instances = await evolutionApiService.fetchInstances();
          set({ 
            instances,
            loading: false,
            error: null 
          });
          
          return newInstance;
        } catch { // Ignored 
          const errorMessage = error instanceof Error ? error.message : 'Failed to create instance';
          set({ 
            loading: false,
            error: errorMessage 
          });
          throw error;
        }
      },

      deleteInstance: async (instanceName: string) => {
        const { isConfigured } = get();
        if (!isConfigured) {
          throw new Error('Evolution API not configured');
        }

        set({ loading: true, error: null });
        
        try {
          await evolutionApiService.deleteInstance(instanceName);
          
          // Refresh instances list
          const instances = await evolutionApiService.fetchInstances();
          set({ 
            instances,
            loading: false,
            error: null 
          });
        } catch { // Ignored 
          const errorMessage = error instanceof Error ? error.message : 'Failed to delete instance';
          set({ 
            loading: false,
            error: errorMessage 
          });
          throw error;
        }
      },

      connectInstance: async (instanceName: string) => {
        const { isConfigured } = get();
        if (!isConfigured) {
          throw new Error('Evolution API not configured');
        }

        try {
          const result = await evolutionApiService.connectInstance(instanceName);
          
          // Refresh instances to get updated status
          const instances = await evolutionApiService.fetchInstances();
          set({ instances });
          
          return result;
        } catch { // Ignored 
          const errorMessage = error instanceof Error ? error.message : 'Failed to connect instance';
          set({ error: errorMessage });
          throw error;
        }
      },

      disconnectInstance: async (instanceName: string) => {
        const { isConfigured } = get();
        if (!isConfigured) {
          throw new Error('Evolution API not configured');
        }

        try {
          await evolutionApiService.disconnectInstance(instanceName);
          
          // Refresh instances to get updated status
          const instances = await evolutionApiService.fetchInstances();
          set({ instances });
        } catch { // Ignored 
          const errorMessage = error instanceof Error ? error.message : 'Failed to disconnect instance';
          set({ error: errorMessage });
          throw error;
        }
      },

      getInstanceInfo: async (instanceName: string) => {
        const { isConfigured } = get();
        if (!isConfigured) {
          throw new Error('Evolution API not configured');
        }

        return await evolutionApiService.getInstanceInfo(instanceName);
      },

      // Utility actions
      setLoading: (loading: boolean) => set({ loading }),
      setError: (error: string | null) => set({ error }),

      // Initialize service with current config
      initialize: () => {
        const { config } = get();
        if (config) {
          evolutionApiService.setConfig(config);
        }
      },
    }),
    {
      name: 'evolution-api-store',
      partialize: (state) => ({ 
        config: state.config,
        isConfigured: state.isConfigured 
      }),
    }
  )
); 