import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TestIntegrationRequest {
  integration_id: string;
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

    const { integration_id }: TestIntegrationRequest = await req.json()

    console.log('Testing integration:', integration_id)

    // Get the integration
    const { data: integration, error: integrationError } = await supabase
      .from('external_integrations')
      .select('*')
      .eq('id', integration_id)
      .single()

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ success: false, error: 'Integration not found' }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Test based on integration type
    let testResult;
    switch (integration.integration_type) {
      case 'whatwut':
        testResult = await testWhatWutIntegration(integration)
        break
      case 'telegram':
        testResult = await testTelegramIntegration(integration)
        break
      case 'custom':
        testResult = await testCustomIntegration(integration)
        break
      default:
        testResult = await testGenericIntegration(integration)
    }

    // Log the test result
    await logTestResult(supabase, integration_id, testResult)

    return new Response(
      JSON.stringify({
        success: testResult.success,
        message: testResult.message,
        details: testResult.details,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error('Integration test error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})

async function testWhatWutIntegration(integration: any): Promise<TestResult> {
  try {
    const apiKey = integration.api_key || integration.settings?.api_key

    if (!apiKey) {
      return {
        success: false,
        message: 'Missing API key',
        details: { error: 'API key is required for WhatWut integration' }
      }
    }

    // Test WhatWut API connection
    // This would be the actual WhatWut API endpoint
    const testUrl = 'https://api.whatwut.com/v1/test' // Example URL
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const data = await response.json()
      return {
        success: true,
        message: 'WhatWut integration test successful',
        details: {
          status: response.status,
          response: data
        }
      }
    } else {
      const errorData = await response.text()
      return {
        success: false,
        message: 'WhatWut API connection failed',
        details: {
          status: response.status,
          error: errorData
        }
      }
    }

  } catch (error) {
    return {
      success: false,
      message: 'WhatWut integration test failed',
      details: { error: error.message }
    }
  }
}

async function testTelegramIntegration(integration: any): Promise<TestResult> {
  try {
    const botToken = integration.api_key || integration.settings?.bot_token

    if (!botToken) {
      return {
        success: false,
        message: 'Missing bot token',
        details: { error: 'Bot token is required for Telegram integration' }
      }
    }

    // Test Telegram Bot API
    const testUrl = `https://api.telegram.org/bot${botToken}/getMe`
    
    const response = await fetch(testUrl)
    const data = await response.json()

    if (data.ok) {
      return {
        success: true,
        message: 'Telegram bot integration test successful',
        details: {
          bot_info: {
            id: data.result.id,
            username: data.result.username,
            first_name: data.result.first_name
          }
        }
      }
    } else {
      return {
        success: false,
        message: 'Telegram bot API connection failed',
        details: {
          error_code: data.error_code,
          description: data.description
        }
      }
    }

  } catch (error) {
    return {
      success: false,
      message: 'Telegram integration test failed',
      details: { error: error.message }
    }
  }
}

async function testCustomIntegration(integration: any): Promise<TestResult> {
  try {
    const baseUrl = integration.settings?.base_url
    const apiKey = integration.api_key

    if (!baseUrl) {
      return {
        success: false,
        message: 'Missing base URL',
        details: { error: 'Base URL is required for custom integration' }
      }
    }

    // Test basic connectivity to the custom endpoint
    const testUrl = `${baseUrl}/health` // Common health check endpoint
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const response = await fetch(testUrl, {
      method: 'GET',
      headers
    })

    return {
      success: response.ok,
      message: response.ok 
        ? 'Custom integration endpoint is accessible'
        : 'Custom integration endpoint test failed',
      details: {
        status: response.status,
        url: testUrl,
        headers: Object.keys(headers)
      }
    }

  } catch (error) {
    return {
      success: false,
      message: 'Custom integration test failed',
      details: { error: error.message }
    }
  }
}

async function testGenericIntegration(integration: any): Promise<TestResult> {
  try {
    // Generic test for unknown integration types
    const webhookUrl = integration.webhook_url || integration.settings?.webhook_url

    if (!webhookUrl) {
      return {
        success: false,
        message: 'No webhook URL configured',
        details: { error: 'Webhook URL is required for testing' }
      }
    }

    // Test webhook endpoint with a ping
    const testPayload = {
      action: 'test',
      integration_key: integration.api_key,
      event_type: 'integration_test',
      data: {
        message: 'Integration test from Wacanda',
        timestamp: new Date().toISOString()
      }
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    })

    return {
      success: response.ok,
      message: response.ok 
        ? 'Webhook endpoint test successful'
        : 'Webhook endpoint test failed',
      details: {
        status: response.status,
        webhook_url: webhookUrl
      }
    }

  } catch (error) {
    return {
      success: false,
      message: 'Generic integration test failed',
      details: { error: error.message }
    }
  }
}

async function logTestResult(supabase: any, integrationId: string, result: TestResult) {
  try {
    await supabase
      .from('api_usage_logs')
      .insert({
        integration_id: integrationId,
        endpoint: 'test-integration',
        metadata: {
          test_result: result,
          test_type: 'integration_verification'
        }
      })
  } catch (error) {
    console.error('Failed to log test result:', error)
  }
}

interface TestResult {
  success: boolean;
  message: string;
  details: Record<string, any>;
} 