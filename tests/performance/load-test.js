import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

// Custom metrics
export const errorRate = new Rate('errors')
export const ragResponseTime = new Trend('rag_response_time')
export const aiResponseTime = new Trend('ai_response_time')
export const databaseResponseTime = new Trend('database_response_time')

// Test configuration
export let options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up to 10 users
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 20 }, // Ramp up to 20 users
    { duration: '5m', target: 20 }, // Stay at 20 users
    { duration: '2m', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
    http_req_failed: ['rate<0.01'],    // Error rate must be below 1%
    rag_response_time: ['p(95)<800'],  // RAG responses under 800ms
    ai_response_time: ['p(95)<3000'],  // AI responses under 3s
    database_response_time: ['p(95)<250'], // DB queries under 250ms
  },
}

// Test data
const testUsers = [
  { email: 'test1@example.com', password: 'password123' },
  { email: 'test2@example.com', password: 'password123' },
  { email: 'test3@example.com', password: 'password123' }
]

const testQueries = [
  'What is your return policy?',
  'How do I track my order?',
  'Can I cancel my subscription?',
  'What payment methods do you accept?',
  'How do I reset my password?',
  'When will my order ship?',
  'Do you offer international shipping?',
  'How can I contact customer support?'
]

// Base URL
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

// Authentication function
function authenticate() {
  const user = testUsers[Math.floor(Math.random() * testUsers.length)]
  
  const response = http.post(`${BASE_URL}/api/auth/login`, {
    email: user.email,
    password: user.password
  }, {
    headers: { 'Content-Type': 'application/json' }
  })

  check(response, {
    'authentication successful': (r) => r.status === 200,
    'returns access token': (r) => r.json().access_token !== undefined
  })

  if (response.status === 200) {
    return response.json().access_token
  }
  return null
}

// Test scenario: Chat conversation flow
export default function() {
  const token = authenticate()
  if (!token) return

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }

  // Test 1: Create chat session
  const sessionResponse = http.post(`${BASE_URL}/api/chat/sessions`, {
    sender_id: `test-sender-${__VU}`,
    sender_type: 'api',
    sender_name: `Test User ${__VU}`
  }, { headers })

  check(sessionResponse, {
    'session created': (r) => r.status === 200,
    'session has ID': (r) => r.json().id !== undefined
  })

  if (sessionResponse.status !== 200) return

  const sessionId = sessionResponse.json().id

  // Test 2: Send multiple messages to test RAG and AI performance
  for (let i = 0; i < 3; i++) {
    const query = testQueries[Math.floor(Math.random() * testQueries.length)]
    
    const messageStart = Date.now()
    const messageResponse = http.post(`${BASE_URL}/api/chat/messages`, {
      session_id: sessionId,
      content: query,
      use_rag: true
    }, { headers })

    const messageEnd = Date.now()
    const responseTime = messageEnd - messageStart

    // Record custom metrics
    if (messageResponse.status === 200) {
      const data = messageResponse.json()
      
      // Track RAG performance
      if (data.rag_context && data.rag_context.retrieval_time) {
        ragResponseTime.add(data.rag_context.retrieval_time)
      }
      
      // Track AI response time
      if (data.response_time_ms) {
        aiResponseTime.add(data.response_time_ms)
      }
      
      // Track overall response time
      databaseResponseTime.add(responseTime)
    }

    check(messageResponse, {
      'message sent successfully': (r) => r.status === 200,
      'response contains content': (r) => r.json().content !== undefined,
      'response time acceptable': (r) => responseTime < 5000,
      'confidence score present': (r) => r.json().confidence_score !== undefined
    })

    errorRate.add(messageResponse.status !== 200)
    
    sleep(1) // Wait 1 second between messages
  }

  // Test 3: Document upload performance
  const documentData = {
    title: `Test Document ${__VU}`,
    content: 'This is test content for performance testing. '.repeat(100),
    folder_path: '/test'
  }

  const uploadStart = Date.now()
  const uploadResponse = http.post(`${BASE_URL}/api/documents`, documentData, { headers })
  const uploadTime = Date.now() - uploadStart

  check(uploadResponse, {
    'document uploaded': (r) => r.status === 200,
    'upload time acceptable': (r) => uploadTime < 3000
  })

  // Test 4: List conversations (pagination test)
  const listResponse = http.get(`${BASE_URL}/api/chat/sessions?limit=20&offset=0`, { headers })

  check(listResponse, {
    'conversations listed': (r) => r.status === 200,
    'returns array': (r) => Array.isArray(r.json().data),
    'fast list response': (r) => r.timings.duration < 500
  })

  // Test 5: RAG search performance
  const searchQuery = testQueries[Math.floor(Math.random() * testQueries.length)]
  const searchStart = Date.now()
  
  const searchResponse = http.post(`${BASE_URL}/api/rag/search`, {
    query: searchQuery,
    limit: 10
  }, { headers })
  
  const searchTime = Date.now() - searchStart

  check(searchResponse, {
    'search completed': (r) => r.status === 200,
    'search time acceptable': (r) => searchTime < 1000,
    'returns results': (r) => r.json().results.length >= 0
  })

  ragResponseTime.add(searchTime)

  // Test 6: AI configuration retrieval
  const configResponse = http.get(`${BASE_URL}/api/ai/configurations`, { headers })

  check(configResponse, {
    'config retrieved': (r) => r.status === 200,
    'fast config response': (r) => r.timings.duration < 200
  })

  sleep(2) // Wait between iterations
}

// Performance test for concurrent document processing
export function documentProcessingTest() {
  const token = authenticate()
  if (!token) return

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }

  // Simulate large document upload
  const largeDocument = {
    title: `Large Document ${__VU}`,
    content: 'Large document content. '.repeat(1000), // ~25KB
    folder_path: '/performance-test'
  }

  const processStart = Date.now()
  const response = http.post(`${BASE_URL}/api/documents/process`, largeDocument, { headers })
  const processTime = Date.now() - processStart

  check(response, {
    'large document processed': (r) => r.status === 200,
    'processing time reasonable': (r) => processTime < 10000 // 10 seconds max
  })
}

// Stress test for WebSocket connections (if applicable)
export function websocketStressTest() {
  // This would test real-time chat features
  // Implementation depends on WebSocket library availability in k6
}

// Database performance test
export function databasePerformanceTest() {
  const token = authenticate()
  if (!token) return

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }

  // Test complex queries
  const complexQueries = [
    '/api/analytics/conversation-metrics',
    '/api/analytics/performance-stats',
    '/api/reports/handoff-statistics',
    '/api/reports/usage-analytics'
  ]

  complexQueries.forEach(endpoint => {
    const start = Date.now()
    const response = http.get(`${BASE_URL}${endpoint}`, { headers })
    const duration = Date.now() - start

    check(response, {
      [`${endpoint} responds correctly`]: (r) => r.status === 200,
      [`${endpoint} responds quickly`]: (r) => duration < 1000
    })

    databaseResponseTime.add(duration)
  })
}

// Memory and resource usage test
export function resourceUsageTest() {
  // Test memory-intensive operations
  const token = authenticate()
  if (!token) return

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }

  // Batch operation test
  const batchMessages = []
  for (let i = 0; i < 50; i++) {
    batchMessages.push({
      content: `Batch message ${i}`,
      session_id: `batch-session-${__VU}`
    })
  }

  const batchStart = Date.now()
  const batchResponse = http.post(`${BASE_URL}/api/chat/messages/batch`, {
    messages: batchMessages
  }, { headers })
  const batchTime = Date.now() - batchStart

  check(batchResponse, {
    'batch processing successful': (r) => r.status === 200,
    'batch processing time acceptable': (r) => batchTime < 15000
  })
} 