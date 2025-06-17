import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WhatsAppConnectRequest {
  integration_id: string;
  action: 'connect' | 'disconnect' | 'status';
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

    const { integration_id, action = 'connect' }: WhatsAppConnectRequest = await req.json()

    console.log('WhatsApp connection request:', { integration_id, action })

    // Get the integration
    const { data: integration, error: integrationError } = await supabase
      .from('whatsapp_integrations')
      .select('*')
      .eq('id', integration_id)
      .single()

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ error: 'Integration not found' }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Route to appropriate handler
    switch (action) {
      case 'connect':
        return await handleConnect(supabase, integration)
      case 'disconnect':
        return await handleDisconnect(supabase, integration)
      case 'status':
        return await handleStatus(supabase, integration)
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
    }

  } catch (error) {
    console.error('WhatsApp connection error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})

async function handleConnect(supabase: any, integration: any): Promise<Response> {
  try {
    // Update status to connecting
    await supabase
      .from('whatsapp_integrations')
      .update({ status: 'connecting' })
      .eq('id', integration.id)

    if (integration.connection_type === 'cloud_api') {
      // WhatsApp Cloud API connection
      const result = await connectCloudAPI(integration)
      
      if (result.success) {
        await supabase
          .from('whatsapp_integrations')
          .update({
            status: 'connected',
            last_connected_at: new Date().toISOString()
          })
          .eq('id', integration.id)
      } else {
        await supabase
          .from('whatsapp_integrations')
          .update({ status: 'error' })
          .eq('id', integration.id)
      }

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )

    } else if (integration.connection_type === 'baileys') {
      // Baileys connection (WhatsApp Web)
      const result = await connectBaileys(supabase, integration)
      
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )

    } else {
      throw new Error('Unsupported connection type')
    }

  } catch (error) {
    // Update status to error
    await supabase
      .from('whatsapp_integrations')
      .update({ status: 'error' })
      .eq('id', integration.id)

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
}

async function handleDisconnect(supabase: any, integration: any): Promise<Response> {
  try {
    if (integration.connection_type === 'cloud_api') {
      // For Cloud API, just update status
      await supabase
        .from('whatsapp_integrations')
        .update({
          status: 'disconnected',
          qr_code: null
        })
        .eq('id', integration.id)

    } else if (integration.connection_type === 'baileys') {
      // For Baileys, clean up session
      await disconnectBaileys(supabase, integration)
    }

    return new Response(
      JSON.stringify({ success: true, status: 'disconnected' }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
}

async function handleStatus(supabase: any, integration: any): Promise<Response> {
  try {
    let status = integration.status
    let additional_info = {}

    if (integration.connection_type === 'cloud_api') {
      // Check Cloud API status
      const cloudStatus = await checkCloudAPIStatus(integration)
      status = cloudStatus.connected ? 'connected' : 'disconnected'
      additional_info = { phone_number: cloudStatus.phone_number }

    } else if (integration.connection_type === 'baileys') {
      // Check Baileys status
      const baileysStatus = await checkBaileysStatus(integration)
      status = baileysStatus.connected ? 'connected' : 'disconnected'
      additional_info = { qr_code: integration.qr_code }
    }

    // Update status in database if changed
    if (status !== integration.status) {
      await supabase
        .from('whatsapp_integrations')
        .update({ status })
        .eq('id', integration.id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        status,
        connection_type: integration.connection_type,
        last_connected: integration.last_connected_at,
        ...additional_info
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
}

async function connectCloudAPI(integration: any): Promise<{ success: boolean; error?: string }> {
  try {
    const { access_token, phone_number_id } = integration.credentials

    if (!access_token || !phone_number_id) {
      throw new Error('Missing Cloud API credentials')
    }

    // Verify the credentials by making a test API call
    const response = await fetch(`https://graph.facebook.com/v18.0/${phone_number_id}`, {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Cloud API error: ${error.error?.message || 'Unknown error'}`)
    }

    const phoneData = await response.json()
    console.log('Cloud API connected successfully:', phoneData.display_phone_number)

    return { success: true }

  } catch (error) {
    console.error('Cloud API connection failed:', error)
    return { success: false, error: error.message }
  }
}

async function connectBaileys(supabase: any, integration: any): Promise<{ success: boolean; qr_code?: string; error?: string }> {
  try {
    // For Baileys, we would initialize a WebSocket connection
    // This is a simplified version - in reality, you'd use the Baileys library
    
    // Generate a mock QR code for demonstration
    const qrCode = `whatsapp-qr-${integration.id}-${Date.now()}`
    
    // Update the QR code in the database
    await supabase
      .from('whatsapp_integrations')
      .update({
        qr_code: qrCode,
        status: 'connecting'
      })
      .eq('id', integration.id)

    // In a real implementation, you would:
    // 1. Initialize Baileys connection
    // 2. Generate actual QR code
    // 3. Handle scan events
    // 4. Update status based on connection state

    return {
      success: true,
      qr_code: qrCode
    }

  } catch (error) {
    console.error('Baileys connection failed:', error)
    return { success: false, error: error.message }
  }
}

async function disconnectBaileys(supabase: any, integration: any) {
  // Clean up Baileys session
  await supabase
    .from('whatsapp_integrations')
    .update({
      status: 'disconnected',
      qr_code: null
    })
    .eq('id', integration.id)

  // In a real implementation, you would close the WebSocket connection
  console.log('Baileys session disconnected')
}

async function checkCloudAPIStatus(integration: any): Promise<{ connected: boolean; phone_number?: string }> {
  try {
    const { access_token, phone_number_id } = integration.credentials

    const response = await fetch(`https://graph.facebook.com/v18.0/${phone_number_id}`, {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      return {
        connected: true,
        phone_number: data.display_phone_number
      }
    }

    return { connected: false }

  } catch (error) {
    console.error('Cloud API status check failed:', error)
    return { connected: false }
  }
}

async function checkBaileysStatus(integration: any): Promise<{ connected: boolean }> {
  // In a real implementation, you would check the WebSocket connection status
  // For now, we'll check based on the database status
  return {
    connected: integration.status === 'connected'
  }
} 