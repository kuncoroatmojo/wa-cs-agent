import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WhatsAppMessage {
  from: string;
  body: string;
  timestamp: string;
  messageId: string;
  type: 'text' | 'image' | 'document' | 'audio';
  mediaUrl?: string;
}

interface WhatsAppWebhookPayload {
  instanceKey: string;
  message: WhatsAppMessage;
  metadata?: Record<string, any>;
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

    const webhookPayload: WhatsAppWebhookPayload = await req.json()
    const { instanceKey, message } = webhookPayload

    console.log('WhatsApp webhook received:', { instanceKey, from: message.from, messageId: message.messageId })

    // 1. Find the WhatsApp integration by instance key
    const { data: integration, error: integrationError } = await supabase
      .from('whatsapp_integrations')
      .select('*')
      .eq('instance_key', instanceKey)
      .eq('status', 'connected')
      .single()

    if (integrationError || !integration) {
      console.error('WhatsApp integration not found or not connected:', instanceKey)
      return new Response(
        JSON.stringify({ error: 'Integration not found or not connected' }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 2. Verify webhook authenticity (optional security measure)
    const webhookSecret = Deno.env.get('WEBHOOK_SECRET')
    if (webhookSecret) {
      const signature = req.headers.get('x-webhook-signature')
      // Add signature verification logic here if needed
    }

    // 3. Get or create chat session for this sender
    const { data: session, error: sessionError } = await getOrCreateWhatsAppSession(
      supabase,
      integration.user_id,
      message.from,
      integration.name
    )

    if (sessionError || !session) {
      throw new Error('Failed to create or get session')
    }

    // 4. Skip processing if it's not a text message for now
    if (message.type !== 'text') {
      console.log('Skipping non-text message:', message.type)
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'non-text message' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 5. Call chat completion to generate AI response
    const { data: chatResponse, error: chatError } = await supabase.functions.invoke('chat-completion', {
      body: {
        session_id: session.id,
        message: message.body,
        sender_id: message.from,
        sender_type: 'whatsapp',
        use_rag: true
      }
    })

    if (chatError) {
      console.error('Chat completion failed:', chatError)
      throw new Error('Failed to generate AI response')
    }

    // 6. Send response back to WhatsApp
    const whatsappResponse = await sendWhatsAppMessage(
      integration,
      message.from,
      chatResponse.response
    )

    // 7. Update integration last activity
    await supabase
      .from('whatsapp_integrations')
      .update({ last_connected_at: new Date().toISOString() })
      .eq('id', integration.id)

    return new Response(
      JSON.stringify({
        success: true,
        session_id: session.id,
        response_sent: whatsappResponse.success,
        message_id: chatResponse.message_id
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error('WhatsApp webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})

async function getOrCreateWhatsAppSession(
  supabase: any,
  userId: string,
  phoneNumber: string,
  integrationName: string
) {
  // Check if session exists for this phone number
  const { data: existing } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('sender_id', phoneNumber)
    .eq('sender_type', 'whatsapp')
    .single()

  if (existing) {
    return { data: existing, error: null }
  }

  // Create new session
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: userId,
      sender_id: phoneNumber,
      sender_name: phoneNumber, // Will be updated with contact name if available
      sender_type: 'whatsapp',
      session_metadata: {
        integration_name: integrationName,
        platform: 'whatsapp'
      }
    })
    .select()
    .single()

  return { data, error }
}

async function sendWhatsAppMessage(
  integration: any,
  to: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // This would integrate with actual WhatsApp API
    // For now, we'll simulate the response
    
    if (integration.connection_type === 'cloud_api') {
      // WhatsApp Cloud API integration
      return await sendWhatsAppCloudAPI(integration, to, message)
    } else if (integration.connection_type === 'baileys') {
      // Baileys integration (for local WhatsApp Web)
      return await sendWhatsAppBaileys(integration, to, message)
    }

    throw new Error('Unsupported WhatsApp connection type')
  } catch (error) {
    console.error('Failed to send WhatsApp message:', error)
    return { success: false, error: error.message }
  }
}

async function sendWhatsAppCloudAPI(
  integration: any,
  to: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const accessToken = integration.credentials?.access_token
  const phoneNumberId = integration.credentials?.phone_number_id

  if (!accessToken || !phoneNumberId) {
    throw new Error('Missing WhatsApp Cloud API credentials')
  }

  const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace('+', ''),
      type: 'text',
      text: { body: message }
    })
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(`WhatsApp API error: ${result.error?.message || 'Unknown error'}`)
  }

  return {
    success: true,
    messageId: result.messages?.[0]?.id
  }
}

async function sendWhatsAppBaileys(
  integration: any,
  to: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // This would integrate with a Baileys WebSocket connection
  // For now, we'll return a simulated response
  console.log('Baileys integration not yet implemented')
  
  return {
    success: true,
    messageId: `baileys_${Date.now()}`
  }
} 