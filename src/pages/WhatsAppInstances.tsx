import React, { useState, useEffect } from 'react';
import { useWhatsAppStore } from '../store/whatsappStore';
import { useAuthStore } from '../store/authStore';
import { useEvolutionApiStore } from '../store/evolutionApiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { supabase } from '../lib/supabase';
import { whatsappService } from '../services/whatsappService';
import { evolutionApiService } from '../services/evolutionApiService';
import { conversationService } from '../services/conversationService';
import { toast } from 'react-hot-toast';
import type { WhatsAppInstance } from '../types';

const WhatsAppInstances: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [_selectedInstance, _setSelectedInstance] = useState<string | null>(null);
  const [syncingInstances, setSyncingInstances] = useState<Set<string>>(new Set());
  const { profile } = useAuthStore();
  const {
    instances,
    isLoading,
    error,
    fetchInstances,
    createInstance,
    deleteInstance,
    setError,
    cleanupStaleInstances
  } = useWhatsAppStore();
  
  const { 
    isConfigured: isEvolutionConfigured,
    instances: evolutionInstances,
    syncInstances: syncEvolutionInstances,
    connectInstance: connectEvolutionInstance,
    disconnectInstance: disconnectEvolutionInstance
  } = useEvolutionApiStore();

  useEffect(() => {
    fetchInstances();
    if (isEvolutionConfigured) {
      syncEvolutionInstances();
    }
  }, [fetchInstances, isEvolutionConfigured, syncEvolutionInstances]);

  // Combine database instances with Evolution API instances
  const allInstances = React.useMemo(() => {
    const dbInstances = instances;
    const evolutionInstanceNames = new Set(dbInstances.filter(i => i.connectionType === 'evolution_api').map(i => i.instanceKey));
    
    // Add Evolution API instances that aren't in the database yet
    const missingEvolutionInstances = evolutionInstances
      .filter(evo => !evolutionInstanceNames.has(evo.instanceName))
      .map(evo => ({
        id: `evolution_${evo.instanceName}`,
        name: evo.instanceName,
        status: evo.status?.toLowerCase() === 'open' ? 'connected' as const : 
               evo.status?.toLowerCase() === 'connecting' ? 'connecting' as const : 'disconnected' as const,
        connectionType: 'evolution_api' as const,
        instanceKey: evo.instanceName,
        phoneNumber: evo.owner?.replace('@s.whatsapp.net', ''),
        qrCode: undefined,
        lastSeen: undefined,
        userId: profile?.id || '',
        settings: {
          autoReply: true,
          businessHours: { enabled: false, timezone: 'UTC', schedule: {} },
          welcomeMessage: 'Hello! How can I help you today?',
          outOfHoursMessage: 'We are currently closed.',
          humanHandoffKeywords: ['human', 'agent', 'support'],
          maxResponseTime: 30
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

    return [...dbInstances, ...missingEvolutionInstances];
  }, [instances, evolutionInstances, profile]);

  const handleCreateInstance = async (name: string, connectionType: 'baileys' | 'cloud_api' | 'evolution_api') => {
    if (!profile) return;

    const result = await createInstance({
      name,
      connectionType,
      userId: profile.id
    });

    if (result.success) {
      setShowCreateModal(false);
      
      // If Evolution API is configured and this is an evolution_api instance, sync
      if (connectionType === 'evolution_api' && isEvolutionConfigured) {
        await syncEvolutionInstances();
      }
    }
  };

  const handleConnectInstance = async (instanceId: string) => {
    try {
      
      // Find the instance to check if it's from Evolution API
      const instance = allInstances.find(i => i.id === instanceId);
      
      if (instance?.connectionType === 'evolution_api' && isEvolutionConfigured) {
        // Use Evolution API for connection - use instance_key as the Evolution API instance name
        const evolutionInstanceName = instance.instanceKey || instance.name;
        
        const result = await connectEvolutionInstance(evolutionInstanceName);
        
        // If we got a QR code, show it to the user (handle both response formats)
        const qrCodeBase64 = (result as any).base64 || result.qrcode?.base64;
        if (qrCodeBase64) {
          
          // Create a sleek centered modal
          const createQRModal = () => {
            const modal = document.createElement('div');
            modal.id = 'qr-modal';
            modal.style.cssText = `
              position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
              background: rgba(0, 0, 0, 0.75); z-index: 10000; display: flex; 
              align-items: center; justify-content: center; backdrop-filter: blur(4px);
              animation: fadeIn 0.3s ease-out;
            `;
            
            modal.innerHTML = `
              <style>
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideIn { from { transform: scale(0.9) translateY(-20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
                @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
                .qr-container { animation: slideIn 0.4s ease-out; }
                .qr-image { animation: pulse 2s infinite; }
                .status-indicator { 
                  display: inline-block; width: 8px; height: 8px; border-radius: 50%; 
                  background: #fbbf24; margin-right: 8px; animation: pulse 1s infinite;
                }
              </style>
              <div class="qr-container" style="
                background: white; padding: 32px; border-radius: 16px; text-align: center; 
                max-width: 420px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                border: 1px solid rgba(255, 255, 255, 0.1);
              ">
                <div style="margin-bottom: 20px;">
                  <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #1f2937;">
                    📱 Scan QR Code
                  </h2>
                  <p style="margin: 0; color: #6b7280; font-size: 14px;">
                    <span class="status-indicator"></span>Waiting for WhatsApp scan...
                  </p>
                </div>
                
                <div style="margin: 24px 0; padding: 16px; background: #f9fafb; border-radius: 12px;">
                  <p style="margin: 0 0 12px 0; font-weight: 500; color: #374151;">Instance: ${evolutionInstanceName}</p>
                  <img class="qr-image" src="${qrCodeBase64}" alt="WhatsApp QR Code" 
                       style="max-width: 280px; width: 100%; border: 3px solid #e5e7eb; border-radius: 12px; background: white;" />
                </div>
                
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px;">
                    📲 Open WhatsApp → Settings → Linked Devices → Link a Device
                  </p>
                  <p style="margin: 0; color: #3b82f6; font-size: 12px; font-weight: 500;">
                    ✨ This will close automatically when connected
                  </p>
                </div>
                
                <button onclick="document.body.removeChild(document.getElementById('qr-modal'))" 
                        style="
                          margin-top: 16px; padding: 8px 16px; background: #f3f4f6; border: 1px solid #d1d5db;
                          border-radius: 8px; color: #6b7280; font-size: 12px; cursor: pointer;
                          transition: all 0.2s;
                        "
                        onmouseover="this.style.background='#e5e7eb'"
                        onmouseout="this.style.background='#f3f4f6'">
                  Close manually
                </button>
              </div>
            `;
            
            // Close on background click
            modal.addEventListener('click', (e) => {
              if (e.target === modal) {
                document.body.removeChild(modal);
              }
            });
            
            return modal;
          };

          // Show the sleek modal
          const qrModal = createQRModal();
          document.body.appendChild(qrModal);

          // Start monitoring connection status
          const monitorConnection = async () => {
            let attempts = 0;
            const maxAttempts = 60; // Monitor for 5 minutes (60 * 5 seconds)
            
            const checkStatus = async () => {
              try {
                attempts++;
                const instances = await evolutionApiService.fetchInstances();
                const targetInstance = instances.find((inst: any) => inst.instanceName === evolutionInstanceName);
                
                if (targetInstance?.status?.toLowerCase() === 'open') {
                  // Connection successful!
                  
                  // Update the modal to show success
                  const modal = document.getElementById('qr-modal');
                  if (modal) {
                    const container = modal.querySelector('.qr-container');
                    if (container) {
                      container.innerHTML = `
                        <div style="text-align: center; padding: 20px;">
                          <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
                          <h2 style="margin: 0 0 8px 0; color: #059669; font-size: 24px;">Connected!</h2>
                          <p style="margin: 0; color: #6b7280;">WhatsApp instance "${evolutionInstanceName}" is now active</p>
                        </div>
                      `;
                      
                      // Auto-close after 2 seconds
                      setTimeout(() => {
                        if (document.getElementById('qr-modal')) {
                          document.body.removeChild(modal);
                        }
                      }, 2000);
                    }
                  }
                  
                  // Refresh the instances to update the UI
                  await fetchInstances();
                  await syncEvolutionInstances();
                  
                  return true; // Stop monitoring
                }
                
                // Continue monitoring if not connected and haven't exceeded max attempts
                if (attempts < maxAttempts) {
                  setTimeout(checkStatus, 5000); // Check every 5 seconds
                } else {
                  console.warn("Maximum connection attempts reached, stopping monitoring");
                  console.warn("Maximum connection attempts reached, stopping monitoring");
                }
                
              } catch (error) { 
                console.error('Error monitoring connection:', error);
                if (attempts < maxAttempts) {
                  setTimeout(checkStatus, 5000);
                }
              }
            };
            
            // Start checking after 3 seconds
            setTimeout(checkStatus, 3000);
          };
          
          monitorConnection();
        }
        
        // Refresh both stores
        await fetchInstances();
        await syncEvolutionInstances();
      } else {
        // Use our custom WhatsApp service with mock backend
        const connectResponse = await whatsappService.initializeConnection(instanceId);

        if (connectResponse.error) {
          console.error('Failed to connect WhatsApp instance:', connectResponse.error);
          setError(`Failed to connect: ${connectResponse.error}`);
        } else {
          
          // Refresh instances to get updated status including QR code
          await fetchInstances();
          
          alert('WhatsApp connection initiated in demo mode! A QR code has been generated. The instance will automatically connect after 8 seconds for demonstration purposes.');
        }
      }
    } catch (error) { 
      console.error('Failed to connect WhatsApp instance:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      setError(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSyncConversations = async (instance: any) => {
    if (!profile || syncingInstances.has(instance.id)) return;
    
    try {
      setSyncingInstances(prev => new Set([...prev, instance.id]));
      
      // Show progress toast
      toast.loading(`Syncing conversations and messages for ${instance.name}...`, {
        id: `sync-${instance.id}`,
        duration: 30000
      });
      
      
      // Use only the optimized sync approach - conversations are derived from messages
      if (instance.connectionType === 'evolution_api') {
        console.log('📨 Syncing all messages from Evolution API (conversations auto-created)...');
        
        const result = await conversationService.syncAllMessagesForRAG(profile.id, instance.instanceKey);
        
        if (result.errors.length > 0) {
          toast.success(
            `Sync completed! ${result.totalMessagesSynced} messages from ${result.totalConversations} conversations (${result.errors.length} errors)`,
            { id: `sync-${instance.id}`, duration: 8000 }
          );
        } else {
          toast.success(
            `🎉 Sync complete! ${result.totalMessagesSynced} messages from ${result.totalConversations} conversations`,
            { id: `sync-${instance.id}`, duration: 6000 }
          );
        }
        
        console.log(`📊 Final sync results:`, {
          instance: instance.name,
          conversations: result.totalConversations,
          messages: result.totalMessagesSynced,
          errors: result.errors.length
        });
      } else {
        // For non-Evolution API instances, just show conversations sync success
        toast.success(`Conversations synced for ${instance.name}`, {
          id: `sync-${instance.id}`,
          duration: 4000
        });
      }
      
    } catch (error) { 
      console.error('❌ Failed to sync conversations and messages:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync conversations and messages';
      
      toast.error(`Sync failed: ${errorMessage}`, {
        id: `sync-${instance.id}`,
        duration: 6000
      });
      
      setError(errorMessage);
    } finally {
      setSyncingInstances(prev => {
        const next = new Set(prev);
        next.delete(instance.id);
        return next;
      });
    }
  };

  const handleDelete = async (instance: WhatsAppInstance) => {
    if (!confirm(`Are you sure you want to delete the instance "${instance.name}"? This will remove it from both Evolution API and your database.`)) {
      return;
    }

    try {
      const result = await deleteInstance(instance.id);
      if (result.success) {
        toast.success('Instance deleted successfully');
      } else {
        toast.error(`Failed to delete instance: ${result.error}`);
      }
    } catch (error) { 
      toast.error('Failed to delete instance');
      console.error('Error deleting instance:', error);
    }
  };

  const handleCleanup = async () => {
    if (!confirm('Are you sure you want to remove all stale and disconnected instances? This action cannot be undone.')) {
      return;
    }

    try {
      const result = await cleanupStaleInstances();
      if (result.success) {
        toast.success('Successfully cleaned up stale instances');
      } else {
        toast.error(`Failed to cleanup instances: ${result.error}`);
      }
    } catch (error) { 
      toast.error('Failed to cleanup instances');
      console.error('Error during cleanup:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800';
      case 'connecting':
        return 'bg-yellow-100 text-yellow-800';
      case 'disconnected':
        return 'bg-gray-100 text-gray-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading && allInstances.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Loading WhatsApp instances..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            WhatsApp Instances
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage your WhatsApp connections and bot instances
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Evolution API:</span>
            {isEvolutionConfigured ? (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                ✅ Configured ({evolutionInstances.length} instances)
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                ⚠️ Not configured
              </span>
            )}
          </div>
        </div>
        <div className="mt-4 flex gap-3 md:mt-0 md:ml-4">
          <button
            type="button"
            onClick={() => window.location.href = '/settings'}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            API Configuration
          </button>
          <button
            type="button"
            onClick={handleCleanup}
            className="btn-primary"
            disabled={isLoading}
          >
            {isLoading ? 'Cleaning...' : 'Cleanup Stale Instances'}
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            Create New Instance
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Instances Grid */}
      {allInstances.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No WhatsApp instances</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating a new WhatsApp instance.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="btn-primary"
            >
              Create New Instance
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {allInstances.map((instance) => (
            <div key={instance.id} className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{instance.name}</h3>
                    <p className="text-sm text-gray-500">
                      {instance.connectionType === 'baileys' ? 'Baileys Connection' : 
                       instance.connectionType === 'evolution_api' ? 'Evolution API' : 'Cloud API'}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(instance.status)}`}>
                    {instance.status}
                  </span>
                </div>

                {instance.phoneNumber && (
                  <p className="mt-2 text-sm text-gray-600">
                    Phone: {instance.phoneNumber}
                  </p>
                )}

                {instance.status === 'connecting' && instance.qrCode && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Scan QR Code with WhatsApp:</p>
                    <div className="bg-gray-100 p-4 rounded-lg">
                      {instance.qrCode.startsWith('data:image') ? (
                        <div className="text-center">
                          <img 
                            src={instance.qrCode}
                            alt="WhatsApp QR Code"
                            className="mx-auto h-48 w-48 border-2 border-gray-300 rounded-lg"
                          />
                          <p className="text-xs text-gray-600 mt-2">
                            Open WhatsApp on your phone → Settings → Linked Devices → Link a Device
                          </p>
                          <p className="text-xs text-blue-600 mt-1">
                            Edge Function: Auto-connects in 10 seconds | Demo mode: Auto-connects in 8 seconds
                          </p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <p className="text-sm text-gray-600 mb-2">QR Code Generated</p>
                          <p className="text-xs font-mono text-gray-800 break-all">{instance.qrCode}</p>
                          <p className="text-xs text-blue-600 mt-2">Scan this QR code with WhatsApp to connect your account</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="flex-1 btn-secondary text-sm"
                    onClick={() => _setSelectedInstance(instance.id)}
                  >
                    Settings
                  </button>
                  
                  {instance.status === 'connected' && (
                    <button
                      type="button"
                      className={`flex-1 btn-primary text-sm ${syncingInstances.has(instance.id) ? 'opacity-75 cursor-not-allowed' : ''}`}
                      onClick={() => handleSyncConversations(instance)}
                      disabled={syncingInstances.has(instance.id)}
                    >
                      {syncingInstances.has(instance.id) ? (
                        <span className="flex items-center justify-center">
                          <LoadingSpinner size="sm" />
                          <span className="ml-2">Syncing...</span>
                        </span>
                      ) : (
                        'Sync Conversations'
                      )}
                    </button>
                  )}

                  {(instance.status === 'disconnected' || instance.status === 'connecting') && 
                    (instance.connectionType === 'baileys' || instance.connectionType === 'evolution_api') && (
                    <button
                      type="button"
                      className="btn-primary text-sm"
                      onClick={() => handleConnectInstance(instance.id)}
                    >
                      {instance.status === 'connecting' ? 'Refresh QR Code' : 'Connect'}
                    </button>
                  )}
                  
                  {instance.status === 'connected' && instance.connectionType === 'evolution_api' && (
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      onClick={() => disconnectEvolutionInstance(instance.instanceKey || instance.name)}
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Instance Modal */}
      {showCreateModal && (
        <CreateInstanceModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateInstance}
        />
      )}
    </div>
  );
};

interface CreateInstanceModalProps {
  onClose: () => void;
  onCreate: (name: string, connectionType: 'baileys' | 'cloud_api' | 'evolution_api') => void;
}

const CreateInstanceModal: React.FC<CreateInstanceModalProps> = ({ onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [connectionType, setConnectionType] = useState<'baileys' | 'cloud_api' | 'evolution_api'>('baileys');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      await onCreate(name.trim(), connectionType);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Create New WhatsApp Instance</h3>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Instance Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter instance name"
                required
              />
            </div>
            <div className="mb-4">
              <label htmlFor="connectionType" className="block text-sm font-medium text-gray-700 mb-2">
                Connection Type
              </label>
              <select
                id="connectionType"
                value={connectionType}
                onChange={(e) => setConnectionType(e.target.value as 'baileys' | 'cloud_api' | 'evolution_api')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="baileys">Baileys (Open Source)</option>
                <option value="evolution_api">Evolution API</option>
                <option value="cloud_api">Cloud API (Official)</option>
              </select>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
              >
                Create Instance
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppInstances; 