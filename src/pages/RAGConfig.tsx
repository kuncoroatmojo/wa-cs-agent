import React, { useEffect, useState } from 'react'
import { useAIConfigStore } from '../store/aiConfigStore'
import { 
  CogIcon,
  PlusIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  TrashIcon,
  PencilIcon,
  EyeIcon,
  EyeSlashIcon,
  SparklesIcon,
  BeakerIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../components/LoadingSpinner'

const RAGConfig: React.FC = () => {
  const {
    configurations,
    activeConfig,
    loading,
    error,
    fetchConfigurations,
    createConfiguration,
    updateConfiguration,
    deleteConfiguration,
    setActiveConfiguration,
    testConfiguration,
    clearError
  } = useAIConfigStore()

  const [showForm, setShowForm] = useState(false)
  const [editingConfig, setEditingConfig] = useState<string | null>(null)
  const [showApiKey, setShowApiKey] = useState<{ [key: string]: boolean }>({})
  const [formData, setFormData] = useState<{
    name: string;
    provider: 'openai' | 'anthropic' | 'custom';
    api_key: string;
    model_name: string;
    temperature: number;
    max_tokens: number;
    system_prompt: string;
    is_active: boolean;
  }>({
    name: '',
    provider: 'openai',
    api_key: '',
    model_name: 'gpt-4o',
    temperature: 0.7,
    max_tokens: 1000,
    system_prompt: '',
    is_active: false
  })

  useEffect(() => {
    fetchConfigurations()
  }, [fetchConfigurations])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editingConfig) {
        await updateConfiguration(editingConfig, formData)
      } else {
        await createConfiguration(formData)
      }
      
      setShowForm(false)
      setEditingConfig(null)
      resetForm()
    } catch (error) { 
      console.error('Failed to save configuration:', error)
    }
  }

  const handleEdit = (config: {
    id: string;
    name: string;
    provider: 'openai' | 'anthropic' | 'custom';
    api_key: string;
    model_name: string;
    temperature: number;
    max_tokens: number;
    system_prompt?: string;
    is_active: boolean;
  }) => {
    setEditingConfig(config.id)
    setFormData({
      name: config.name,
      provider: config.provider,
      api_key: config.api_key,
      model_name: config.model_name,
      temperature: config.temperature,
      max_tokens: config.max_tokens,
      system_prompt: config.system_prompt || '',
      is_active: config.is_active
    })
    setShowForm(true)
  }

  const handleDelete = async (configId: string) => {
    if (window.confirm('Are you sure you want to delete this configuration?')) {
      await deleteConfiguration(configId)
    }
  }

  const handleTest = async (config: {
    id: string;
    name: string;
    provider: 'openai' | 'anthropic' | 'custom';
    api_key: string;
    model_name: string;
    temperature: number;
    max_tokens: number;
    system_prompt?: string;
    is_active: boolean;
  }) => {
    const success = await testConfiguration(config)
    if (success) {
      alert('Configuration test successful!')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      provider: 'openai',
      api_key: '',
      model_name: 'gpt-4o',
      temperature: 0.7,
      max_tokens: 1000,
      system_prompt: '',
      is_active: false
    })
  }

  const toggleApiKeyVisibility = (configId: string) => {
    setShowApiKey(prev => ({
      ...prev,
      [configId]: !prev[configId]
    }))
  }

  const getProviderInfo = (provider: string) => {
    switch (provider) {
      case 'openai':
        return {
          name: 'OpenAI',
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          models: ['gpt-4o', 'gpt-4', 'gpt-3.5-turbo', 'gpt-3.5-turbo-16k']
        }
      case 'anthropic':
        return {
          name: 'Anthropic',
          color: 'text-purple-600',
          bgColor: 'bg-purple-100',
          models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307']
        }
      default:
        return {
          name: 'Custom',
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          models: []
        }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            AI Configuration
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage AI models, API keys, and settings for your RAG-powered assistant
          </p>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Configuration
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
            <button
              onClick={clearError}
              className="ml-auto pl-3 text-red-400 hover:text-red-600"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Active Configuration Banner */}
      {activeConfig && (
        <div className="rounded-md bg-blue-50 p-4">
          <div className="flex">
            <CheckCircleIcon className="h-5 w-5 text-blue-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Active Configuration</h3>
              <p className="mt-1 text-sm text-blue-700">
                Using <strong>{activeConfig.name}</strong> ({getProviderInfo(activeConfig.provider).name} - {activeConfig.model_name})
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Configurations List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : configurations.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-center py-12">
            <CogIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No AI configurations</h3>
            <p className="mt-1 text-sm text-gray-500">
              Create your first AI configuration to start using the RAG assistant.
            </p>
            <div className="mt-6">
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Create Configuration
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {configurations.map((config) => {
              const providerInfo = getProviderInfo(config.provider)
              return (
                <li key={config.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className={`w-12 h-12 rounded-lg ${providerInfo.bgColor} flex items-center justify-center`}>
                        <SparklesIcon className={`h-6 w-6 ${providerInfo.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-lg font-medium text-gray-900 truncate">
                            {config.name}
                          </h4>
                          {config.is_active && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                          <span className={`font-medium ${providerInfo.color}`}>
                            {providerInfo.name}
                          </span>
                          <span>•</span>
                          <span>{config.model_name}</span>
                          <span>•</span>
                          <span>Temp: {config.temperature}</span>
                          <span>•</span>
                          <span>Max tokens: {config.max_tokens}</span>
                        </div>
                        <div className="mt-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-400">API Key:</span>
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {showApiKey[config.id] 
                                ? config.api_key 
                                : '••••••••••••••••••••••••••••••••'
                              }
                            </code>
                            <button
                              onClick={() => toggleApiKeyVisibility(config.id)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              {showApiKey[config.id] ? (
                                <EyeSlashIcon className="h-4 w-4" />
                              ) : (
                                <EyeIcon className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                        {config.system_prompt && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-600 line-clamp-2">
                              <span className="font-medium">System prompt:</span> {config.system_prompt}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleTest(config)}
                        className="p-2 text-gray-400 hover:text-blue-600"
                        title="Test Configuration"
                      >
                        <BeakerIcon className="h-5 w-5" />
                      </button>
                      {!config.is_active && (
                        <button
                          onClick={() => setActiveConfiguration(config.id)}
                          className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-100 rounded-full hover:bg-blue-200"
                        >
                          Activate
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(config)}
                        className="p-2 text-gray-400 hover:text-blue-600"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(config.id)}
                        className="p-2 text-gray-400 hover:text-red-600"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Configuration Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingConfig ? 'Edit Configuration' : 'New AI Configuration'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Configuration Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Customer Support GPT-4"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Provider *
                    </label>
                    <select
                      value={formData.provider}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        provider: e.target.value as 'openai' | 'anthropic' | 'custom',
                        model_name: getProviderInfo(e.target.value).models[0] || ''
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key *
                  </label>
                  <input
                    type="password"
                    value={formData.api_key}
                    onChange={(e) => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
                    placeholder="Enter your API key"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Model *
                    </label>
                    <select
                      value={formData.model_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, model_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {getProviderInfo(formData.provider).models.map(model => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                      {formData.provider === 'custom' && (
                        <option value="custom-model">Custom Model</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Temperature
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      value={formData.temperature}
                      onChange={(e) => setFormData(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Tokens
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="8000"
                      value={formData.max_tokens}
                      onChange={(e) => setFormData(prev => ({ ...prev, max_tokens: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    System Prompt (optional)
                  </label>
                  <textarea
                    value={formData.system_prompt}
                    onChange={(e) => setFormData(prev => ({ ...prev, system_prompt: e.target.value }))}
                    placeholder="You are a helpful AI assistant..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                    Set as active configuration
                  </label>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false)
                      setEditingConfig(null)
                      resetForm()
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Saving...' : editingConfig ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RAGConfig 