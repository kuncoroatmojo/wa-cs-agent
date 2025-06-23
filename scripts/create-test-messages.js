#!/usr/bin/env node

/**
 * Create test messages for demonstrating RAG functionality
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pfirjlhuulkchogjbvsv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestMessages() {
  try {
    console.log('📝 Creating test messages for RAG demonstration...');

    // Get first few conversations
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .limit(3);

    if (convError) {
      throw new Error(`Failed to fetch conversations: ${convError.message}`);
    }

    if (!conversations || conversations.length === 0) {
      console.log('⚠️ No conversations found. Please create conversations first.');
      return;
    }

    console.log(`✅ Found ${conversations.length} conversations to add test messages to`);

    // Sample conversation messages for different scenarios
    const testMessages = [
      // Conversation 1: Customer Support
      {
        content: "Hi, I'm having trouble with my order. Can you help me?",
        direction: 'inbound',
        sender_type: 'contact',
        message_type: 'text'
      },
      {
        content: "Of course! I'd be happy to help you with your order. Could you please provide your order number?",
        direction: 'outbound',
        sender_type: 'bot',
        message_type: 'text'
      },
      {
        content: "My order number is #12345. I placed it yesterday but haven't received any updates.",
        direction: 'inbound',
        sender_type: 'contact',
        message_type: 'text'
      },
      {
        content: "Let me check that for you. I can see your order #12345 is currently being processed and will be shipped within 24 hours. You'll receive a tracking number via email once it's dispatched.",
        direction: 'outbound',
        sender_type: 'bot',
        message_type: 'text'
      },
      {
        content: "Great! Thank you for the quick response. When can I expect delivery?",
        direction: 'inbound',
        sender_type: 'contact',
        message_type: 'text'
      },
      {
        content: "Based on your location, you can expect delivery within 3-5 business days. Is there anything else I can help you with?",
        direction: 'outbound',
        sender_type: 'bot',
        message_type: 'text'
      }
    ];

    const techSupportMessages = [
      {
        content: "Hello, my app keeps crashing when I try to open the camera feature.",
        direction: 'inbound',
        sender_type: 'contact',
        message_type: 'text'
      },
      {
        content: "I'm sorry to hear about the camera issue. Let me help you troubleshoot this. Which device and operating system are you using?",
        direction: 'outbound',
        sender_type: 'bot',
        message_type: 'text'
      },
      {
        content: "I'm using iPhone 13 with iOS 17.2",
        direction: 'inbound',
        sender_type: 'contact',
        message_type: 'text'
      },
      {
        content: "Thank you for that information. This is a known issue with iOS 17.2. Please try the following steps: 1) Close the app completely, 2) Restart your iPhone, 3) Update to the latest app version from App Store.",
        direction: 'outbound',
        sender_type: 'bot',
        message_type: 'text'
      },
      {
        content: "I tried those steps but it's still crashing. Any other suggestions?",
        direction: 'inbound',
        sender_type: 'contact',
        message_type: 'text'
      },
      {
        content: "Let me escalate this to our technical team. Can you please send me a screenshot of the error message if any appears?",
        direction: 'outbound',
        sender_type: 'bot',
        message_type: 'text'
      },
      {
        content: "[Image]",
        direction: 'inbound',
        sender_type: 'contact',
        message_type: 'image'
      }
    ];

    const billingMessages = [
      {
        content: "I have a question about my recent bill. There's a charge I don't recognize.",
        direction: 'inbound',
        sender_type: 'contact',
        message_type: 'text'
      },
      {
        content: "I'll be happy to help you understand your bill. Could you please specify which charge you're concerned about?",
        direction: 'outbound',
        sender_type: 'bot',
        message_type: 'text'
      },
      {
        content: "There's a $25 service fee that wasn't there last month.",
        direction: 'inbound',
        sender_type: 'contact',
        message_type: 'text'
      },
      {
        content: "Let me check your account. The $25 service fee is for the premium features you activated on the 15th of last month. This includes priority support and advanced analytics.",
        direction: 'outbound',
        sender_type: 'bot',
        message_type: 'text'
      },
      {
        content: "Oh right, I forgot about that upgrade. Thanks for clarifying!",
        direction: 'inbound',
        sender_type: 'contact',
        message_type: 'text'
      }
    ];

    const messagesSets = [testMessages, techSupportMessages, billingMessages];

    // Add messages to each conversation
    for (let i = 0; i < Math.min(conversations.length, messagesSets.length); i++) {
      const conversation = conversations[i];
      const messages = messagesSets[i];

      console.log(`📝 Adding ${messages.length} messages to conversation: ${conversation.contact_name || conversation.contact_id}`);

      for (let j = 0; j < messages.length; j++) {
        const msg = messages[j];
        
        // Create realistic timestamps (spread over last 24 hours)
        const timestamp = new Date();
        timestamp.setHours(timestamp.getHours() - (messages.length - j) * 2);

        const messageData = {
          conversation_id: conversation.id,
          content: msg.content,
          message_type: msg.message_type,
          direction: msg.direction,
          sender_type: msg.sender_type,
          sender_name: msg.direction === 'inbound' ? conversation.contact_name || 'Customer' : 'Support Bot',
          sender_id: msg.direction === 'inbound' ? conversation.contact_id : 'bot',
          status: 'delivered',
          external_message_id: `test_msg_${Date.now()}_${j}`,
          external_timestamp: timestamp.toISOString(),
          metadata: {
            isTest: true,
            createdForRAGDemo: true
          }
        };

        const { error: msgError } = await supabase
          .from('conversation_messages')
          .insert(messageData);

        if (msgError) {
          console.error(`❌ Error inserting message ${j + 1}:`, msgError.message);
        }
      }

      console.log(`✅ Added ${messages.length} messages to conversation ${conversation.contact_id}`);
    }

    // Update conversation message counts
    console.log('🔄 Updating conversation statistics...');
    
    for (const conversation of conversations) {
      const { count } = await supabase
        .from('conversation_messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversation.id);

      const { data: lastMessage } = await supabase
        .from('conversation_messages')
        .select('content, sender_type, created_at')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const updateData = {
        message_count: count || 0,
        last_message_at: lastMessage?.created_at || new Date().toISOString(),
        last_message_preview: lastMessage?.content || null,
        last_message_from: lastMessage?.sender_type === 'contact' ? 'contact' : 'bot'
      };

      const { error: updateError } = await supabase
        .from('conversations')
        .update(updateData)
        .eq('id', conversation.id);

      if (updateError) {
        console.error(`❌ Error updating conversation ${conversation.id}:`, updateError.message);
      }
    }

    console.log('✅ Test messages created successfully!');
    console.log('\n📊 Summary:');
    console.log(`- Created messages for ${conversations.length} conversations`);
    console.log('- Message types: Customer support, Technical support, Billing inquiry');
    console.log('- Includes both text and image message types');
    console.log('- Demonstrates inbound/outbound conversation flow');
    console.log('\n🧠 Ready for RAG testing!');

  } catch (error) {
    console.error('❌ Failed to create test messages:', error);
    process.exit(1);
  }
}

createTestMessages(); 