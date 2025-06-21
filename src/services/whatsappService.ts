import { supabase } from '../lib/supabase';
import { generateQRCodeDataURL, generateWhatsAppQRData } from '../utils/qrCode';

interface WhatsAppSession {
  instanceId: string;
  qrCode?: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  phoneNumber?: string;
}

interface WhatsAppMessage {
  from: string;
  to: string;
  message: string;
  timestamp: Date;
  type: 'text' | 'image' | 'document' | 'audio';
}

class WhatsAppService {
  private sessions: Map<string, WhatsAppSession> = new Map();
  private eventListeners: Map<string, ((event: any) => void)[]> = new Map();

  /**
   * Initialize a WhatsApp connection for an instance
   */
  async initializeConnection(instanceId: string): Promise<{ success: boolean; qrCode?: string; error?: string }> {
    try {
      console.log('Initializing WhatsApp connection for instance:', instanceId);

      // Check if session already exists
      if (this.sessions.has(instanceId)) {
        const session = this.sessions.get(instanceId)!;
        if (session.status === 'connected') {
          return { success: true };
        }
      }

      // Create new session
      const session: WhatsAppSession = {
        instanceId,
        status: 'connecting'
      };

      this.sessions.set(instanceId, session);

      // In a real implementation, this would initialize Baileys
      // For now, we'll simulate the QR code generation
      const qrCode = await this.generateQRCode(instanceId);
      
      session.qrCode = qrCode;
      
      // Update database with QR code
      await this.updateInstanceStatus(instanceId, 'connecting', qrCode);

      // Simulate connection process
      setTimeout(() => {
        this.simulateConnection(instanceId);
      }, 5000); // Simulate 5 second connection time

      return { success: true, qrCode };

    } catch (error) {
      console.error('Failed to initialize WhatsApp connection:', error);
      await this.updateInstanceStatus(instanceId, 'error');
      return { success: false, error: error instanceof Error ? error.message : 'Connection failed' };
    }
  }

  /**
   * Generate QR code for WhatsApp Web connection
   */
  private async generateQRCode(instanceId: string): Promise<string> {
    try {
      // Generate WhatsApp Web QR code data
      const qrData = generateWhatsAppQRData(instanceId);
      
      // Generate visual QR code image
      const qrCodeDataURL = await generateQRCodeDataURL(qrData, 200);
      
      console.log('Generated QR code for instance:', instanceId);
      console.log('QR data:', qrData);
      
      return qrCodeDataURL;
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      
      // Fallback to text-based QR code
      const qrData = generateWhatsAppQRData(instanceId);
      return `data:text/plain;base64,${btoa(qrData)}`;
    }
  }

  /**
   * Simulate successful connection (for development)
   */
  private async simulateConnection(instanceId: string) {
    const session = this.sessions.get(instanceId);
    if (!session) return;

    // Simulate successful connection
    session.status = 'connected';
    session.phoneNumber = '+1234567890'; // Mock phone number
    
    await this.updateInstanceStatus(instanceId, 'connected', null, session.phoneNumber);
    
    // Emit connection event
    this.emitEvent(instanceId, 'connected', { phoneNumber: session.phoneNumber });
    
    console.log(`WhatsApp instance ${instanceId} connected successfully`);
  }

  /**
   * Disconnect WhatsApp instance
   */
  async disconnect(instanceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const session = this.sessions.get(instanceId);
      if (session) {
        session.status = 'disconnected';
        session.qrCode = undefined;
        session.phoneNumber = undefined;
      }

      await this.updateInstanceStatus(instanceId, 'disconnected');
      this.sessions.delete(instanceId);

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Disconnect failed' };
    }
  }

  /**
   * Send a message through WhatsApp
   */
  async sendMessage(instanceId: string, to: string, message: string): Promise<{ success: boolean; error?: string }> {
    try {
      const session = this.sessions.get(instanceId);
      if (!session || session.status !== 'connected') {
        throw new Error('WhatsApp instance not connected');
      }

      // In a real implementation, this would use Baileys to send the message
      console.log(`Sending message from ${instanceId} to ${to}: ${message}`);

      // Simulate message sending
      const messageData: WhatsAppMessage = {
        from: session.phoneNumber || 'unknown',
        to,
        message,
        timestamp: new Date(),
        type: 'text'
      };

      // Store message in database
      await this.storeMessage(instanceId, messageData);

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Send failed' };
    }
  }

  /**
   * Get connection status
   */
  getStatus(instanceId: string): WhatsAppSession | null {
    return this.sessions.get(instanceId) || null;
  }

  /**
   * Add event listener for WhatsApp events
   */
  addEventListener(instanceId: string, callback: (event: any) => void) {
    if (!this.eventListeners.has(instanceId)) {
      this.eventListeners.set(instanceId, []);
    }
    this.eventListeners.get(instanceId)!.push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(instanceId: string, callback: (event: any) => void) {
    const listeners = this.eventListeners.get(instanceId);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   */
  private emitEvent(instanceId: string, type: string, data: any) {
    const listeners = this.eventListeners.get(instanceId);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback({ type, data, instanceId });
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  /**
   * Update instance status in database
   */
  private async updateInstanceStatus(
    instanceId: string, 
    status: string, 
    qrCode?: string | null, 
    phoneNumber?: string
  ) {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (qrCode !== undefined) {
      updateData.qr_code = qrCode;
    }

    if (phoneNumber) {
      updateData.phone_number = phoneNumber;
    }

    if (status === 'connected') {
      updateData.last_connected_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('whatsapp_instances')
      .update(updateData)
      .eq('id', instanceId);

    if (error) {
      console.error('Failed to update instance status:', error);
    }
  }

  /**
   * Store message in database
   */
  private async storeMessage(instanceId: string, messageData: WhatsAppMessage) {
    const { error } = await supabase
      .from('conversations')
      .insert({
        instance_id: instanceId,
        contact_phone: messageData.to,
        message_content: messageData.message,
        message_type: messageData.type,
        direction: 'outbound',
        timestamp: messageData.timestamp.toISOString()
      });

    if (error) {
      console.error('Failed to store message:', error);
    }
  }

  /**
   * Handle incoming messages (would be called by Baileys event handlers)
   */
  async handleIncomingMessage(instanceId: string, from: string, message: string, type: 'text' | 'image' | 'document' | 'audio' = 'text') {
    try {
      // Store incoming message
      await supabase
        .from('conversations')
        .insert({
          instance_id: instanceId,
          contact_phone: from,
          message_content: message,
          message_type: type,
          direction: 'inbound',
          timestamp: new Date().toISOString()
        });

      // Emit message event
      this.emitEvent(instanceId, 'message', {
        from,
        message,
        type,
        timestamp: new Date()
      });

      console.log(`Received message from ${from}: ${message}`);
    } catch (error) {
      console.error('Failed to handle incoming message:', error);
    }
  }
}

// Export singleton instance
export const whatsappService = new WhatsAppService();
export default whatsappService; 