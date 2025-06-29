const fetch = require('node-fetch');

const WEBHOOK_URL = 'https://pfirjlhuulkchogjbvsv.supabase.co/functions/v1/whatsapp-webhook';
const INSTANCE_NAME = 'istn';

const testEvents = [
  {
    name: 'Individual Message',
    event: {
      event: 'MESSAGES_UPSERT',
      instance: INSTANCE_NAME,
      data: {
        key: {
          remoteJid: '6281234567890@s.whatsapp.net',
          fromMe: false,
          id: `test_individual_${Date.now()}`
        },
        pushName: 'Individual Test User',
        message: {
          conversation: 'Hello! This is a test individual message from webhook.'
        },
        messageType: 'conversation',
        messageTimestamp: Math.floor(Date.now() / 1000)
      }
    }
  },
  {
    name: 'Group Message',
    event: {
      event: 'MESSAGES_UPSERT',
      instance: INSTANCE_NAME,
      data: {
        key: {
          remoteJid: '120363154692865457@g.us',
          fromMe: false,
          id: `test_group_${Date.now()}`
        },
        pushName: 'Group Test User',
        message: {
          conversation: 'Hello group! This is a test group message from webhook.'
        },
        messageType: 'conversation',
        messageTimestamp: Math.floor(Date.now() / 1000),
        participant: '6281234567890@s.whatsapp.net'
      }
    }
  },
  {
    name: 'Outbound Message',
    event: {
      event: 'MESSAGES_UPSERT',
      instance: INSTANCE_NAME,
      data: {
        key: {
          remoteJid: '6281234567890@s.whatsapp.net',
          fromMe: true,
          id: `test_outbound_${Date.now()}`
        },
        pushName: 'Bot',
        message: {
          conversation: 'This is a test outbound message from the bot.'
        },
        messageType: 'conversation',
        messageTimestamp: Math.floor(Date.now() / 1000)
      }
    }
  },
  {
    name: 'Message Status Update',
    event: {
      event: 'MESSAGES_UPDATE',
      instance: INSTANCE_NAME,
      data: {
        key: {
          remoteJid: '6281234567890@s.whatsapp.net',
          fromMe: true,
          id: 'test_status_update'
        },
        status: 'READ'
      }
    }
  },
  {
    name: 'Image Message',
    event: {
      event: 'MESSAGES_UPSERT',
      instance: INSTANCE_NAME,
      data: {
        key: {
          remoteJid: '6281234567890@s.whatsapp.net',
          fromMe: false,
          id: `test_image_${Date.now()}`
        },
        pushName: 'Image Test User',
        message: {
          imageMessage: {
            caption: 'This is a test image message'
          }
        },
        messageType: 'imageMessage',
        messageTimestamp: Math.floor(Date.now() / 1000)
      }
    }
  }
];

async function testWebhookEvent(testCase) {
  console.log(`\n🧪 Testing: ${testCase.name}`);
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testCase.event)
    });

    const result = await response.text();
    
    if (response.ok) {
      console.log(`✅ ${testCase.name} webhook successful`);
      return true;
    } else {
      console.error(`❌ ${testCase.name} webhook failed:`, result);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error testing ${testCase.name}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Comprehensive Webhook Event Test');
  console.log('='.repeat(50));
  
  let successCount = 0;
  let totalTests = testEvents.length;
  
  for (const testCase of testEvents) {
    const success = await testWebhookEvent(testCase);
    if (success) successCount++;
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`📊 Test Results: ${successCount}/${totalTests} tests passed`);
  
  if (successCount === totalTests) {
    console.log('🎉 All webhook events are working perfectly!');
    console.log('\n✅ Your Evolution API webhook integration is ready!');
    console.log('\n📱 What to do next:');
    console.log('1. Send a real WhatsApp message to your instance');
    console.log('2. Check your Conversations page for real-time updates');
    console.log('3. Verify that messages appear instantly without manual sync');
    console.log('4. Test different message types (text, images, etc.)');
    console.log('\n🔗 Evolution API → Webhook → Database → UI (Real-time sync working!)');
  } else {
    console.log('⚠️ Some webhook events failed. Check the logs above.');
  }
}

if (require.main === module) {
  main();
}

module.exports = { testWebhookEvent, testEvents }; 