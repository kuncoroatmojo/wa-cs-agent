import React, { useState, useEffect } from 'react'
import { PlusIcon, PhoneIcon, QrCodeIcon, WifiIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid'
import { IntegrationService } from '../services/integrationService'
import type { WhatsAppIntegration } from '../types'
import { useAuthStore } from '../store/authStore'

const integrationService = new IntegrationService()

export const WhatsApp: React.FC = () => {
  const { profile } = useAuthStore()
  const [integrations, setIntegrations] = useState<WhatsAppIntegration[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedIntegration, setSelectedIntegration] = useState<WhatsAppIntegration | null>(null)

  useEffect(() => {
    if (profile?.id) {
      loadIntegrations()
    }
  }, [profile?.id])

  const loadIntegrations = async () => {
    try {
      setLoading(true)
      const data = await integrationService.getWhatsAppIntegrations(profile!.id)
      setIntegrations(data)
    } catch (error) {
      console.error('Error loading WhatsApp integrations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async (integrationId: string) => {
    try {
      await integrationService.connectWhatsApp(integrationId)
      await loadIntegrations()
    } catch (error) {
      console.error('Error connecting WhatsApp:', error)
    }
  }

  const handleDisconnect = async (integrationId: string) => {
    try {
      await integrationService.disconnectWhatsApp(integrationId)
      await loadIntegrations()
    } catch (error) {
      console.error('Error disconnecting WhatsApp:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-green-600 bg-green-100'
      case 'connecting':
        return 'text-yellow-600 bg-yellow-100'
      case 'disconnected':
        return 'text-gray-600 bg-gray-100'
      case 'error':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircleIcon className="w-5 h-5 text-green-600" />
      case 'connecting':
        return <WifiIcon className="w-5 h-5 text-yellow-600 animate-pulse" />
      case 'error':
        return <XCircleIcon className="w-5 h-5 text-red-600" />
      default:
        return <XCircleIcon className="w-5 h-5 text-gray-600" />
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp Integrations</h1>
          <p className="text-gray-600">Connect your WhatsApp accounts to enable AI customer service</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Add WhatsApp Account
        </button>
      </div>

      {integrations.length === 0 ? (
        <div className="text-center py-12">
          <PhoneIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No WhatsApp integrations</h3>
          <p className="text-gray-600 mb-6">Connect your first WhatsApp account to start serving customers</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Connect WhatsApp
          </button>
        </div>
      ) : (
        <div className="grid gap-6">
          {integrations.map((integration) => (
            <WhatsAppIntegrationCard
              key={integration.id}
              integration={integration}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onEdit={setSelectedIntegration}
              getStatusColor={getStatusColor}
              getStatusIcon={getStatusIcon}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateWhatsAppModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false)
            loadIntegrations()
          }}
        />
      )}

      {selectedIntegration && (
        <EditWhatsAppModal
          integration={selectedIntegration}
          onClose={() => setSelectedIntegration(null)}
          onUpdated={() => {
            setSelectedIntegration(null)
            loadIntegrations()
          }}
        />
      )}
    </div>
  )
}

interface WhatsAppIntegrationCardProps {
  integration: WhatsAppIntegration
  onConnect: (id: string) => void
  onDisconnect: (id: string) => void
  onEdit: (integration: WhatsAppIntegration) => void
  getStatusColor: (status: string) => string
  getStatusIcon: (status: string) => React.ReactNode
}

const WhatsAppIntegrationCard: React.FC<WhatsAppIntegrationCardProps> = ({
  integration,
  onConnect,
  onDisconnect,
  onEdit,
  getStatusColor,
  getStatusIcon
}) => {
  const [qrCode, setQrCode] = useState<string | null>(null)

  const handleGetQRCode = async () => {
    try {
      const qr = await integrationService.getWhatsAppQRCode(integration.id)
      setQrCode(qr)
    } catch (error) {
      console.error('Error getting QR code:', error)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <PhoneIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{integration.name}</h3>
              <p className="text-sm text-gray-600">
                {integration.connection_type === 'cloud_api' ? 'Cloud API' : 'WhatsApp Web'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Status</label>
              <div className="flex items-center space-x-2 mt-1">
                {getStatusIcon(integration.status)}
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(integration.status)}`}>
                  {integration.status}
                </span>
              </div>
            </div>
            
            {integration.phone_number && (
              <div>
                <label className="text-sm font-medium text-gray-500">Phone Number</label>
                <p className="text-sm text-gray-900 mt-1">{integration.phone_number}</p>
              </div>
            )}
            
            {integration.last_connected_at && (
              <div>
                <label className="text-sm font-medium text-gray-500">Last Connected</label>
                <p className="text-sm text-gray-900 mt-1">
                  {new Date(integration.last_connected_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          {integration.status === 'error' && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center space-x-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
                <span className="text-sm text-red-800">Connection failed. Check your credentials and try again.</span>
              </div>
            </div>
          )}

          {integration.connection_type === 'baileys' && integration.status === 'connecting' && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-800">Scan QR Code with WhatsApp</p>
                  <p className="text-xs text-blue-600">Open WhatsApp on your phone and scan the QR code</p>
                </div>
                <button
                  onClick={handleGetQRCode}
                  className="flex items-center px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                >
                  <QrCodeIcon className="w-4 h-4 mr-1" />
                  Show QR
                </button>
              </div>
              {qrCode && (
                <div className="mt-3 p-3 bg-white rounded border">
                  <p className="text-xs text-gray-600 mb-2">QR Code (Mock):</p>
                  <code className="text-xs font-mono text-gray-800">{qrCode}</code>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col space-y-2">
          {integration.status === 'disconnected' || integration.status === 'error' ? (
            <button
              onClick={() => onConnect(integration.id)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
            >
              Connect
            </button>
          ) : (
            <button
              onClick={() => onDisconnect(integration.id)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
            >
              Disconnect
            </button>
          )}
          
          <button
            onClick={() => onEdit(integration)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  )
}

const CreateWhatsAppModal: React.FC<{
  onClose: () => void
  onCreated: () => void
}> = ({ onClose, onCreated }) => {
  const { profile } = useAuthStore()
  const [formData, setFormData] = useState({
    name: '',
    connection_type: 'cloud_api' as 'cloud_api' | 'baileys',
    phone_number: '',
    // Cloud API credentials
    access_token: '',
    phone_number_id: '',
    // Baileys doesn't need initial credentials
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.id) return

    try {
      setLoading(true)
      
      const credentials = formData.connection_type === 'cloud_api' 
        ? {
            access_token: formData.access_token,
            phone_number_id: formData.phone_number_id
          }
        : {}

      await integrationService.createWhatsAppIntegration({
        user_id: profile.id,
        name: formData.name,
        connection_type: formData.connection_type,
        phone_number: formData.phone_number || undefined,
        instance_key: `${profile.id}-${Date.now()}`,
        status: 'disconnected',
        credentials,
        settings: {}
      })

      onCreated()
    } catch (error) {
      console.error('Error creating WhatsApp integration:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Add WhatsApp Integration</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="My WhatsApp Business"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Connection Type</label>
            <select
              value={formData.connection_type}
              onChange={(e) => setFormData({ ...formData, connection_type: e.target.value as 'cloud_api' | 'baileys' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="cloud_api">WhatsApp Cloud API</option>
              <option value="baileys">WhatsApp Web (Baileys)</option>
            </select>
          </div>

          {formData.connection_type === 'cloud_api' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
                <input
                  type="password"
                  value={formData.access_token}
                  onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Your WhatsApp Cloud API access token"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number ID</label>
                <input
                  type="text"
                  value={formData.phone_number_id}
                  onChange={(e) => setFormData({ ...formData, phone_number_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Your WhatsApp phone number ID"
                  required
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number (Optional)</label>
            <input
              type="tel"
              value={formData.phone_number}
              onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="+1234567890"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Integration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const EditWhatsAppModal: React.FC<{
  integration: WhatsAppIntegration
  onClose: () => void
  onUpdated: () => void
}> = ({ integration, onClose, onUpdated }) => {
  const [formData, setFormData] = useState({
    name: integration.name,
    phone_number: integration.phone_number || '',
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setLoading(true)
      await integrationService.updateWhatsAppIntegration(integration.id, {
        name: formData.name,
        phone_number: formData.phone_number || undefined,
      })
      onUpdated()
    } catch (error) {
      console.error('Error updating WhatsApp integration:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this integration?')) return

    try {
      setLoading(true)
      await integrationService.deleteWhatsAppIntegration(integration.id)
      onUpdated()
    } catch (error) {
      console.error('Error deleting WhatsApp integration:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Edit WhatsApp Integration</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              value={formData.phone_number}
              onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="+1234567890"
            />
          </div>

          <div className="flex justify-between pt-4">
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="px-4 py-2 text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
            >
              Delete
            </button>
            
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
} 