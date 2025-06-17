import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { ChatSession, ChatMessage } from '../types'
import { ChatService } from '../services/chatService'

interface ChatState {
  // State
  sessions: ChatSession[]
  currentSession: ChatSession | null
  messages: ChatMessage[]
  loading: boolean
  error: string | null
  
  // Session management
  fetchSessions: () => Promise<void>
  fetchSession: (sessionId: string) => Promise<void>
  createSession: (senderId: string, senderType: string, senderName?: string) => Promise<ChatSession>
  
  // Message management
  sendMessage: (sessionId: string, content: string, useRAG?: boolean) => Promise<void>
  clearMessages: () => void
  
  // UI state
  setCurrentSession: (session: ChatSession | null) => void
  clearError: () => void
}

const chatService = new ChatService()

export const useChatStore = create<ChatState>()(
  devtools(
    (set, get) => ({
      // Initial state
      sessions: [],
      currentSession: null,
      messages: [],
      loading: false,
      error: null,

      // Fetch all sessions for current user
      fetchSessions: async () => {
        try {
          set({ loading: true, error: null })
          
          // Get user from auth store (you'll need to import this)
          const sessions = await chatService.getSessionsBySender('current-user-id') // Replace with actual user ID
          
          set({ sessions, loading: false })
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to fetch sessions',
            loading: false 
          })
        }
      },

      // Fetch specific session with messages
      fetchSession: async (sessionId: string) => {
        try {
          set({ loading: true, error: null })
          
          const session = await chatService.getSession(sessionId)
          const messages = await chatService.getMessages(sessionId)
          
          set({ 
            currentSession: session,
            messages: messages.reverse(), // Most recent first for UI
            loading: false 
          })
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to fetch session',
            loading: false 
          })
        }
      },

      // Create new chat session
      createSession: async (senderId: string, senderType: string, senderName?: string) => {
        try {
          set({ loading: true, error: null })
          
          const session = await chatService.createOrGetSession(
            'current-user-id', // Replace with actual user ID
            senderId,
            senderType,
            senderName
          )
          
          // Add to sessions list
          const { sessions } = get()
          set({ 
            sessions: [session, ...sessions],
            currentSession: session,
            messages: [],
            loading: false 
          })
          
          return session
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to create session',
            loading: false 
          })
          throw error
        }
      },

      // Send message with RAG processing
      sendMessage: async (sessionId: string, content: string, useRAG = true) => {
        try {
          set({ loading: true, error: null })
          
          // Add user message immediately for optimistic UI
          const userMessage: ChatMessage = {
            id: `temp-${Date.now()}`,
            session_id: sessionId,
            role: 'user',
            content,
            message_type: 'text',
            metadata: {},
            created_at: new Date().toISOString()
          }
          
          const { messages } = get()
          set({ messages: [userMessage, ...messages] })
          
          // Send to backend for AI processing
          await chatService.sendMessageWithRAG(sessionId, content, { useRAG })
          
          // Update with real messages from backend
          const updatedMessages = await chatService.getMessages(sessionId)
          set({ 
            messages: updatedMessages.reverse(),
            loading: false 
          })
          
          // Update session's last message time
          const { sessions, currentSession } = get()
          if (currentSession?.id === sessionId) {
            const updatedSession = {
              ...currentSession,
              last_message_at: new Date().toISOString()
            }
            set({
              currentSession: updatedSession,
              sessions: sessions.map(s => s.id === sessionId ? updatedSession : s)
            })
          }
          
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to send message',
            loading: false 
          })
          // Remove optimistic message on error
          const { messages } = get()
          set({ messages: messages.filter(m => !m.id.startsWith('temp-')) })
        }
      },

      // Clear messages
      clearMessages: () => {
        set({ messages: [], currentSession: null })
      },

      // Set current session
      setCurrentSession: (session: ChatSession | null) => {
        set({ currentSession: session })
        if (!session) {
          set({ messages: [] })
        }
      },

      // Clear error
      clearError: () => {
        set({ error: null })
      }
    }),
    { name: 'chat-store' }
  )
) 