import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useChatStore } from '../store/chatStore'
import { useAuthStore } from '../store/authStore'
import { conversationService, type UnifiedConversation } from '../services/conversationService'
import { supabase } from '../lib/supabase'
import type { UnifiedMessage } from '../types'
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
import { 
  Phone,
  Video,
  MoreVertical,
  Send,
  Search,
  Filter,
  Users,
  MessageSquare,
  Clock,
  CheckCircle2
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import LoadingSpinner from '../components/LoadingSpinner'

interface ConversationListProps {
  conversations: UnifiedConversation[];
  selectedConversation: UnifiedConversation | null;
  onSelectConversation: (conversation: UnifiedConversation) => void;
  loading: boolean;
}

const ConversationList: React.FC<ConversationListProps> = ({ 
  conversations, 
  selectedConversation, 
  onSelectConversation,
  loading 
}) => {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8">
        <MessageSquare className="h-16 w-16 mb-4 text-gray-300" />
        <h3 className="text-lg font-medium mb-2">No conversations yet</h3>
        <p className="text-center text-sm">
          Conversations will appear here when you receive messages from your connected WhatsApp instances.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      {conversations.map((conversation) => {
        const isSelected = selectedConversation?.id === conversation.id;
        const initials = conversation.contact_name 
          ? conversation.contact_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
          : conversation.contact_id.slice(-2);

        return (
          <div
            key={conversation.id}
            onClick={() => onSelectConversation(conversation)}
            className={`
              flex items-center p-4 cursor-pointer transition-colors border-b border-gray-100
              ${isSelected 
                ? 'bg-green-50 border-l-4 border-l-green-500' 
                : 'hover:bg-gray-50'
              }
            `}
          >
            {/* Contact Avatar */}
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-semibold text-sm">
                {initials}
              </div>
              {conversation.status === 'active' && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
              )}
            </div>

            {/* Conversation Info */}
            <div className="flex-1 ml-3 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 truncate">
                  {conversation.contact_name || `+${conversation.contact_id}`}
                </h3>
                <div className="flex items-center space-x-2">
                  {/* Integration Badge */}
                  <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                    {conversation.integration_type}
                  </span>
                  {/* Timestamp */}
                  <span className="text-xs text-gray-500">
                    {new Date(conversation.last_message_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-1">
                <p className="text-sm text-gray-600 truncate">
                  {conversation.last_message_preview || 'No messages yet'}
                </p>
                
                <div className="flex items-center space-x-2">
                  {/* Message Count */}
                  {conversation.message_count > 0 && (
                    <span className="text-xs text-gray-500">
                      {conversation.message_count} msgs
                    </span>
                  )}
                  
                  {/* Priority Indicator */}
                  {conversation.priority === 'high' && (
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  )}
                  {conversation.priority === 'urgent' && (
                    <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface ChatHeaderProps {
  conversation: UnifiedConversation | null;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ conversation }) => {
  if (!conversation) {
    return (
      <div className="p-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center justify-center h-16">
          <span className="text-gray-500">Select a conversation to start chatting</span>
        </div>
      </div>
    );
  }

  const initials = conversation.contact_name 
    ? conversation.contact_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : conversation.contact_id.slice(-2);

  return (
    <div className="p-4 border-b border-gray-200 bg-white flex-shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {/* Contact Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-semibold text-sm">
            {initials}
          </div>
          
          {/* Contact Info */}
          <div className="ml-3">
            <h2 className="font-semibold text-gray-900">
              {conversation.contact_name || `+${conversation.contact_id}`}
            </h2>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-green-600">
                {conversation.status === 'active' ? 'Online' : 'Offline'}
              </span>
              <span className="text-xs text-gray-500">•</span>
              <span className="text-xs text-gray-500">
                {conversation.integration_type} • {conversation.message_count} messages
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <Phone className="h-5 w-5" />
          </button>
          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <Video className="h-5 w-5" />
          </button>
          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

interface MessageListProps {
  messages: UnifiedMessage[];
  loading: boolean;
  conversation: UnifiedConversation | null;
}

const MessageList: React.FC<MessageListProps> = ({ messages, loading, conversation }) => {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <MessageSquare className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <p>Select a conversation to view messages</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <MessageSquare className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <p>No messages in this conversation yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
      {messages.slice().reverse().map((message) => {
        const isFromMe = message.direction === 'outbound';
        const senderName = isFromMe ? 'You' : (message.sender_name || conversation.contact_name || `+${conversation.contact_id}`);
        
        // Use external_timestamp when available (actual WhatsApp message time), otherwise created_at
        const timestampToUse = message.external_timestamp || message.created_at;
        
        // Debug logging - Enhanced
        console.log(`Message ${message.id.slice(-6)}: 
          📝 Content: "${message.content.substring(0, 30)}..."
          🕐 External: ${message.external_timestamp}
          🕑 Created: ${message.created_at}
          ✅ Using: ${timestampToUse}
          📊 Has External: ${!!message.external_timestamp}`);
        
        const messageTime = new Date(timestampToUse).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        });

        return (
          <div
            key={message.id}
            className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
              isFromMe 
                ? 'bg-green-500 text-white' 
                : 'bg-white border border-gray-200 text-gray-900'
            }`}>
              {/* Sender name for received messages */}
              {!isFromMe && (
                <p className="text-xs font-medium text-gray-600 mb-1">
                  {senderName}
                </p>
              )}
              
              {/* Message content */}
              <p className="text-sm break-words">
                {message.content}
              </p>
              
              {/* Message time and status */}
              <div className={`flex items-center justify-end mt-1 space-x-1 ${
                isFromMe ? 'text-green-100' : 'text-gray-500'
              }`}>
                <span className="text-xs">
                  {messageTime}
                </span>
                {isFromMe && (
                  <CheckCircle2 className="h-3 w-3" />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  disabled: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, disabled }) => {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  return (
    <div className="p-4 border-t border-gray-200 bg-white flex-shrink-0">
      <form onSubmit={handleSubmit} className="flex items-center space-x-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={disabled ? "Select a conversation to send messages" : "Type a message..."}
          disabled={disabled}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={disabled || !message.trim()}
          className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
};

const Conversations: React.FC = () => {
  const { profile } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [conversations, setConversations] = useState<UnifiedConversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<UnifiedConversation | null>(null)
  const [messages, setMessages] = useState<UnifiedMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'resolved'>('all')

  // Load initial data
  useEffect(() => {
    if (profile) {
      loadConversations()
    }
  }, [profile])

  // Watch for refresh parameter in URL
  useEffect(() => {
    const refreshParam = searchParams.get('refresh')
    if (refreshParam && profile) {
      console.log('🔄 Forced refresh triggered from URL parameter')
      // Immediate refresh
      loadConversations()
      
      // Also schedule additional refreshes to catch any delayed updates
      const refreshTimeout1 = setTimeout(() => {
        console.log('🔄 Secondary refresh after 1 second')
        loadConversations()
      }, 1000)
      
      const refreshTimeout2 = setTimeout(() => {
        console.log('🔄 Final refresh after 3 seconds')
        loadConversations()
      }, 3000)
      
      // Clean up the URL parameter after a delay
      const cleanupTimeout = setTimeout(() => {
        setSearchParams({})
      }, 500)
      
      return () => {
        clearTimeout(refreshTimeout1)
        clearTimeout(refreshTimeout2)
        clearTimeout(cleanupTimeout)
      }
    }
  }, [searchParams, profile])

  // Set up real-time subscriptions
  useEffect(() => {
    if (!profile) return

    // Subscribe to conversation changes
    const conversationSubscription = supabase
      .channel('conversation-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `user_id=eq.${profile.id}`
        },
        async (payload) => {
          console.log('🔄 Conversation change received:', payload)
          // Reload conversations to get the latest state
          await loadConversations()
        }
      )
      .subscribe()

    // Subscribe to message changes for the selected conversation
    let messageSubscription: any
    if (selectedConversation) {
      messageSubscription = supabase
        .channel('message-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversation_messages',
            filter: `conversation_id=eq.${selectedConversation.id}`
          },
          async (payload) => {
            console.log('🔄 Message change received:', payload)
            // Reload messages to get the latest state
            await loadMessages(selectedConversation.id)
          }
        )
        .subscribe()
    }

    // Cleanup subscriptions
    return () => {
      conversationSubscription.unsubscribe()
      if (messageSubscription) {
        messageSubscription.unsubscribe()
      }
    }
  }, [profile, selectedConversation?.id])

  const loadConversations = async () => {
    try {
      setLoading(true)
      
      const filters = {
        status: filterStatus === 'all' ? undefined : filterStatus,
        limit: 500  // Increased from 100 to ensure all conversations are fetched
      }
      
      const unifiedConversations = await conversationService.getAllConversations(profile!.id, filters)
      
      setConversations(unifiedConversations)
    } catch (error) { 
      console.error('❌ Error loading conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async (conversationId: string) => {
    try {
      setMessagesLoading(true)
      
      const conversationMessages = await conversationService.getConversationMessages(conversationId, 50)
      
      setMessages(conversationMessages)
    } catch (error) { 
      console.error('❌ Error loading messages:', error)
      setMessages([])
    } finally {
      setMessagesLoading(false)
    }
  }

  const handleSendMessage = async (content: string) => {
    if (!selectedConversation) return

    try {
      
      const sentMessage = await conversationService.sendMessage(selectedConversation.id, content)
      
      // Add the sent message to the current messages
      setMessages(prev => [...prev, sentMessage])
      
      // Refresh conversations to update last message
      loadConversations()
    } catch (error) { 
      console.error('❌ Error sending message:', error)
      // TODO: Show error notification to user
    }
  }

  const handleSelectConversation = (conversation: UnifiedConversation) => {
    setSelectedConversation(conversation)
    // Load messages when selecting a conversation
    loadMessages(conversation.id)
  }

  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = searchTerm === '' || 
      conv.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.contact_id.includes(searchTerm) ||
      conv.last_message_preview?.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesSearch
  })

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Conversations Sidebar */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col min-h-0">
        {/* Search and Filter Header */}
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900 flex items-center">
              <Users className="h-6 w-6 mr-2 text-green-600" />
              Conversations
            </h1>
            <div className="flex items-center space-x-2">
              <button
                onClick={loadConversations}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                title="Refresh conversations"
              >
                <Clock className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          
          {/* Search Bar */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          
          {/* Filter Buttons */}
          <div className="flex space-x-2">
            {(['all', 'active', 'resolved'] as const).map((status) => (
                <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  filterStatus === status
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
        </div>

        {/* Conversation List */}
        <ConversationList
          conversations={filteredConversations}
          selectedConversation={selectedConversation}
          onSelectConversation={handleSelectConversation}
          loading={loading}
        />
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-h-0">
            {/* Chat Header */}
        <ChatHeader conversation={selectedConversation} />

            {/* Messages */}
        <MessageList 
          messages={messages} 
          loading={messagesLoading}
          conversation={selectedConversation}
        />

            {/* Message Input */}
        <MessageInput
          onSendMessage={handleSendMessage}
          disabled={!selectedConversation}
        />
      </div>
    </div>
  );
};

export default Conversations; 