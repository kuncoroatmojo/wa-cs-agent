import { supabase } from '../lib/supabase';
import type { WhatsAppInstance, Message } from '../types';

// Evolution API will be accessed through your backend API routes for security
// These constants are for fallback/development only
const EVOLUTION_API_BASE = 'http://localhost:8080'; // Development fallback
const EVOLUTION_API_KEY = ''; // Will be handled server-side

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

interface CreateInstanceRequest {
  instanceName: string;
  token?: string;
  qrcode?: boolean;
  integration?: 'BAILEYS' | 'CLOUD_API';
}

interface SendMessageRequest {
  number: string;
  text?: string;
  media?: {
    mediatype: 'image' | 'video' | 'audio' | 'document';
    media: string; // base64 or URL
    fileName?: string;
  };
}

class EvolutionApiClient {
  private baseURL: string;
  private apiKey: string;
  // private userId: string | null = null;

  constructor(baseURL?: string, apiKey?: string) {
    this.baseURL = baseURL || EVOLUTION_API_BASE;
    this.apiKey = apiKey || EVOLUTION_API_KEY;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.apiKey,
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Instance Management
  async createInstance(params: CreateInstanceRequest): Promise<ApiResponse<any>> {
    return this.makeRequest('/instance/create', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async connectInstance(instanceName: string): Promise<ApiResponse<any>> {
    return this.makeRequest(`/instance/connect/${instanceName}`, {
      method: 'GET',
    });
  }

  async getInstanceInfo(instanceName: string): Promise<ApiResponse<any>> {
    return this.makeRequest(`/instance/connectionState/${instanceName}`, {
      method: 'GET',
    });
  }

  async getQRCode(instanceName: string): Promise<ApiResponse<any>> {
    return this.makeRequest(`/instance/qrcode/${instanceName}`, {
      method: 'GET',
    });
  }

  async logoutInstance(instanceName: string): Promise<ApiResponse<any>> {
    return this.makeRequest(`/instance/logout/${instanceName}`, {
      method: 'DELETE',
    });
  }

  async deleteInstance(instanceName: string): Promise<ApiResponse<any>> {
    return this.makeRequest(`/instance/delete/${instanceName}`, {
      method: 'DELETE',
    });
  }

  async restartInstance(instanceName: string): Promise<ApiResponse<any>> {
    return this.makeRequest(`/instance/restart/${instanceName}`, {
      method: 'PUT',
    });
  }

  // Messaging
  async sendTextMessage(
    instanceName: string,
    params: SendMessageRequest
  ): Promise<ApiResponse<any>> {
    return this.makeRequest(`/message/sendText/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async sendMediaMessage(
    instanceName: string,
    params: SendMessageRequest
  ): Promise<ApiResponse<any>> {
    return this.makeRequest(`/message/sendMedia/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // Chat Management
  async getChats(instanceName: string): Promise<ApiResponse<any>> {
    return this.makeRequest(`/chat/findChats/${instanceName}`, {
      method: 'GET',
    });
  }

  async getChatMessages(
    instanceName: string,
    chatId: string,
    limit: number = 50
  ): Promise<ApiResponse<any>> {
    return this.makeRequest(
      `/chat/findMessages/${instanceName}?chatId=${chatId}&limit=${limit}`,
      {
        method: 'GET',
      }
    );
  }

  async markAsRead(instanceName: string, chatId: string): Promise<ApiResponse<any>> {
    return this.makeRequest(`/chat/markMessageAsRead/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify({ chatId }),
    });
  }

  // Webhook Management
  async setWebhook(
    instanceName: string,
    webhookUrl: string,
    events: string[] = ['messages', 'connection']
  ): Promise<ApiResponse<any>> {
    return this.makeRequest(`/webhook/set/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({
        url: webhookUrl,
        events,
        webhook_by_events: true,
      }),
    });
  }

  async getWebhook(instanceName: string): Promise<ApiResponse<any>> {
    return this.makeRequest(`/webhook/find/${instanceName}`, {
      method: 'GET',
    });
  }

  // Profile Management
  async getProfile(instanceName: string): Promise<ApiResponse<any>> {
    return this.makeRequest(`/chat/profile/${instanceName}`, {
      method: 'GET',
    });
  }

  async setProfileName(instanceName: string, name: string): Promise<ApiResponse<any>> {
    return this.makeRequest(`/chat/updateProfileName/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  }

  async setProfilePicture(
    instanceName: string,
    picture: string
  ): Promise<ApiResponse<any>> {
    return this.makeRequest(`/chat/updateProfilePicture/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify({ picture }),
    });
  }

  // Integration with Supabase
  async syncInstanceToDatabase(instanceData: any, userId: string): Promise<void> {
    const instance: Partial<WhatsAppInstance> = {
      userId: userId,
      name: instanceData.instanceName,
      phoneNumber: instanceData.phoneNumber,
      status: instanceData.state === 'open' ? 'connected' : 'disconnected',
      connectionType: instanceData.integration || 'baileys',
      qrCode: instanceData.qrcode,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await supabase.from('whatsapp_instances').upsert({
      name: instance.name,
      user_id: userId,
      connection_type: instance.connectionType,
      phone_number: instance.phoneNumber,
      status: instance.status,
      qr_code: instance.qrCode,
      instance_key: instanceData.instanceName || `instance_${Date.now()}`,
      created_at: instance.createdAt,
      updated_at: instance.updatedAt,
    });
  }

  async syncMessageToDatabase(messageData: any, instanceId: string): Promise<void> {
    const message: Partial<Message> = {
      instance_id: instanceId,
      phone_number: messageData.remoteJid,
      message_id: messageData.key.id,
      type: messageData.messageType,
      content: messageData.message?.conversation || 
               messageData.message?.extendedTextMessage?.text ||
               JSON.stringify(messageData.message),
      direction: messageData.key.fromMe ? 'outbound' : 'inbound',
      status: 'delivered',
      timestamp: new Date(messageData.messageTimestamp * 1000).toISOString(),
      metadata: messageData,
    };

    await supabase.from('messages').insert(message);
  }
}

// Export singleton instance
export const evolutionApi = new EvolutionApiClient();

// Helper functions
export const formatPhoneNumber = (phone: string): string => {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Add country code if not present
  if (!digits.startsWith('55')) {
    return `55${digits}`;
  }
  
  return digits;
};

export const isValidPhoneNumber = (phone: string): boolean => {
  const formatted = formatPhoneNumber(phone);
  // Brazilian phone numbers: 5511999999999 (13 digits total)
  return /^55\d{10,11}$/.test(formatted);
};

export const getInstanceStatus = (state: string): 'connected' | 'disconnected' | 'connecting' => {
  switch (state) {
    case 'open':
      return 'connected';
    case 'connecting':
    case 'qr':
      return 'connecting';
    default:
      return 'disconnected';
  }
};

export const handleWebhookEvent = async (eventType: string, data: any) => {
  try {
    switch (eventType) {
      case 'messages.upsert':
        // Handle new messages
        console.log('New message received:', data);
        break;
      
      case 'connection.update':
        // Handle connection status changes
        console.log('Connection status changed:', data);
        break;
      
      case 'qrcode.updated':
        // Handle QR code updates
        console.log('QR code updated:', data);
        break;
      
      default:
        console.log('Unknown webhook event:', eventType, data);
    }
  } catch (error) {
    console.error('Error handling webhook event:', error);
  }
}; 