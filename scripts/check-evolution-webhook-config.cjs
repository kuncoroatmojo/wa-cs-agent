const fetch = require('node-fetch');

// Configuration
const EVOLUTION_API_URL = 'https://evo.istn.ac.id';
const EVOLUTION_API_KEY = 'YGyPcZ5tn8RfmaATbP5ou9bOP4Usc7Pk4G0k04p9G7iNMpWqbNhga2FOl6T7ud26';
const INSTANCE_NAME = 'istn';
const SUPABASE_URL = 'https://pfirjlhuulkchogjbvsv.supabase.co';
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`;

const headers = {
  'Content-Type': 'application/json',
  'apikey': EVOLUTION_API_KEY
};

async function checkCurrentWebhookConfig() {
  console.log('🔍 Checking current webhook configuration...');
  
  try {
    const response = await fetch(`${EVOLUTION_API_URL}/webhook/find/${INSTANCE_NAME}`, {
      method: 'GET',
      headers
    });

    if (response.ok) {
      const config = await response.json();
      console.log('✅ Current webhook configuration:', JSON.stringify(config, null, 2));
      return config;
    } else {
      const error = await response.text();
      console.log('⚠️ No webhook configuration found or error:', error);
      return null;
    }
  } catch (error) {
    console.error('❌ Error checking webhook config:', error.message);
    return null;
  }
}

async function setWebhookConfig() {
  console.log('🔧 Setting up webhook configuration...');
  
  const webhookConfig = {
    url: WEBHOOK_URL,
    events: [
      'MESSAGES_UPSERT',
      'MESSAGES_UPDATE', 
      'MESSAGES_DELETE',
      'MESSAGES_SET',
      'CONNECTION_UPDATE',
      'QRCODE_UPDATED'
    ],
    webhook_by_events: false,
    webhook_base64: false
  };

  try {
    const response = await fetch(`${EVOLUTION_API_URL}/webhook/set/${INSTANCE_NAME}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(webhookConfig)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Webhook configured successfully:', JSON.stringify(result, null, 2));
      return true;
    } else {
      const error = await response.text();
      console.error('❌ Failed to set webhook:', error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error setting webhook:', error.message);
    return false;
  }
}

async function testWebhookEndpoint() {
  console.log('🧪 Testing webhook endpoint accessibility...');
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'OPTIONS'
    });
    
    if (response.ok) {
      console.log('✅ Webhook endpoint is accessible');
      return true;
    } else {
      console.error('❌ Webhook endpoint returned error:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Cannot reach webhook endpoint:', error.message);
    return false;
  }
}

async function sendTestMessage() {
  console.log('📱 Sending test message to trigger webhook...');
  
  const testMessage = {
    number: '6281234567890', // Test number
    text: `Test webhook message sent at ${new Date().toLocaleString()}`
  };

  try {
    const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(testMessage)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Test message sent:', JSON.stringify(result, null, 2));
      console.log('📨 This should trigger a MESSAGES_UPSERT webhook event');
      return true;
    } else {
      const error = await response.text();
      console.error('❌ Failed to send test message:', error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error sending test message:', error.message);
    return false;
  }
}

async function checkInstanceStatus() {
  console.log('📊 Checking instance status...');
  
  try {
    const response = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${INSTANCE_NAME}`, {
      method: 'GET',
      headers
    });

    if (response.ok) {
      const status = await response.json();
      console.log('✅ Instance status:', JSON.stringify(status, null, 2));
      return status.instance?.state === 'open';
    } else {
      const error = await response.text();
      console.error('❌ Failed to get instance status:', error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error checking instance status:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Evolution API Webhook Configuration Check');
  console.log('='.repeat(60));
  
  // Step 1: Check if webhook endpoint is accessible
  const endpointOk = await testWebhookEndpoint();
  if (!endpointOk) {
    console.log('\n❌ Webhook endpoint is not accessible. Please check your Supabase Edge Function deployment.');
    return;
  }

  // Step 2: Check instance status
  const instanceOk = await checkInstanceStatus();
  if (!instanceOk) {
    console.log('\n⚠️ Instance is not connected. Webhook events will not be sent until instance is connected.');
  }

  // Step 3: Check current webhook configuration
  const currentConfig = await checkCurrentWebhookConfig();
  
  // Step 4: Set up webhook if not configured or URL is different
  if (!currentConfig || currentConfig.url !== WEBHOOK_URL) {
    console.log('\n🔧 Setting up webhook configuration...');
    const configured = await setWebhookConfig();
    
    if (configured) {
      console.log('\n✅ Webhook configuration updated successfully!');
    } else {
      console.log('\n❌ Failed to configure webhook');
      return;
    }
  } else {
    console.log('\n✅ Webhook is already properly configured');
  }

  // Step 5: Send test message if instance is connected
  if (instanceOk) {
    console.log('\n📱 Instance is connected. Sending test message...');
    await sendTestMessage();
    
    console.log('\n⏱️ Wait a few seconds and check:');
    console.log('1. Supabase Edge Function logs');
    console.log('2. Your database for new messages');
    console.log('3. Your UI for real-time updates');
  }

  console.log('\n' + '='.repeat(60));
  console.log('📋 Summary:');
  console.log(`Webhook URL: ${WEBHOOK_URL}`);
  console.log(`Instance: ${INSTANCE_NAME}`);
  console.log(`Instance Connected: ${instanceOk ? '✅' : '❌'}`);
  console.log(`Webhook Configured: ${currentConfig ? '✅' : '❌'}`);
  
  if (instanceOk && currentConfig) {
    console.log('\n🎉 Everything looks good! Your webhook should be working.');
    console.log('Send a WhatsApp message to your instance to test real-time sync.');
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  checkCurrentWebhookConfig,
  setWebhookConfig,
  testWebhookEndpoint,
  sendTestMessage,
  checkInstanceStatus
}; 