import React, { useEffect, useState } from 'react'
import { useChatStore } from '../store/chatStore'
import { useAuthStore } from '../store/authStore'
import { 
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,

  ComputerDesktopIcon,
  PhoneIcon,
  GlobeAltIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline'
import { formatDistanceToNow } from 'date-fns'
import LoadingSpinner from '../components/LoadingSpinner'

const Conversations: React.FC = () => {
  const {
    sessions,
    currentSession,
    messages,
    loading,
    error,
    fetchSessions,
    fetchSession,
    sendMessage,
    createSession,
    clearError
  } = useChatStore()

  const [messageInput, setMessageInput] = useState('')
  const [showNewSession, setShowNewSession] = useState(false)
  const [newSessionData, setNewSessionData] = useState({
    senderId: '',
    senderName: '',
    senderType: 'dashboard' as const
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const handleSessionSelect = async (sessionId: string) => {
    await fetchSession(sessionId)
  }

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !currentSession || loading) return

    const message = messageInput.trim()
    setMessageInput('')
    
    try {
      await sendMessage(currentSession.id, message, true) // Use RAG by default
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleCreateSession = async () => {
    if (!newSessionData.senderId.trim()) return

    try {
      const session = await createSession(
        newSessionData.senderId,
        newSessionData.senderType,
        newSessionData.senderName || undefined
      )
      
      setShowNewSession(false)
      setNewSessionData({ senderId: '', senderName: '', senderType: 'dashboard' })
      
      // Automatically select the new session
      await fetchSession(session.id)
    } catch (error) {
      console.error('Failed to create session:', error)
    }
  }

  const getSenderIcon = (senderType: string) => {
    switch (senderType) {
      case 'whatsapp':
        return <PhoneIcon className="h-5 w-5 text-green-600" />
      case 'web':
        return <GlobeAltIcon className="h-5 w-5 text-blue-600" />
      case 'api':
        return <ComputerDesktopIcon className="h-5 w-5 text-purple-600" />
      default:
        return <ChatBubbleLeftRightIcon className="h-5 w-5 text-gray-600" />
    }
  }

  const filteredSessions = sessions.filter(session => {
    const matchesSearch = !searchQuery || 
      (session.sender_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      session.sender_id.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesFilter = filterType === 'all' || session.sender_type === filterType
    
    return matchesSearch && matchesFilter
  })

  const getMessageBackground = (role: string, isUser: boolean) => {
    if (role === 'user') {
      return isUser ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'
    }
    return 'bg-white border text-gray-900'
  }

  return (
    <div className="h-full flex">
      {/* Sessions Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Conversations</h2>
            <button
              onClick={() => setShowNewSession(true)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              <PlusIcon className="h-5 w-5" />
            </button>
          </div>
          
          {/* Search */}
          <div className="relative mb-3">
            <MagnifyingGlassIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          {/* Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Sources</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="web">Web</option>
            <option value="api">API</option>
            <option value="dashboard">Dashboard</option>
          </select>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto">
          {loading && !sessions.length ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchQuery || filterType !== 'all' ? 'No conversations match your filters' : 'No conversations yet'}
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {filteredSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => handleSessionSelect(session.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    currentSession?.id === session.id
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getSenderIcon(session.sender_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {session.sender_name || session.sender_id}
                        </h3>
                        <span className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(session.last_message_at))}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 capitalize">
                        {session.sender_type}
                      </p>
                      {session.messages && session.messages.length > 0 && (
                        <p className="text-sm text-gray-600 mt-1 truncate">
                          {session.messages[session.messages.length - 1]?.content}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentSession ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    {getSenderIcon(currentSession.sender_type)}
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {currentSession.sender_name || currentSession.sender_id}
                    </h3>
                    <p className="text-sm text-gray-500 capitalize">
                      {currentSession.sender_type} • {currentSession.is_active ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                </div>
                <button className="p-2 text-gray-400 hover:text-gray-600">
                  <AdjustmentsHorizontalIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => {
                const isUser = message.role === 'user'
                return (
                  <div
                    key={message.id}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      getMessageBackground(message.role, isUser)
                    }`}>
                      <div className="flex items-center space-x-2 mb-1">
                        {!isUser && (
                          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                            <ComputerDesktopIcon className="h-4 w-4 text-blue-600" />
                          </div>
                        )}
                        <span className="text-xs font-medium">
                          {isUser ? 'You' : 'AI Assistant'}
                        </span>
                        <span className="text-xs opacity-70">
                          {formatDistanceToNow(new Date(message.created_at))} ago
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      
                      {/* RAG Context Info */}
                      {message.rag_context && (
                        <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                          <p>Sources: {message.rag_context.source_documents.length} documents</p>
                          {message.confidence_score && (
                            <p>Confidence: {Math.round(message.confidence_score * 100)}%</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              
              {loading && (
                <div className="flex justify-center">
                  <div className="bg-gray-100 rounded-lg px-4 py-2">
                    <LoadingSpinner size="sm" />
                    <span className="ml-2 text-sm text-gray-600">AI is thinking...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex items-end space-x-3">
                <div className="flex-1">
                  <textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    rows={1}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    style={{ minHeight: '44px', maxHeight: '120px' }}
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || loading}
                  className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PaperAirplaneIcon className="h-5 w-5" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Press Enter to send, Shift+Enter for new line. RAG is enabled for intelligent responses.
              </p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No conversation selected</h3>
              <p className="mt-1 text-sm text-gray-500">
                Choose a conversation from the sidebar or create a new one
              </p>
            </div>
          </div>
        )}
      </div>

      {/* New Session Modal */}
      {showNewSession && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">New Conversation</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sender ID *
                  </label>
                  <input
                    type="text"
                    value={newSessionData.senderId}
                    onChange={(e) => setNewSessionData(prev => ({ ...prev, senderId: e.target.value }))}
                    placeholder="e.g., +1234567890, user@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sender Name (optional)
                  </label>
                  <input
                    type="text"
                    value={newSessionData.senderName}
                    onChange={(e) => setNewSessionData(prev => ({ ...prev, senderName: e.target.value }))}
                    placeholder="e.g., John Doe"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source Type
                  </label>
                  <select
                    value={newSessionData.senderType}
                    onChange={(e) => setNewSessionData(prev => ({ ...prev, senderType: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="dashboard">Dashboard</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="web">Web</option>
                    <option value="api">API</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowNewSession(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateSession}
                  disabled={!newSessionData.senderId.trim() || loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="fixed top-4 right-4 bg-red-50 border border-red-200 rounded-md p-4 z-50">
          <div className="flex">
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
    </div>
  )
}

export default Conversations 