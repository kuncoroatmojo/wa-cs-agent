import React, { useState, useEffect } from 'react';
import { useWhatsAppStore } from '../store/whatsappStore';
import { useAuthStore } from '../store/authStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { supabase } from '../lib/supabase';
import whatsappService from '../services/whatsappService';

const WhatsAppInstances: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [_selectedInstance, _setSelectedInstance] = useState<string | null>(null);
  const { profile } = useAuthStore();
  const {
    instances,
    isLoading,
    error,
    fetchInstances,
    createInstance,
    deleteInstance,
    setError
  } = useWhatsAppStore();

  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  const handleCreateInstance = async (name: string, connectionType: 'baileys' | 'cloud_api') => {
    if (!profile) return;

    const result = await createInstance({
      name,
      connectionType,
      userId: profile.id
    });

    if (result.success) {
      setShowCreateModal(false);
    }
  };

  const handleConnectInstance = async (instanceId: string) => {
    try {
      console.log('Attempting to connect WhatsApp instance:', instanceId);
      
      // Use our custom WhatsApp service instead of Edge Function
      const connectResponse = await whatsappService.initializeConnection(instanceId);

      if (connectResponse.error) {
        console.error('Failed to connect WhatsApp instance:', connectResponse.error);
        setError(`Failed to connect: ${connectResponse.error}`);
      } else {
        console.log('WhatsApp instance connection initiated:', connectResponse);
        
        if (connectResponse.qrCode) {
          console.log('QR code generated for instance:', instanceId);
        }
        
        // Refresh instances to get updated status including QR code
        await fetchInstances();
        
        // Show user-friendly message
        alert('WhatsApp connection initiated! A QR code has been generated. The instance will automatically connect after 5 seconds for demonstration purposes.');
      }
    } catch (error) {
      console.error('Failed to connect WhatsApp instance:', error);
      setError(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  if (isLoading && instances.length === 0) {
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
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
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
      {instances.length === 0 ? (
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
          {instances.map((instance) => (
            <div key={instance.id} className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{instance.name}</h3>
                    <p className="text-sm text-gray-500">
                      {instance.connectionType === 'baileys' ? 'Baileys Connection' : 'Cloud API'}
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
                            The instance will automatically connect in 5 seconds for demo purposes
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

                <div className="mt-6 flex space-x-3">
                  <button
                    type="button"
                    className="flex-1 btn-secondary text-sm"
                    onClick={() => _setSelectedInstance(instance.id)}
                  >
                    Settings
                  </button>
                  {instance.status === 'disconnected' && instance.connectionType === 'baileys' && (
                    <button
                      type="button"
                      className="btn-primary text-sm"
                      onClick={() => handleConnectInstance(instance.id)}
                    >
                      Connect
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-secondary text-sm text-red-600 hover:text-red-700"
                    onClick={() => deleteInstance(instance.id)}
                  >
                    Delete
                  </button>
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

// Create Instance Modal Component
interface CreateInstanceModalProps {
  onClose: () => void;
  onCreate: (name: string, connectionType: 'baileys' | 'cloud_api') => void;
}

const CreateInstanceModal: React.FC<CreateInstanceModalProps> = ({ onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    name: '',
    connectionType: 'baileys' as 'baileys' | 'cloud_api'
  });
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsCreating(true);
    try {
      await onCreate(formData.name, formData.connectionType);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Create New Instance</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Instance Name
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="Customer Support Bot"
                required
              />
            </div>

            <div>
              <label htmlFor="connectionType" className="block text-sm font-medium text-gray-700">
                Connection Type
              </label>
              <select
                id="connectionType"
                value={formData.connectionType}
                onChange={(e) => setFormData(prev => ({ ...prev, connectionType: e.target.value as 'baileys' | 'cloud_api' }))}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              >
                <option value="baileys">Baileys (QR Code)</option>
                <option value="cloud_api">WhatsApp Cloud API</option>
              </select>
            </div>

            <div className="bg-blue-50 p-4 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    {formData.connectionType === 'baileys' ? 'Baileys Connection' : 'Cloud API Connection'}
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>
                      {formData.connectionType === 'baileys' 
                        ? 'Scan QR code with your WhatsApp to connect. Best for personal accounts.'
                        : 'Use WhatsApp Business API. Requires WhatsApp Business account and API credentials.'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating || !formData.name.trim()}
                className="flex-1 btn-primary"
              >
                {isCreating ? <LoadingSpinner size="sm" /> : 'Create Instance'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppInstances; 