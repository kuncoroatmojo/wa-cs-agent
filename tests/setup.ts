import '@testing-library/jest-dom'
import { beforeAll, afterEach, afterAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: vi.fn(() => Promise.resolve({ data: [], error: null }))
  })),
  auth: {
    getUser: vi.fn(() => Promise.resolve({ 
      data: { user: { id: 'test-user-id', email: 'test@example.com' } }, 
      error: null 
    })),
    signInWithPassword: vi.fn(() => Promise.resolve({ 
      data: { user: { id: 'test-user-id' } }, 
      error: null 
    })),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
    onAuthStateChange: vi.fn(() => ({ 
      data: { subscription: { unsubscribe: vi.fn() } } 
    }))
  },
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn(() => Promise.resolve({ data: { path: 'test-path' }, error: null })),
      download: vi.fn(() => Promise.resolve({ data: new Blob(), error: null })),
      remove: vi.fn(() => Promise.resolve({ data: null, error: null })),
      list: vi.fn(() => Promise.resolve({ data: [], error: null }))
    }))
  },
  functions: {
    invoke: vi.fn(() => Promise.resolve({ data: null, error: null }))
  },
  rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
  channel: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn(() => 'OK'),
    send: vi.fn(() => Promise.resolve('OK')),
    unsubscribe: vi.fn(() => Promise.resolve('OK'))
  })),
  removeChannel: vi.fn()
}

// Mock Supabase module
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient)
}))

// Mock environment variables
vi.mock('../src/lib/supabase', () => ({
  supabase: mockSupabaseClient
}))

// Mock fetch for API calls
global.fetch = vi.fn()

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
})

// MSW server for API mocking
export const server = setupServer(
  // Default handlers
  http.post('https://api.openai.com/v1/chat/completions', () => {
    return HttpResponse.json({
      choices: [{ message: { content: 'Test AI response' } }],
      usage: { total_tokens: 100 }
    })
  }),
  
  http.post('https://api.openai.com/v1/embeddings', () => {
    return HttpResponse.json({
      data: [{ embedding: new Array(1536).fill(0.1) }]
    })
  }),
  
  http.post('https://api.anthropic.com/v1/messages', () => {
    return HttpResponse.json({
      content: [{ text: 'Test Claude response' }],
      usage: { input_tokens: 50, output_tokens: 50 }
    })
  })
)

// Establish API mocking before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

// Clean up after each test case
afterEach(() => {
  cleanup()
  server.resetHandlers()
  vi.clearAllMocks()
})

// Clean up after all tests
afterAll(() => {
  server.close()
})

// Global test utilities
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  full_name: 'Test User',
  avatar_url: null,
  role: 'user',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides
})

export const createMockChatSession = (overrides = {}) => ({
  id: 'test-session-id',
  user_id: 'test-user-id',
  sender_id: 'test-sender',
  sender_name: 'Test Sender',
  sender_type: 'whatsapp',
  session_metadata: {},
  last_message_at: '2024-01-01T00:00:00Z',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides
})

export const createMockChatMessage = (overrides = {}) => ({
  id: 'test-message-id',
  session_id: 'test-session-id',
  role: 'user',
  content: 'Test message content',
  message_type: 'text',
  metadata: {},
  tokens_used: null,
  model_used: null,
  confidence_score: null,
  response_time_ms: null,
  created_at: '2024-01-01T00:00:00Z',
  ...overrides
})

export const createMockDocument = (overrides = {}) => ({
  id: 'test-document-id',
  user_id: 'test-user-id',
  title: 'Test Document',
  content: 'Test document content',
  file_path: 'test/path.txt',
  file_type: 'text/plain',
  file_size: 1024,
  folder_path: '/',
  upload_date: '2024-01-01T00:00:00Z',
  processed_date: '2024-01-01T00:00:00Z',
  status: 'ready',
  error_message: null,
  metadata: {},
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides
})

export const createMockAIConfig = (overrides = {}) => ({
  id: 'test-ai-config-id',
  user_id: 'test-user-id',
  name: 'Test AI Config',
  provider: 'openai',
  api_key: 'test-api-key',
  model_name: 'gpt-4o',
  temperature: 0.7,
  max_tokens: 1000,
  system_prompt: 'Test system prompt',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides
})

export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Custom render function with providers
export { render, screen, fireEvent, waitFor as waitForElement } from '@testing-library/react'
export { userEvent } from '@testing-library/user-event' 