// Base provider and interfaces
export { BaseMessagingProvider } from './baseProvider'
export type { 
  MessageData,
  ConnectionConfig,
  ConnectionStatus,
  SendMessageOptions,
  WebhookData
} from './baseProvider'

// Specific provider implementations
export { WhatsAppProvider } from './whatsappProvider'
export type { 
  WhatsAppCloudCredentials,
  WhatsAppBaileysCredentials
} from './whatsappProvider'

export { WhatWutProvider } from './whatwutProvider'
export type { WhatWutCredentials } from './whatwutProvider'

// Provider factory and management
export { 
  MessagingProviderFactory,
  ProviderManager,
  PROVIDER_TEMPLATES
} from './providerFactory'
export type { 
  ProviderType,
  ProviderTemplate
} from './providerFactory'

// Utility functions - these will be available after importing MessagingProviderFactory
// export const createMessagingProvider = MessagingProviderFactory.createProvider
// export const getProviderTemplate = MessagingProviderFactory.getProviderTemplate
// export const validateProviderConfig = MessagingProviderFactory.validateProviderConfig 