import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { OpenAI } from 'https://esm.sh/openai@4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChatRequest {
  session_id: string;
  message: string;
  sender_id: string;
  sender_type: string;
  use_rag?: boolean;
}

interface AIConfiguration {
  id: string;
  provider: string;
  api_key: string;
  model_name: string;
  temperature: number;
  max_tokens: number;
  system_prompt?: string;
}

interface DocumentChunk {
  id: string;
  chunk_text: string;
  similarity: number;
  source_id: string;
  source_type: 'document' | 'webpage';
  metadata: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { session_id, message, sender_id, sender_type, use_rag = true }: ChatRequest = await req.json()

    // 1. Get or create chat session
    const session = await getOrCreateSession(supabase, session_id, sender_id, sender_type)
    
    // 2. Store user message
    const userMessage = await storeMessage(supabase, session.id, 'user', message)

    // 3. Get AI configuration
    const aiConfig = await getActiveAIConfiguration(supabase, session.user_id)
    if (!aiConfig) {
      throw new Error('No active AI configuration found')
    }

    // 4. Get conversation history
    const conversationHistory = await getConversationHistory(supabase, session.id)

    // 5. Perform RAG search if enabled
    let ragContext = ""
    let sourceDocuments: DocumentChunk[] = []
    
    if (use_rag) {
      sourceDocuments = await performRAGSearch(supabase, session.user_id, message, aiConfig.api_key)
      ragContext = sourceDocuments.map(chunk => chunk.chunk_text).join('\n\n')
    }

    // 6. Generate AI response
    const { response, tokensUsed } = await generateAIResponse(
      aiConfig,
      message,
      conversationHistory,
      ragContext
    )

    // 7. Store AI response
    const assistantMessage = await storeMessage(
      supabase, 
      session.id, 
      'assistant', 
      response,
      {
        tokens_used: tokensUsed,
        model_used: aiConfig.model_name,
        confidence_score: calculateConfidence(sourceDocuments, message),
        sources_used: sourceDocuments.length
      }
    )

    // 8. Store RAG context if used
    if (use_rag && sourceDocuments.length > 0) {
      await storeRAGContext(supabase, assistantMessage.id, sourceDocuments, message)
    }

    // 9. Update session timestamp
    await updateSessionTimestamp(supabase, session.id)

    return new Response(
      JSON.stringify({
        success: true,
        response,
        message_id: assistantMessage.id,
        tokens_used: tokensUsed,
        sources_used: sourceDocuments.length,
        confidence: calculateConfidence(sourceDocuments, message)
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )

  } catch (error) {
    console.error('Chat completion error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})

async function getOrCreateSession(supabase: any, sessionId: string, senderId: string, senderType: string) {
  // First try to get existing session
  if (sessionId) {
    const { data: existing } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()
    
    if (existing) return existing
  }

  // Get user from auth header or create anonymous session
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id

  if (!userId) {
    throw new Error('Authentication required')
  }

  // Check if session exists for this sender
  const { data: existingBySender } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('sender_id', senderId)
    .eq('sender_type', senderType)
    .single()

  if (existingBySender) return existingBySender

  // Create new session
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: userId,
      sender_id: senderId,
      sender_type: senderType,
      session_metadata: {}
    })
    .select()
    .single()

  if (error) throw error
  return data
}

async function storeMessage(
  supabase: any,
  sessionId: string,
  role: string,
  content: string,
  metadata: Record<string, any> = {}
) {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      session_id: sessionId,
      role,
      content,
      metadata
    })
    .select()
    .single()

  if (error) throw error
  return data
}

async function getActiveAIConfiguration(supabase: any, userId: string): Promise<AIConfiguration | null> {
  const { data, error } = await supabase
    .from('ai_configurations')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (error || !data) return null
  return data
}

async function getConversationHistory(supabase: any, sessionId: string) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(20) // Last 20 messages

  if (error) return []
  return data || []
}

async function performRAGSearch(
  supabase: any,
  userId: string,
  query: string,
  apiKey: string
): Promise<DocumentChunk[]> {
  try {
    // Generate embedding for the query
    const openai = new OpenAI({ apiKey })
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query
    })
    
    const queryEmbedding = embeddingResponse.data[0].embedding

    // Perform vector similarity search
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: 10,
      user_id: userId
    })

    if (error) {
      console.error('RAG search error:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('RAG search failed:', error)
    return []
  }
}

async function generateAIResponse(
  aiConfig: AIConfiguration,
  userMessage: string,
  conversationHistory: any[],
  ragContext: string
): Promise<{ response: string; tokensUsed: number }> {
  const openai = new OpenAI({ apiKey: aiConfig.api_key })

  const systemPrompt = aiConfig.system_prompt || `You are Wacanda, an intelligent AI customer service assistant.

Your core capabilities:
- Provide accurate, helpful responses using the knowledge base context
- Maintain a professional yet friendly tone
- Escalate to human agents when needed
- Remember conversation context and refer to previous messages when relevant
- Always cite sources when using specific information from the knowledge base

Guidelines:
- If you're unsure about information, say so clearly
- Ask clarifying questions when needed
- Keep responses concise but complete
- Use the conversation history to maintain context
- If confidence is low, recommend human agent assistance`

  const messages = [
    { role: 'system', content: systemPrompt }
  ]

  // Add RAG context if available
  if (ragContext) {
    messages.push({
      role: 'system',
      content: `Context from knowledge base:\n${ragContext}`
    })
  }

  // Add conversation history
  conversationHistory.forEach(msg => {
    messages.push({ role: msg.role, content: msg.content })
  })

  // Add current user message
  messages.push({ role: 'user', content: userMessage })

  const completion = await openai.chat.completions.create({
    model: aiConfig.model_name,
    temperature: aiConfig.temperature,
    max_tokens: aiConfig.max_tokens,
    messages: messages as any
  })

  const response = completion.choices[0].message.content || ''
  const tokensUsed = completion.usage?.total_tokens || 0

  return { response, tokensUsed }
}

async function storeRAGContext(
  supabase: any,
  messageId: string,
  sourceDocuments: DocumentChunk[],
  retrievalQuery: string
) {
  const { error } = await supabase
    .from('rag_contexts')
    .insert({
      message_id: messageId,
      source_documents: sourceDocuments.map(doc => doc.source_id),
      similarity_scores: sourceDocuments.map(doc => doc.similarity),
      context_used: sourceDocuments.map(doc => doc.chunk_text).join('\n\n'),
      retrieval_query: retrievalQuery
    })

  if (error) {
    console.error('Failed to store RAG context:', error)
  }
}

async function updateSessionTimestamp(supabase: any, sessionId: string) {
  await supabase
    .from('chat_sessions')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', sessionId)
}

function calculateConfidence(sourceDocuments: DocumentChunk[], query: string): number {
  if (sourceDocuments.length === 0) return 0.3
  
  const avgSimilarity = sourceDocuments.reduce((sum, doc) => sum + doc.similarity, 0) / sourceDocuments.length
  return Math.min(avgSimilarity * 1.2, 1.0) // Boost slightly, cap at 1.0
} 