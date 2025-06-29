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

async function fixWebhookConfig() {
  console.log('🔧 Fixing webhook configuration...');
  
  const webhookConfig = {
    webhook: {
      url: WEBHOOK_URL,
      enabled: true, // Enable the webhook
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
    }
  };

  try {
    const response = await fetch(`${EVOLUTION_API_URL}/webhook/set/${INSTANCE_NAME}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(webhookConfig)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Webhook configuration fixed:', JSON.stringify(result, null, 2));
      return true;
    } else {
      const error = await response.text();
      console.error('❌ Failed to fix webhook:', error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error fixing webhook:', error.message);
    return false;
  }
}

async function verifyWebhookConfig() {
  console.log('🔍 Verifying webhook configuration...');
  
  try {
    const response = await fetch(`${EVOLUTION_API_URL}/webhook/find/${INSTANCE_NAME}`, {
      method: 'GET',
      headers
    });

    if (response.ok) {
      const config = await response.json();
      console.log('✅ Current webhook configuration:', JSON.stringify(config, null, 2));
      
      // Check if properly configured
      const isConfigured = config.enabled && config.events && config.events.length > 0;
      console.log(`\n📊 Configuration Status:`);
      console.log(`  Enabled: ${config.enabled ? '✅' : '❌'}`);
      console.log(`  Events: ${config.events?.length || 0} configured`);
      console.log(`  URL: ${config.url}`);
      
      return isConfigured;
    } else {
      const error = await response.text();
      console.error('❌ Failed to get webhook config:', error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error checking webhook config:', error.message);
    return false;
  }
}

async function testWebhookWithSimulatedEvent() {
  console.log('🧪 Testing webhook with simulated event...');
  
  // Create a test event that simulates what Evolution API would send
  const testEvent = {
    event: 'MESSAGES_UPSERT',
    instance: INSTANCE_NAME,
    data: {
      key: {
        remoteJid: '6281234567890@s.whatsapp.net',
        fromMe: false,
        id: `test_webhook_${Date.now()}`
      },
      pushName: 'Webhook Test',
      message: {
        conversation: `Webhook test message sent at ${new Date().toLocaleString()}`
      },
      messageType: 'conversation',
      messageTimestamp: Math.floor(Date.now() / 1000)
    }
  };

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testEvent)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Webhook test successful:', result);
      return true;
    } else {
      const error = await response.text();
      console.error('❌ Webhook test failed:', error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing webhook:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Fixing Evolution API Webhook Configuration');
  console.log('='.repeat(50));
  
  // Step 1: Fix the webhook configuration
  const fixed = await fixWebhookConfig();
  if (!fixed) {
    console.log('\n❌ Failed to fix webhook configuration');
    return;
  }

  // Step 2: Verify the configuration
  console.log('\n🔍 Verifying configuration...');
  const verified = await verifyWebhookConfig();
  if (!verified) {
    console.log('\n❌ Webhook is still not properly configured');
    return;
  }

  // Step 3: Test the webhook endpoint
  console.log('\n🧪 Testing webhook endpoint...');
  const tested = await testWebhookWithSimulatedEvent();
  if (!tested) {
    console.log('\n❌ Webhook test failed');
    return;
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎉 Webhook is now properly configured and working!');
  console.log('\n📱 Next steps:');
  console.log('1. Send a real WhatsApp message to your instance');
  console.log('2. Check your Conversations page for real-time updates');
  console.log('3. Monitor Supabase Edge Function logs for webhook events');
  console.log('\n💡 Tip: You can view logs at:');
  console.log('https://supabase.com/dashboard/project/pfirjlhuulkchogjbvsv/functions');
}

if (require.main === module) {
  main();
}

module.exports = {
  fixWebhookConfig,
  verifyWebhookConfig,
  testWebhookWithSimulatedEvent
}; 