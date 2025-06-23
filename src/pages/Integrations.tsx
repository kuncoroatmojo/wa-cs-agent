import React, { useState, useEffect } from 'react'
import { PlusIcon, LinkIcon, GlobeAltIcon, KeyIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { IntegrationService } from '../services/integrationService'
import type { ExternalIntegration } from '../types'
import { useAuthStore } from '../store/authStore'

const integrationService = new IntegrationService()

interface IntegrationTemplate {
  type: string
  name: string
  description: string
  icon: React.ReactNode
  fields: {
    key: string
    label: string
    type: 'text' | 'password' | 'url'
    placeholder: string
    required: boolean
  }[]
}

const integrationTemplates: IntegrationTemplate[] = [
  {
    type: 'whatwut',
    name: 'WhatWut',
    description: 'Connect your WhatWut platform for seamless customer messaging',
    icon: <GlobeAltIcon className="w-6 h-6" />,
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'Enter your WhatWut API key', required: true },
      { key: 'webhook_url', label: 'Webhook URL', type: 'url', placeholder: 'https://your-app.com/webhook', required: true },
      { key: 'instance_id', label: 'Instance ID', type: 'text', placeholder: 'Your WhatWut instance ID', required: false }
    ]
  },
  {
    type: 'telegram',
    name: 'Telegram Bot',
    description: 'Connect your Telegram bot for customer support',
    icon: <GlobeAltIcon className="w-6 h-6" />,
    fields: [
      { key: 'bot_token', label: 'Bot Token', type: 'password', placeholder: 'Your Telegram bot token', required: true },
      { key: 'webhook_url', label: 'Webhook URL', type: 'url', placeholder: 'https://your-app.com/telegram-webhook', required: true }
    ]
  },
  {
    type: 'custom',
    name: 'Custom API',
    description: 'Connect any custom API endpoint',
    icon: <LinkIcon className="w-6 h-6" />,
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'Enter your API key', required: true },
      { key: 'webhook_url', label: 'Webhook URL', type: 'url', placeholder: 'https://your-endpoint.com/webhook', required: true },
      { key: 'base_url', label: 'Base URL', type: 'url', placeholder: 'https://api.yourservice.com', required: false }
    ]
  }
]

export const Integrations: React.FC = () => {
  const { profile } = useAuthStore()
  const [integrations, setIntegrations] = useState<ExternalIntegration[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<IntegrationTemplate | null>(null)
  const [selectedIntegration, setSelectedIntegration] = useState<ExternalIntegration | null>(null)

  useEffect(() => {
    if (profile?.id) {
      loadIntegrations()
    }
  }, [profile?.id])

  const loadIntegrations = async () => {
    try {
      setLoading(true)
      const data = await integrationService.getExternalIntegrations(profile!.id)
      setIntegrations(data)
    } catch (error) { 
      console.error('Error loading integrations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTestIntegration = async (integrationId: string) => {
    try {
      const success = await integrationService.testExternalIntegration(integrationId)
      if (success) {
        alert('Integration test successful!')
      } else {
        alert('Integration test failed. Please check your configuration.')
      }
    } catch (error) { 
      console.error('Error testing integration:', error)
      alert('Error testing integration')
    }
  }

  const handleToggleIntegration = async (integrationId: string, isActive: boolean) => {
    try {
      await integrationService.toggleExternalIntegration(integrationId, isActive)
      await loadIntegrations()
    } catch (error) { 
      console.error('Error toggling integration:', error)
    }
  }

  const getIntegrationTemplate = (type: string) => {
    return integrationTemplates.find(t => t.type === type) || integrationTemplates.find(t => t.type === 'custom')!
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
          <h1 className="text-2xl font-bold text-gray-900">External Integrations</h1>
          <p className="text-gray-600">Connect external services and APIs to extend your AI agent's capabilities</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Add Integration
        </button>
      </div>

      {/* Available Integration Templates */}
      {integrations.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <h2 className="col-span-full text-lg font-semibold text-gray-900 mb-4">Available Integrations</h2>
          {integrationTemplates.map((template) => (
            <div
              key={template.type}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => {
                setSelectedTemplate(template)
                setShowCreateModal(true)
              }}
            >
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  {template.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{template.name}</h3>
                  <p className="text-sm text-gray-500">{template.type}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">{template.description}</p>
              <div className="mt-4">
                <button className="text-blue-600 text-sm font-medium hover:text-blue-700">
                  Connect →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active Integrations */}
      {integrations.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Active Integrations</h2>
          {integrations.map((integration) => (
            <ExternalIntegrationCard
              key={integration.id}
              integration={integration}
              template={getIntegrationTemplate(integration.integration_type)}
              onTest={handleTestIntegration}
              onToggle={handleToggleIntegration}
              onEdit={setSelectedIntegration}
            />
          ))}
        </div>
      )}

      {/* Create Integration Modal */}
      {showCreateModal && (
        <CreateIntegrationModal
          template={selectedTemplate}
          onClose={() => {
            setShowCreateModal(false)
            setSelectedTemplate(null)
          }}
          onCreated={() => {
            setShowCreateModal(false)
            setSelectedTemplate(null)
            loadIntegrations()
          }}
        />
      )}

      {/* Edit Integration Modal */}
      {selectedIntegration && (
        <EditIntegrationModal
          integration={selectedIntegration}
          template={getIntegrationTemplate(selectedIntegration.integration_type)}
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

interface ExternalIntegrationCardProps {
  integration: ExternalIntegration
  template: IntegrationTemplate
  onTest: (id: string) => void
  onToggle: (id: string, isActive: boolean) => void
  onEdit: (integration: ExternalIntegration) => void
}

const ExternalIntegrationCard: React.FC<ExternalIntegrationCardProps> = ({
  integration,
  template,
  onTest,
  onToggle,
  onEdit
}) => {
  const webhookUrl = integration.settings?.webhook_url || integration.webhook_url
  const generatedWebhookUrl = webhookUrl || integrationService.generateWebhookUrl(integration.user_id, integration.integration_type)

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              {template.icon}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{integration.name}</h3>
              <p className="text-sm text-gray-600">{template.name}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Status</label>
              <div className="flex items-center space-x-2 mt-1">
                {integration.is_active ? (
                  <CheckCircleIcon className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircleIcon className="w-5 h-5 text-gray-400" />
                )}
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  integration.is_active
                    ? 'text-green-600 bg-green-100'
                    : 'text-gray-600 bg-gray-100'
                }`}>
                  {integration.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-500">Created</label>
              <p className="text-sm text-gray-900 mt-1">
                {new Date(integration.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-500">Webhook URL</label>
              <div className="flex items-center space-x-2 mt-1">
                <code className="text-xs bg-gray-100 px-2 py-1 rounded flex-1 font-mono">
                  {generatedWebhookUrl}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(generatedWebhookUrl)}
                  className="text-blue-600 text-xs hover:text-blue-700"
                >
                  Copy
                </button>
              </div>
            </div>

            {integration.api_key && (
              <div>
                <label className="text-sm font-medium text-gray-500">API Key</label>
                <div className="flex items-center space-x-2 mt-1">
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                    {integration.api_key.substring(0, 8)}...{integration.api_key.substring(-4)}
                  </code>
                  <KeyIcon className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col space-y-2">
          <button
            onClick={() => onTest(integration.id)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            Test
          </button>
          
          <button
            onClick={() => onToggle(integration.id, !integration.is_active)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              integration.is_active
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {integration.is_active ? 'Disable' : 'Enable'}
          </button>
          
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

const CreateIntegrationModal: React.FC<{
  template: IntegrationTemplate | null
  onClose: () => void
  onCreated: () => void
}> = ({ template, onClose, onCreated }) => {
  const { profile } = useAuthStore()
  const [selectedType, setSelectedType] = useState(template?.type || 'whatwut')
  const [formData, setFormData] = useState<Record<string, string>>({
    name: '',
  })
  const [loading, setLoading] = useState(false)

  const currentTemplate = template || integrationTemplates.find(t => t.type === selectedType)!

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.id || !currentTemplate) return

    try {
      setLoading(true)
      
      const settings: Record<string, any> = {}
      currentTemplate.fields.forEach(field => {
        if (formData[field.key]) {
          settings[field.key] = formData[field.key]
        }
      })

      await integrationService.createExternalIntegration({
        user_id: profile.id,
        name: formData.name,
        integration_type: currentTemplate.type,
        api_key: formData.api_key || undefined,
        webhook_url: formData.webhook_url || undefined,
        settings,
        is_active: true
      })

      onCreated()
    } catch (error) { 
      console.error('Error creating integration:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          {template ? `Add ${template.name} Integration` : 'Add External Integration'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {!template && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Integration Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {integrationTemplates.map((t) => (
                  <option key={t.type} value={t.type}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Integration Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={`My ${currentTemplate.name} Integration`}
              required
            />
          </div>

          {currentTemplate.fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <input
                type={field.type}
                value={formData[field.key] || ''}
                onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={field.placeholder}
                required={field.required}
              />
            </div>
          ))}

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
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Integration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const EditIntegrationModal: React.FC<{
  integration: ExternalIntegration
  template: IntegrationTemplate
  onClose: () => void
  onUpdated: () => void
}> = ({ integration, template, onClose, onUpdated }) => {
  const [formData, setFormData] = useState<Record<string, string>>({
    name: integration.name,
    ...integration.settings,
    api_key: integration.api_key || '',
    webhook_url: integration.webhook_url || '',
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setLoading(true)
      
      const settings: Record<string, any> = {}
      template.fields.forEach(field => {
        if (formData[field.key]) {
          settings[field.key] = formData[field.key]
        }
      })

      await integrationService.updateExternalIntegration(integration.id, {
        name: formData.name,
        api_key: formData.api_key || undefined,
        webhook_url: formData.webhook_url || undefined,
        settings,
      })

      onUpdated()
    } catch (error) { 
      console.error('Error updating integration:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this integration?')) return

    try {
      setLoading(true)
      await integrationService.deleteExternalIntegration(integration.id)
      onUpdated()
    } catch (error) { 
      console.error('Error deleting integration:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Edit {template.name} Integration</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Integration Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {template.fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <input
                type={field.type}
                value={formData[field.key] || ''}
                onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={field.placeholder}
                required={field.required}
              />
            </div>
          ))}

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
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
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