import { supabase } from '../lib/supabase';
import { generateQRCodeDataURL } from '../utils/qrCode';
import { evolutionApiService } from './evolutionApiService';
import type { WhatsAppInstance } from '../types';

export interface WhatsAppConnectionStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  qrCode?: string;
  phoneNumber?: string;
  error?: string;
}

class WhatsAppService {
  private instances = new Map<string, WhatsAppInstance>();
  private eventListeners = new Map<string, Set<(event: any) => void>>();
  private statusPollingIntervals = new Map<string, NodeJS.Timeout>();

  // Initialize WhatsApp connection with mock fallback
  async initializeConnection(instanceId: string): Promise<WhatsAppConnectionStatus> {
    try {
      
      // Check if this is an Evolution API instance
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('connection_type, instance_key')
        .eq('id', instanceId)
        .single();

      if (instance?.connection_type === 'evolution_api') {
        // For Evolution API instances, the connection should be handled by Evolution API service
        return {
          status: 'error',
          error: 'Evolution API instances should be connected through Evolution API configuration page'
        };
      }

      // Fallback to mock behavior for demo instances
      return this.initializeMockConnection(instanceId);
    } catch (error) { 
      console.error('Failed to initialize WhatsApp connection:', error);
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Mock connection for demo purposes
  private async initializeMockConnection(instanceId: string): Promise<WhatsAppConnectionStatus> {
    
    // Generate a visual QR code
    const mockQrCode = await generateQRCodeDataURL('demo-whatsapp-connection');
    
    // Update instance status in database
    await this.updateInstanceInDatabase(instanceId, 'connecting', mockQrCode);
    
    // Simulate connection after 8 seconds
    setTimeout(async () => {
      const mockPhoneNumber = `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`;
      await this.updateInstanceInDatabase(instanceId, 'connected', null, mockPhoneNumber);
      
      // Emit connection event
      this.emitEvent(instanceId, 'connection', {
        status: 'connected',
        phoneNumber: mockPhoneNumber
      });
    }, 8000);
    
    return {
      status: 'connecting',
      qrCode: mockQrCode
    };
  }

  // Get connection status from database
  async getConnectionStatus(instanceId: string): Promise<WhatsAppConnectionStatus> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('status, qr_code, phone_number')
        .eq('id', instanceId)
        .single();

      if (error) throw error;

      return {
        status: data.status as any,
        qrCode: data.qr_code,
        phoneNumber: data.phone_number
      };
    } catch (error) { 
      console.error('Failed to get connection status:', error);
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Start polling for status updates
  private startStatusPolling(instanceId: string) {
    // Clear existing interval
    this.stopStatusPolling(instanceId);
    
    const interval = setInterval(async () => {
      try {
        const status = await this.getConnectionStatus(instanceId);
        this.emitEvent(instanceId, 'status', status);
        
        // Stop polling if connected or error
        if (status.status === 'connected' || status.status === 'error') {
          this.stopStatusPolling(instanceId);
        }
      } catch (error) { 
        console.error('Status polling error:', error);
      }
    }, 2000);
    
    this.statusPollingIntervals.set(instanceId, interval);
  }

  // Stop status polling
  private stopStatusPolling(instanceId: string) {
    const interval = this.statusPollingIntervals.get(instanceId);
    if (interval) {
      clearInterval(interval);
      this.statusPollingIntervals.delete(instanceId);
    }
  }

  // Send message (mock implementation)
  async sendMessage(instanceId: string, to: string, message: string): Promise<{ success: boolean; error?: string }> {
    try {
      
      // Mock message sending
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Store message in database
      const { error } = await supabase
        .from('messages')
        .insert({
          instance_id: instanceId,
          phone_number: to,
          message_id: `msg_${Date.now()}`,
          type: 'text',
          content: message,
          direction: 'outbound',
          status: 'sent',
          timestamp: new Date().toISOString()
        });

      if (error) throw error;

      return { success: true };
    } catch (error) { 
      console.error('Failed to send message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Disconnect instance
  async disconnect(instanceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      
      await this.updateInstanceInDatabase(instanceId, 'disconnected');
      this.stopStatusPolling(instanceId);
      
      this.emitEvent(instanceId, 'disconnect', { instanceId });
      
      return { success: true };
    } catch (error) { 
      console.error('Failed to disconnect instance:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Update instance in database
  private async updateInstanceInDatabase(
    instanceId: string, 
    status: string, 
    qrCode?: string | null, 
    phoneNumber?: string | null
  ) {
    try {
      const updates: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (qrCode !== undefined) updates.qr_code = qrCode;
      if (phoneNumber !== undefined) updates.phone_number = phoneNumber;

      const { error } = await supabase
        .from('whatsapp_instances')
        .update(updates)
        .eq('id', instanceId);

      if (error) throw error;
    } catch (error) { 
      console.error('Failed to update instance in database:', error);
    }
  }

  // Event handling
  addEventListener(instanceId: string, callback: (event: any) => void) {
    if (!this.eventListeners.has(instanceId)) {
      this.eventListeners.set(instanceId, new Set());
    }
    this.eventListeners.get(instanceId)!.add(callback);
  }

  removeEventListener(instanceId: string, callback: (event: any) => void) {
    const listeners = this.eventListeners.get(instanceId);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emitEvent(instanceId: string, type: string, data: any) {
    const listeners = this.eventListeners.get(instanceId);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback({ type, data, instanceId });
        } catch (error) { 
          console.error('Event listener error:', error);
        }
      });
    }
  }

  // Cleanup
  cleanup() {
    // Clear all polling intervals
    this.statusPollingIntervals.forEach(interval => clearInterval(interval));
    this.statusPollingIntervals.clear();
    
    // Clear event listeners
    this.eventListeners.clear();
  }

  // Delete a WhatsApp instance
  async deleteInstance(instanceId: string): Promise<{ success: boolean; error?: string }> {
    try {

      // First get the instance details from database
      const { data: instance, error: fetchError } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('id', instanceId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch instance details: ${fetchError.message}`);
      }

      if (!instance) {
        throw new Error('Instance not found');
      }

      // Delete from Evolution API first
      try {
        await evolutionApiService.deleteInstance(instance.instance_key);
      } catch (error) { 
        // Continue with database deletion even if Evolution API fails
      }

      // Then delete from database
      const { error: deleteError } = await supabase
        .from('whatsapp_instances')
        .delete()
        .eq('id', instanceId);

      if (deleteError) {
        throw new Error(`Failed to delete from database: ${deleteError.message}`);
      }

      return { success: true };
    } catch (error) { 
      console.error('❌ Error deleting instance:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete instance' 
      };
    }
  }

  // Clean up stale instances
  async cleanupStaleInstances(): Promise<{ success: boolean; error?: string }> {
    try {

      // Get all instances from database
      const { data: dbInstances, error: fetchError } = await supabase
        .from('whatsapp_instances')
        .select('*');

      if (fetchError) {
        throw new Error(`Failed to fetch instances: ${fetchError.message}`);
      }

      // Get all instances from Evolution API
      let evolutionInstances;
      try {
        evolutionInstances = await evolutionApiService.fetchInstances();
      } catch (error) { 
        console.error('Failed to fetch Evolution API instances:', error);
        evolutionInstances = [];
      }

      // Create a map of Evolution API instances for quick lookup
      const evolutionInstanceMap = new Map(
        evolutionInstances.map(instance => [instance.instanceName, instance])
      );

      // Track cleanup results
      const results = {
        total: dbInstances?.length || 0,
        removed: 0,
        failed: 0,
        errors: [] as string[]
      };

      // Process each database instance
      for (const dbInstance of dbInstances || []) {
        try {
          const evolutionInstance = evolutionInstanceMap.get(dbInstance.instance_key);
          
          // If instance doesn't exist in Evolution API or is disconnected
          if (!evolutionInstance || 
              evolutionInstance.status === 'DISCONNECTED' || 
              evolutionInstance.status === 'CLOSED') {
            
            console.log(`🗑️ Removing stale instance: ${dbInstance.name} (${dbInstance.instance_key})`);
            
            // Try to delete from Evolution API if it exists
            if (evolutionInstance) {
              try {
                await evolutionApiService.deleteInstance(dbInstance.instance_key);
              } catch (error) { 
              }
            }

            // Delete from database
            const { error: deleteError } = await supabase
              .from('whatsapp_instances')
              .delete()
              .eq('id', dbInstance.id);

            if (deleteError) {
              throw new Error(`Failed to delete from database: ${deleteError.message}`);
            }

            results.removed++;
          }
        } catch (error) { 
          results.failed++;
          results.errors.push(`Failed to process ${dbInstance.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          console.error(`❌ Error processing instance ${dbInstance.name}:`, error);
        }
      }

      return { 
        success: true, 
        error: results.failed > 0 ? `Failed to remove ${results.failed} instances` : undefined
      };
    } catch (error) { 
      console.error('❌ Error during cleanup:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to cleanup instances'
      };
    }
  }
}

export const whatsappService = new WhatsAppService();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    whatsappService.cleanup();
  });
} 