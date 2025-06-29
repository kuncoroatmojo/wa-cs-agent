const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pfirjlhuulkchogjbvsv.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`;

// Test data - simulating Evolution API webhook events
const TEST_INSTANCE = 'istn';
const TEST_REMOTE_JID = '6281234567890@s.whatsapp.net';
const TEST_GROUP_JID = '120363154692865457@g.us';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test webhook events
const testEvents = {
  messageUpsert: {
    event: 'MESSAGES_UPSERT',
    instance: TEST_INSTANCE,
    data: {
      key: {
        remoteJid: TEST_REMOTE_JID,
        fromMe: false,
        id: `test_msg_${Date.now()}`
      },
      pushName: 'Test User',
      message: {
        conversation: 'Hello! This is a test message from webhook test.'
      },
      messageType: 'conversation',
      messageTimestamp: Math.floor(Date.now() / 1000)
    }
  },
  
  groupMessageUpsert: {
    event: 'MESSAGES_UPSERT',
    instance: TEST_INSTANCE,
    data: {
      key: {
        remoteJid: TEST_GROUP_JID,
        fromMe: false,
        id: `test_group_msg_${Date.now()}`
      },
      pushName: 'Group Test User',
      message: {
        conversation: 'Hello group! This is a test message in group chat.'
      },
      messageType: 'conversation',
      messageTimestamp: Math.floor(Date.now() / 1000),
      participant: TEST_REMOTE_JID
    }
  },

  messageUpdate: {
    event: 'MESSAGES_UPDATE',
    instance: TEST_INSTANCE,
    data: {
      key: {
        remoteJid: TEST_REMOTE_JID,
        fromMe: true,
        id: 'existing_msg_id'
      },
      status: 'READ'
    }
  },

  messageDelete: {
    event: 'MESSAGES_DELETE',
    instance: TEST_INSTANCE,
    data: {
      key: {
        remoteJid: TEST_REMOTE_JID,
        fromMe: false,
        id: 'msg_to_delete'
      }
    }
  }
};

async function sendWebhookEvent(event, description) {
  console.log(`\n🧪 Testing: ${description}`);
  console.log('📤 Sending webhook event:', JSON.stringify(event, null, 2));
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(event)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Webhook response:', result);
      return true;
    } else {
      console.error('❌ Webhook failed:', result);
      return false;
    }
  } catch (error) {
    console.error('❌ Error sending webhook:', error.message);
    return false;
  }
}

async function checkDatabaseUpdates(messageId, description) {
  console.log(`\n🔍 Checking database for: ${description}`);
  
  try {
    // Check if message was inserted
    const { data: message, error: msgError } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('external_message_id', messageId)
      .single();

    if (msgError) {
      console.log('⚠️ Message not found in database (might be expected for some tests)');
      return false;
    }

    console.log('✅ Message found in database:', {
      id: message.id,
      content: message.content,
      sender_type: message.sender_type,
      direction: message.direction,
      external_timestamp: message.external_timestamp
    });

    // Check if conversation was updated
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', message.conversation_id)
      .single();

    if (convError) {
      console.error('❌ Conversation not found:', convError);
      return false;
    }

    console.log('✅ Conversation updated:', {
      id: conversation.id,
      contact_name: conversation.contact_name,
      last_message_preview: conversation.last_message_preview,
      last_message_from: conversation.last_message_from,
      last_message_at: conversation.last_message_at
    });

    return true;
  } catch (error) {
    console.error('❌ Error checking database:', error.message);
    return false;
  }
}

async function testWebhookFlow() {
  console.log('🚀 Starting Evolution API Webhook Test');
  console.log('='.repeat(50));
  
  // Test 1: Individual message upsert
  console.log('\n📱 TEST 1: Individual Message Upsert');
  const success1 = await sendWebhookEvent(testEvents.messageUpsert, 'Individual message upsert');
  if (success1) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for processing
    await checkDatabaseUpdates(testEvents.messageUpsert.data.key.id, 'Individual message');
  }

  // Test 2: Group message upsert
  console.log('\n👥 TEST 2: Group Message Upsert');
  const success2 = await sendWebhookEvent(testEvents.groupMessageUpsert, 'Group message upsert');
  if (success2) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for processing
    await checkDatabaseUpdates(testEvents.groupMessageUpsert.data.key.id, 'Group message');
  }

  // Test 3: Message status update
  console.log('\n📝 TEST 3: Message Status Update');
  await sendWebhookEvent(testEvents.messageUpdate, 'Message status update');

  // Test 4: Message delete
  console.log('\n🗑️ TEST 4: Message Delete');
  await sendWebhookEvent(testEvents.messageDelete, 'Message delete');

  console.log('\n' + '='.repeat(50));
  console.log('🏁 Webhook tests completed!');
  console.log('\n📋 Manual Verification Steps:');
  console.log('1. Check your Conversations page in the UI');
  console.log('2. Look for new conversations with test messages');
  console.log('3. Verify conversation previews are updated');
  console.log('4. Check Supabase logs for webhook processing');
}

async function checkWebhookConfiguration() {
  console.log('🔧 Checking webhook configuration...');
  
  // Test webhook endpoint availability
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'OPTIONS'
    });
    
    if (response.ok) {
      console.log('✅ Webhook endpoint is accessible');
    } else {
      console.error('❌ Webhook endpoint not accessible');
      return false;
    }
  } catch (error) {
    console.error('❌ Cannot reach webhook endpoint:', error.message);
    return false;
  }

  // Check if we have required environment variables
  if (!SUPABASE_ANON_KEY) {
    console.error('❌ SUPABASE_ANON_KEY not found in environment');
    return false;
  }

  console.log('✅ Configuration looks good');
  return true;
}

async function showEvolutionWebhookSetup() {
  console.log('\n📖 Evolution API Webhook Setup Instructions:');
  console.log('='.repeat(50));
  console.log('1. Configure Evolution API webhook URL:');
  console.log(`   ${WEBHOOK_URL}`);
  console.log('\n2. Enable these webhook events:');
  console.log('   - MESSAGES_UPSERT');
  console.log('   - MESSAGES_UPDATE');
  console.log('   - MESSAGES_DELETE');
  console.log('   - MESSAGES_SET');
  console.log('   - CONNECTION_UPDATE');
  console.log('\n3. Example Evolution API webhook configuration:');
  console.log(`   POST /webhook/set/${TEST_INSTANCE}`);
  console.log('   {');
  console.log(`     "url": "${WEBHOOK_URL}",`);
  console.log('     "events": ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "MESSAGES_DELETE"]');
  console.log('   }');
}

// Main execution
async function main() {
  try {
    const configOk = await checkWebhookConfiguration();
    if (!configOk) {
      console.log('\n❌ Configuration issues found. Please fix them before testing.');
      return;
    }

    await showEvolutionWebhookSetup();
    
    console.log('\n🤔 Do you want to proceed with webhook tests?');
    console.log('This will send test webhook events to your endpoint.');
    
    // For automated testing, proceed directly
    await testWebhookFlow();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  sendWebhookEvent,
  checkDatabaseUpdates,
  testWebhookFlow
}; 