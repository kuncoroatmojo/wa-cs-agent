const fetch = require('node-fetch');

const WEBHOOK_URL = 'https://pfirjlhuulkchogjbvsv.supabase.co/functions/v1/whatsapp-webhook';

async function testWebhook() {
  console.log('🧪 Testing webhook with simulated Evolution API event...');
  
  const testEvent = {
    event: 'MESSAGES_UPSERT',
    instance: 'istn',
    data: {
      key: {
        remoteJid: '6281234567890@s.whatsapp.net',
        fromMe: false,
        id: `test_webhook_${Date.now()}`
      },
      pushName: 'Webhook Test User',
      message: {
        conversation: `Test webhook message sent at ${new Date().toLocaleString()}`
      },
      messageType: 'conversation',
      messageTimestamp: Math.floor(Date.now() / 1000)
    }
  };

  try {
    console.log('📤 Sending test event:', JSON.stringify(testEvent, null, 2));
    
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testEvent)
    });

    const result = await response.text();
    
    console.log(`📨 Response status: ${response.status}`);
    console.log(`📨 Response body: ${result}`);
    
    if (response.ok) {
      console.log('✅ Webhook test successful!');
      console.log('🔍 Check your database for the test message');
      console.log('📱 Check your Conversations page for real-time updates');
      return true;
    } else {
      console.error('❌ Webhook test failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing webhook:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Simple Webhook Test');
  console.log('='.repeat(30));
  
  await testWebhook();
  
  console.log('\n💡 If the test was successful:');
  console.log('1. Go to your Conversations page');
  console.log('2. Look for a new conversation with "Webhook Test User"');
  console.log('3. The message should appear in real-time');
  console.log('\n🎉 Your webhook is now ready for real WhatsApp messages!');
}

if (require.main === module) {
  main();
}

module.exports = { testWebhook }; 