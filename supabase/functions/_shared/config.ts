// Shared configuration for Supabase Edge Functions
export const config = {
  // CORS headers for all functions
  corsHeaders: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  },

  // OpenAI configuration
  openai: {
    model: 'text-embedding-3-small',
    embeddingDimensions: 1536,
    maxTokens: 4096,
    temperature: 0.7,
  },

  // RAG configuration
  rag: {
    chunkSize: 1000,
    chunkOverlap: 200,
    similarityThreshold: 0.7,
    maxRetrievedChunks: 10,
    batchSize: 10,
  },

  // Document processing configuration
  documents: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    supportedTypes: [
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/json',
      'text/html',
      // Note: PDF and DOCX support would require additional libraries
    ],
  },

  // Web scraping configuration
  webScraping: {
    maxDepth: 3,
    maxPagesPerSite: 10,
    requestDelay: 1000, // 1 second between requests
    timeout: 30000, // 30 seconds
    userAgent: 'Wacanda-Bot/1.0',
  },

  // Rate limiting
  rateLimits: {
    embeddingBatchSize: 10,
    embeddingDelay: 1000,
    scrapingDelay: 1000,
  },
}

// Environment variables with defaults
export const env = {
  supabaseUrl: Deno.env.get('SUPABASE_URL') || '',
  supabaseServiceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
  openaiApiKey: Deno.env.get('OPENAI_API_KEY') || '',
}

// Utility function for consistent error responses
export function createErrorResponse(
  message: string,
  status: number = 500,
  details?: any
) {
  return new Response(
    JSON.stringify({
      error: message,
      details,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: { ...config.corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

// Utility function for success responses
export function createSuccessResponse(data: any, status: number = 200) {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: { ...config.corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

// Utility function to handle CORS preflight
export function handleCORSPreflight() {
  return new Response('ok', { headers: config.corsHeaders })
}

// Text cleaning utilities
export function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[^\w\s\-.,!?:;'"()]/g, '') // Remove special characters
    .trim()
}

// Chunk text utility
export function splitTextIntoChunks(
  text: string,
  chunkSize: number = config.rag.chunkSize,
  overlap: number = config.rag.chunkOverlap
): string[] {
  if (text.length <= chunkSize) {
    return [text]
  }

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    let chunk = text.slice(start, end)

    // Try to break at word boundaries
    if (end < text.length) {
      const lastSpaceIndex = chunk.lastIndexOf(' ')
      if (lastSpaceIndex > chunkSize * 0.8) {
        chunk = chunk.slice(0, lastSpaceIndex)
      }
    }

    const cleanedChunk = cleanText(chunk)
    if (cleanedChunk.length > 50) {
      chunks.push(cleanedChunk)
    }

    start = start + chunkSize - overlap
    
    if (start >= text.length) break
  }

  return chunks
}

// Delay utility for rate limiting
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
} 