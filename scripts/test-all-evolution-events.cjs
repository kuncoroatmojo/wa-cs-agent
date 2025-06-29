const axios = require('axios');

// Configuration
const WEBHOOK_URL = 'https://pfirjlhuulkchogjbvsv.supabase.co/functions/v1/whatsapp-webhook';
const INSTANCE_NAME = 'istn';

// Test all Evolution API webhook events
const eventTests = [
  // Core messaging events (already working)
  {
    name: 'MESSAGES_UPSERT - Text Message',
    event: 'MESSAGES_UPSERT',
    data: {
      key: {
        remoteJid: '6281234567890@s.whatsapp.net',
        fromMe: false,
        id: 'test_message_' + Date.now()
      },
      pushName: 'Test User',
      message: {
        conversation: 'Hello from webhook test!'
      },
      messageType: 'conversation',
      messageTimestamp: Math.floor(Date.now() / 1000)
    }
  },
  
  // Connection events
  {
    name: 'CONNECTION_UPDATE - Connected',
    event: 'CONNECTION_UPDATE',
    data: {
      state: 'open',
      connection: 'open',
      qr: null
    }
  },
  
  // Instance management events (newly added)
  {
    name: 'LOGOUT_INSTANCE',
    event: 'LOGOUT_INSTANCE',
    data: {
      reason: 'user_logout',
      timestamp: Date.now()
    }
  },
  
  {
    name: 'REMOVE_INSTANCE',
    event: 'REMOVE_INSTANCE',
    data: {
      reason: 'user_removal',
      timestamp: Date.now()
    }
  },
  
  // WhatsApp Business Labels (newly added)
  {
    name: 'LABELS_ASSOCIATION',
    event: 'LABELS_ASSOCIATION',
    data: {
      chatId: '6281234567890@s.whatsapp.net',
      labels: [
        { id: 'label_1', name: 'Customer Support', color: '#FF0000' },
        { id: 'label_2', name: 'VIP Customer', color: '#00FF00' }
      ]
    }
  },
  
  {
    name: 'LABELS_EDIT',
    event: 'LABELS_EDIT',
    data: {
      labelId: 'label_1',
      name: 'Premium Support',
      color: '#0000FF',
      action: 'update'
    }
  },
  
  // Typebot/AI integration events (newly added)
  {
    name: 'TYPEBOT_CHANGE_STATUS',
    event: 'TYPEBOT_CHANGE_STATUS',
    data: {
      status: 'active',
      typebotId: 'ai_assistant_v1',
      enabled: true,
      config: {
        autoReply: true,
        businessHours: true
      }
    }
  },
  
  {
    name: 'TYPEBOT_START',
    event: 'TYPEBOT_START',
    data: {
      typebotId: 'ai_assistant_v1',
      chatId: '6281234567890@s.whatsapp.net',
      trigger: 'user_message',
      flowId: 'welcome_flow'
    }
  },
  
  // Group events
  {
    name: 'GROUPS_UPSERT - Group Creation',
    event: 'GROUPS_UPSERT',
    data: {
      id: '120363123456789012@g.us',
      subject: 'Test Group',
      participants: [
        { id: '6281234567890@s.whatsapp.net', admin: 'admin' },
        { id: '6289876543210@s.whatsapp.net', admin: null }
      ],
      creation: Math.floor(Date.now() / 1000)
    }
  },
  
  {
    name: 'GROUP_PARTICIPANTS_UPDATE - Add Member',
    event: 'GROUP_PARTICIPANTS_UPDATE',
    data: {
      id: '120363123456789012@g.us',
      participants: ['6285555555555@s.whatsapp.net'],
      action: 'add'
    }
  },
  
  // Contact events
  {
    name: 'CONTACTS_UPSERT',
    event: 'CONTACTS_UPSERT',
    data: {
      id: '6281234567890@s.whatsapp.net',
      name: 'John Doe',
      pushName: 'John',
      verifiedName: 'John Doe Business'
    }
  },
  
  // Chat events
  {
    name: 'CHATS_UPSERT',
    event: 'CHATS_UPSERT',
    data: {
      id: '6281234567890@s.whatsapp.net',
      name: 'John Doe',
      unreadCount: 2,
      timestamp: Math.floor(Date.now() / 1000)
    }
  },
  
  // Presence events
  {
    name: 'PRESENCE_UPDATE - Online',
    event: 'PRESENCE_UPDATE',
    data: {
      id: '6281234567890@s.whatsapp.net',
      presences: {
        '6281234567890@s.whatsapp.net': {
          lastKnownPresence: 'available',
          lastSeen: Math.floor(Date.now() / 1000)
        }
      }
    }
  },
  
  // Application events
  {
    name: 'APPLICATION_STARTUP',
    event: 'APPLICATION_STARTUP',
    data: {
      version: '2.1.1',
      startTime: new Date().toISOString(),
      status: 'ready'
    }
  },
  
  // QR Code events
  {
    name: 'QRCODE_UPDATED',
    event: 'QRCODE_UPDATED',
    data: {
      qrcode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      base64: true
    }
  },
  
  // Call events
  {
    name: 'CALL - Incoming Voice Call',
    event: 'CALL',
    data: {
      from: '6281234567890@s.whatsapp.net',
      id: 'call_' + Date.now(),
      status: 'ringing',
      isVideo: false,
      isGroup: false
    }
  }
];

async function testWebhookEvent(eventTest) {
  try {
    console.log(`\n🧪 Testing: ${eventTest.name}`);
    
    const payload = {
      event: eventTest.event,
      instance: INSTANCE_NAME,
      data: eventTest.data
    };
    
    const response = await axios.post(WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    if (response.status === 200) {
      console.log(`✅ ${eventTest.name}: SUCCESS`);
      return true;
    } else {
      console.log(`❌ ${eventTest.name}: FAILED (${response.status})`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${eventTest.name}: ERROR - ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting comprehensive Evolution API webhook event tests...');
  console.log(`📡 Webhook URL: ${WEBHOOK_URL}`);
  console.log(`📱 Instance: ${INSTANCE_NAME}`);
  console.log(`📊 Total events to test: ${eventTests.length}`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const eventTest of eventTests) {
    const success = await testWebhookEvent(eventTest);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n📈 Test Results Summary:');
  console.log(`✅ Successful: ${successCount}/${eventTests.length}`);
  console.log(`❌ Failed: ${failCount}/${eventTests.length}`);
  console.log(`📊 Success Rate: ${((successCount / eventTests.length) * 100).toFixed(1)}%`);
  
  if (successCount === eventTests.length) {
    console.log('\n🎉 ALL TESTS PASSED! Your webhook handles all Evolution API events.');
  } else {
    console.log('\n⚠️ Some tests failed. Check the logs above for details.');
  }
}

// Run the tests
runAllTests().catch(console.error); 