import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useEvolutionApiStore } from '../store/evolutionApiStore';
import LoadingSpinner from '../components/LoadingSpinner';

const Settings: React.FC = () => {
  const { profile } = useAuthStore();
  const {
    config: evolutionConfig,
    isConfigured: isEvolutionConfigured,
    instances: evolutionInstances,
    loading: evolutionLoading,
    error: evolutionError,
    setConfig: setEvolutionConfig,
    testConnection: testEvolutionConnection,
    fetchInstances: fetchEvolutionInstances,
    syncInstances: syncEvolutionInstances,
    createInstance: createEvolutionInstance,
    deleteInstance: deleteEvolutionInstance,
    connectInstance: connectEvolutionInstance,
    disconnectInstance: disconnectEvolutionInstance,
    setError: setEvolutionError
  } = useEvolutionApiStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: profile?.full_name || '',
    email: profile?.email || '',
    evolutionApiUrl: evolutionConfig?.baseUrl || '',
    evolutionApiKey: evolutionConfig?.apiKey || '',
    openaiApiKey: '',
    googleClientId: '',
    webhookUrl: '',
  });

  const [evolutionTestResult, setEvolutionTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [newInstanceName, setNewInstanceName] = useState('');

  // Check if environment variables are set
  const hasEnvConfig = !!(import.meta.env.VITE_EVOLUTION_API_URL && import.meta.env.VITE_EVOLUTION_API_KEY);
  const isUsingEnvConfig = hasEnvConfig && 
    evolutionConfig?.baseUrl === import.meta.env.VITE_EVOLUTION_API_URL &&
    evolutionConfig?.apiKey === import.meta.env.VITE_EVOLUTION_API_KEY;

  useEffect(() => {
    if (isEvolutionConfigured) {
      fetchEvolutionInstances();
    }
  }, [isEvolutionConfigured, fetchEvolutionInstances]);

  const tabs = [
    { id: 'profile', name: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { id: 'api', name: 'API Configuration', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
    { id: 'notifications', name: 'Notifications', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
    { id: 'security', name: 'Security', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async (_section: string) => {
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsLoading(false);
  };

  const renderProfileSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg leading-6 font-medium text-gray-900">Profile Information</h3>
        <p className="mt-1 text-sm text-gray-500">
          Update your personal information and profile settings.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-6">
          <div className="shrink-0">
            <img
              className="h-16 w-16 object-cover rounded-full"
              src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.full_name || 'User')}&background=3b82f6&color=fff`}
              alt="Profile"
            />
          </div>
          <div>
            <button type="button" className="btn-secondary text-sm">
              Change Avatar
            </button>
            <p className="text-xs text-gray-500 mt-1">JPG, GIF or PNG. 1MB max.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Full Name
            </label>
            <input
              type="text"
              name="name"
              id="name"
              value={formData.name}
              onChange={handleChange}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              id="email"
              value={formData.email}
              onChange={handleChange}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => handleSave('profile')}
            disabled={isLoading}
            className="btn-primary"
          >
            {isLoading ? <LoadingSpinner size="sm" /> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );

  const handleSaveEvolutionConfig = async () => {
    if (!formData.evolutionApiUrl || !formData.evolutionApiKey) {
      setEvolutionError('Please fill in all required fields');
      return;
    }

    try {
      const newConfig = {
        baseUrl: formData.evolutionApiUrl.replace(/\/$/, ''), // Remove trailing slash
        apiKey: formData.evolutionApiKey,
      };

      setEvolutionConfig(newConfig);
      
      // Test the connection
      const result = await testEvolutionConnection();
      setEvolutionTestResult(result);
      
      if (result.success) {
        setEvolutionError(null);
      }
    } catch (error) { 
      console.error('Failed to save config:', error);
      setEvolutionError(error instanceof Error ? error.message : 'Failed to save configuration');
    }
  };

  const handleTestEvolutionConnection = async () => {
    const result = await testEvolutionConnection();
    setEvolutionTestResult(result);
  };

  const handleCreateEvolutionInstance = async () => {
    if (!newInstanceName.trim()) {
      setEvolutionError('Please enter an instance name');
      return;
    }

    try {
      await createEvolutionInstance(newInstanceName);
      setNewInstanceName('');
      setEvolutionError(null);
    } catch (error) { 
      console.error('Failed to create instance:', error);
    }
  };

  const handleDeleteEvolutionInstance = async (instanceName: string) => {
    if (!confirm(`Are you sure you want to delete instance "${instanceName}"?`)) {
      return;
    }

    try {
      await deleteEvolutionInstance(instanceName);
      setEvolutionError(null);
    } catch (error) { 
      console.error('Failed to delete instance:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'text-green-600 bg-green-100';
      case 'connecting':
        return 'text-yellow-600 bg-yellow-100';
      case 'close':
      case 'closed':
      case 'disconnected':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const renderApiSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg leading-6 font-medium text-gray-900">API Configuration</h3>
        <p className="mt-1 text-sm text-gray-500">
          Configure your API keys and external service connections.
        </p>
      </div>

      <div className="space-y-6">
        {/* Evolution API Configuration */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-medium text-gray-900">Evolution API</h4>
            <div className="flex items-center gap-2">
              {isUsingEnvConfig && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  🔧 Using Environment Variables
                </span>
              )}
              {isEvolutionConfigured && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  ✅ Configured
                </span>
              )}
            </div>
          </div>

          {hasEnvConfig && !isUsingEnvConfig && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">Environment Variables Available</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>Environment variables are set but not currently used. You can use them by clicking "Use Environment Config" below.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Base URL *
              </label>
              <input
                type="url"
                value={formData.evolutionApiUrl}
                onChange={(e) => setFormData({ ...formData, evolutionApiUrl: e.target.value })}
                placeholder="https://your-evolution-api.com"
                disabled={isUsingEnvConfig}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isUsingEnvConfig ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key *
              </label>
              <input
                type="password"
                value={formData.evolutionApiKey}
                onChange={(e) => setFormData({ ...formData, evolutionApiKey: e.target.value })}
                placeholder="Your API key"
                disabled={isUsingEnvConfig}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isUsingEnvConfig ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mb-4">
            {hasEnvConfig && !isUsingEnvConfig && (
              <button
                onClick={() => {
                  const envConfig = {
                    baseUrl: import.meta.env.VITE_EVOLUTION_API_URL,
                    apiKey: import.meta.env.VITE_EVOLUTION_API_KEY
                  };
                  setEvolutionConfig(envConfig);
                  setFormData(prev => ({ 
                    ...prev, 
                    evolutionApiUrl: envConfig.baseUrl,
                    evolutionApiKey: envConfig.apiKey
                  }));
                  setEvolutionTestResult(null);
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
              >
                Use Environment Config
              </button>
            )}
            
            <button
              onClick={handleSaveEvolutionConfig}
              disabled={evolutionLoading || !formData.evolutionApiUrl || !formData.evolutionApiKey}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {evolutionLoading ? <LoadingSpinner size="sm" /> : 'Save Configuration'}
            </button>
            
            <button
              onClick={handleTestEvolutionConnection}
              disabled={evolutionLoading || !isEvolutionConfigured}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              Test Connection
            </button>
          </div>

          {/* Test Result */}
          {evolutionTestResult && (
            <div className={`p-3 rounded-md mb-4 ${evolutionTestResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  {evolutionTestResult.success ? (
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <h3 className={`text-sm font-medium ${evolutionTestResult.success ? 'text-green-800' : 'text-red-800'}`}>
                    {evolutionTestResult.success ? 'Connection Successful' : 'Connection Failed'}
                  </h3>
                  {evolutionTestResult.error && (
                    <div className="mt-2 text-sm text-red-700">
                      <p>{evolutionTestResult.error}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {evolutionError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{evolutionError}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Instance Management */}
          {isEvolutionConfigured && (
            <div className="border-t border-gray-200 pt-4">
              <h5 className="text-md font-medium text-gray-900 mb-3">Evolution API Instances</h5>
              
              {/* Create New Instance */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                  placeholder="Enter instance name"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleCreateEvolutionInstance}
                  disabled={evolutionLoading || !newInstanceName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Create Instance
                </button>
                <button
                  onClick={syncEvolutionInstances}
                  disabled={evolutionLoading}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
                >
                  Sync
                </button>
              </div>

              {/* Instances List */}
              {evolutionInstances.length > 0 ? (
                <div className="space-y-2">
                  {evolutionInstances.map((instance) => (
                    <div key={instance.instanceName} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                      <div className="flex items-center space-x-3">
                        <span className="font-medium">{instance.instanceName}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(instance.status)}`}>
                          {instance.status}
                        </span>
                        {instance.owner && (
                          <span className="text-sm text-gray-500">
                            {instance.owner.replace('@s.whatsapp.net', '')}
                          </span>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        {instance.status === 'close' && (
                          <button
                            onClick={() => connectEvolutionInstance(instance.instanceName)}
                            disabled={evolutionLoading}
                            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            Connect
                          </button>
                        )}
                        {instance.status === 'open' && (
                          <button
                            onClick={() => disconnectEvolutionInstance(instance.instanceName)}
                            disabled={evolutionLoading}
                            className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
                          >
                            Disconnect
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteEvolutionInstance(instance.instanceName)}
                          disabled={evolutionLoading}
                          className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No instances found. Create your first instance above.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Other API Configurations */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-md font-medium text-gray-900 mb-3">OpenAI API</h4>
          <div>
            <label htmlFor="openaiApiKey" className="block text-sm font-medium text-gray-700">
              API Key
            </label>
            <input
              type="password"
              name="openaiApiKey"
              id="openaiApiKey"
              value={formData.openaiApiKey}
              onChange={handleChange}
              placeholder="sk-..."
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-md font-medium text-gray-900 mb-3">Google Drive Integration</h4>
          <div>
            <label htmlFor="googleClientId" className="block text-sm font-medium text-gray-700">
              Client ID
            </label>
            <input
              type="text"
              name="googleClientId"
              id="googleClientId"
              value={formData.googleClientId}
              onChange={handleChange}
              placeholder="Your Google Client ID"
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-md font-medium text-gray-900 mb-3">Webhook Configuration</h4>
          <div>
            <label htmlFor="webhookUrl" className="block text-sm font-medium text-gray-700">
              Webhook URL
            </label>
            <input
              type="url"
              name="webhookUrl"
              id="webhookUrl"
              value={formData.webhookUrl}
              onChange={handleChange}
              placeholder="https://your-app.vercel.app/api/webhook"
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => handleSave('api')}
            disabled={isLoading}
            className="btn-primary"
          >
            {isLoading ? <LoadingSpinner size="sm" /> : 'Save Other Configurations'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg leading-6 font-medium text-gray-900">Notification Preferences</h3>
        <p className="mt-1 text-sm text-gray-500">
          Choose when and how you want to be notified.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-900">New Messages</h4>
            <p className="text-sm text-gray-500">Get notified when new messages arrive</p>
          </div>
          <input
            type="checkbox"
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            defaultChecked
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Connection Issues</h4>
            <p className="text-sm text-gray-500">Get notified when WhatsApp instances disconnect</p>
          </div>
          <input
            type="checkbox"
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            defaultChecked
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Weekly Reports</h4>
            <p className="text-sm text-gray-500">Receive weekly analytics reports</p>
          </div>
          <input
            type="checkbox"
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => handleSave('notifications')}
            disabled={isLoading}
            className="btn-primary"
          >
            {isLoading ? <LoadingSpinner size="sm" /> : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderSecuritySettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg leading-6 font-medium text-gray-900">Security Settings</h3>
        <p className="mt-1 text-sm text-gray-500">
          Manage your account security and privacy settings.
        </p>
      </div>

      <div className="space-y-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-md font-medium text-gray-900 mb-3">Change Password</h4>
          <div className="space-y-3">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
                Current Password
              </label>
              <input
                type="password"
                name="currentPassword"
                id="currentPassword"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                New Password
              </label>
              <input
                type="password"
                name="newPassword"
                id="newPassword"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm New Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                id="confirmPassword"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
            <button type="button" className="btn-primary">
              Update Password
            </button>
          </div>
        </div>

        <div className="bg-red-50 p-4 rounded-lg">
          <h4 className="text-md font-medium text-red-900 mb-3">Danger Zone</h4>
          <p className="text-sm text-red-700 mb-3">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <button type="button" className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium">
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            Settings
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage your account settings and preferences
          </p>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="sm:hidden">
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
          >
            {tabs.map((tab) => (
              <option key={tab.id} value={tab.id}>
                {tab.name}
              </option>
            ))}
          </select>
        </div>

        <div className="hidden sm:block">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
                >
                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                  </svg>
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'profile' && renderProfileSettings()}
          {activeTab === 'api' && renderApiSettings()}
          {activeTab === 'notifications' && renderNotificationSettings()}
          {activeTab === 'security' && renderSecuritySettings()}
        </div>
      </div>
    </div>
  );
};

export default Settings; 