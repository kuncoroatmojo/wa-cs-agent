import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

interface ChatRequest {
  action: 'chat';
  integration_key: string;
  sender_id: string;
  sender_name?: string;
  message: string;
  platform?: string;
  metadata?: Record<string, any>;
}

interface WebhookRequest {
  action: 'webhook';
  integration_key: string;
  event_type: string;
  data: Record<string, any>;
}

interface StatusRequest {
  action: 'status';
  integration_key: string;
}

type ExternalAPIRequest = ChatRequest | WebhookRequest | StatusRequest;

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

    const body: ExternalAPIRequest = await req.json()
    const { action, integration_key } = body

    console.log('External API request:', { action, integration_key })

    // Authenticate the integration
    const integration = await authenticateIntegration(supabase, integration_key)
    if (!integration) {
      return new Response(
        JSON.stringify({ error: 'Invalid integration key' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Route to appropriate handler
    switch (action) {
      case 'chat':
        return await handleChatRequest(supabase, integration, body as ChatRequest)
      case 'webhook':
        return await handleWebhookRequest(supabase, integration, body as WebhookRequest)
      case 'status':
        return await handleStatusRequest(supabase, integration, body as StatusRequest)
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
    }

  } catch (error) {
    console.error('External API error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})

async function authenticateIntegration(supabase: any, integrationKey: string) {
  const { data, error } = await supabase
    .from('external_integrations')
    .select('*')
    .eq('api_key', integrationKey)
    .eq('is_active', true)
    .single()

  if (error) {
    console.error('Integration authentication error:', error)
    return null
  }

  return data
}

async function handleChatRequest(
  supabase: any,
  integration: any,
  request: ChatRequest
): Promise<Response> {
  const { sender_id, sender_name, message, platform = 'api', metadata = {} } = request

  try {
    // 1. Get or create chat session
    const session = await getOrCreateExternalSession(
      supabase,
      integration.user_id,
      sender_id,
      sender_name,
      integration.integration_type,
      platform,
      integration.name
    )

    // 2. Call chat completion
    const { data: chatResponse, error: chatError } = await supabase.functions.invoke('chat-completion', {
      body: {
        session_id: session.id,
        message: message,
        sender_id: sender_id,
        sender_type: integration.integration_type,
        use_rag: true
      }
    })

    if (chatError) {
      throw new Error('Failed to generate AI response')
    }

    // 3. Log the external API usage
    await logAPIUsage(supabase, integration.id, 'chat', {
      sender_id,
      message_length: message.length,
      tokens_used: chatResponse.tokens_used
    })

    return new Response(
      JSON.stringify({
        success: true,
        response: chatResponse.response,
        session_id: session.id,
        message_id: chatResponse.message_id,
        confidence: chatResponse.confidence,
        sources_used: chatResponse.sources_used,
        metadata: {
          tokens_used: chatResponse.tokens_used,
          response_time: Date.now()
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error('Chat request error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
}

async function handleWebhookRequest(
  supabase: any,
  integration: any,
  request: WebhookRequest
): Promise<Response> {
  const { event_type, data } = request

  try {
    // Store webhook event for processing
    const { error } = await supabase
      .from('webhook_events')
      .insert({
        integration_id: integration.id,
        event_type,
        data,
        processed: false
      })

    if (error) {
      throw new Error('Failed to store webhook event')
    }

    // Process specific webhook events
    await processWebhookEvent(supabase, integration, event_type, data)

    return new Response(
      JSON.stringify({ success: true, event_type }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error('Webhook request error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
}

async function handleStatusRequest(
  supabase: any,
  integration: any,
  request: StatusRequest
): Promise<Response> {
  try {
    // Get integration statistics
    const stats = await getIntegrationStats(supabase, integration.id)

    return new Response(
      JSON.stringify({
        success: true,
        integration: {
          id: integration.id,
          name: integration.name,
          type: integration.integration_type,
          is_active: integration.is_active,
          created_at: integration.created_at
        },
        stats
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error('Status request error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
}

async function getOrCreateExternalSession(
  supabase: any,
  userId: string,
  senderId: string,
  senderName: string | undefined,
  senderType: string,
  platform: string,
  integrationName: string
) {
  // Check if session exists
  const { data: existing } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('sender_id', senderId)
    .eq('sender_type', senderType)
    .single()

  if (existing) {
    return existing
  }

  // Create new session
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: userId,
      sender_id: senderId,
      sender_name: senderName || senderId,
      sender_type: senderType,
      session_metadata: {
        platform,
        integration_name: integrationName,
        source: 'external_api'
      }
    })
    .select()
    .single()

  if (error) throw error
  return data
}

async function processWebhookEvent(
  supabase: any,
  integration: any,
  eventType: string,
  data: any
) {
  // Process different types of webhook events
  switch (eventType) {
    case 'message_received':
      // Handle incoming messages from external platforms
      if (data.message && data.sender_id) {
        await handleChatRequest(supabase, integration, {
          action: 'chat',
          integration_key: integration.api_key,
          sender_id: data.sender_id,
          sender_name: data.sender_name,
          message: data.message,
          platform: data.platform || 'webhook'
        })
      }
      break
    
    case 'user_status_change':
      // Handle user status changes (online/offline, typing, etc.)
      console.log('User status change:', data)
      break
    
    case 'integration_test':
      // Test webhook endpoint
      console.log('Integration test webhook received')
      break
    
    default:
      console.log('Unhandled webhook event:', eventType, data)
  }
}

async function logAPIUsage(
  supabase: any,
  integrationId: string,
  endpoint: string,
  metadata: Record<string, any>
) {
  try {
    await supabase
      .from('api_usage_logs')
      .insert({
        integration_id: integrationId,
        endpoint,
        metadata,
        timestamp: new Date().toISOString()
      })
  } catch (error) {
    console.error('Failed to log API usage:', error)
    // Don't throw here to avoid breaking the main request
  }
}

async function getIntegrationStats(supabase: any, integrationId: string) {
  // Get basic integration statistics
  const [sessionsResult, messagesResult, usageResult] = await Promise.all([
    // Count active sessions
    supabase
      .from('chat_sessions')
      .select('id', { count: 'exact' })
      .eq('sender_type', 'external_api')
      .eq('is_active', true),
    
    // Count messages from last 24 hours
    supabase
      .from('chat_messages')
      .select('id', { count: 'exact' })
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    
    // Get API usage from last 24 hours
    supabase
      .from('api_usage_logs')
      .select('*')
      .eq('integration_id', integrationId)
      .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
  ])

  return {
    active_sessions: sessionsResult.count || 0,
    messages_24h: messagesResult.count || 0,
    api_calls_24h: usageResult.data?.length || 0,
    last_activity: new Date().toISOString()
  }
} 