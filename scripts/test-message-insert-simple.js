#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testBasicInsertion() {
  try {
    console.log('🧪 Testing basic message insertion like webhook...');

    // Get a test conversation
    const { data: testConv } = await supabase
      .from('conversations')
      .select('id, user_id, contact_name')
      .limit(1)
      .single();

    if (!testConv) {
      console.log('⚠️ No conversations found to test with');
      return;
    }

    console.log(`📱 Using conversation: ${testConv.contact_name} (ID: ${testConv.id})`);

    // Use the exact structure from the webhook
    const testMessage = {
      conversation_id: testConv.id,
      content: 'Hello! This is a test message',
      message_type: 'text',
      direction: 'inbound',
      sender_type: 'contact',
      sender_name: 'Test Contact',
      sender_id: '1234567890@s.whatsapp.net',
      status: 'delivered',
      external_message_id: `TEST_MSG_${Date.now()}`,
      external_timestamp: new Date().toISOString(),
      external_metadata: { test: true, source: 'manual_test' }
    };

    console.log('📝 Inserting message with webhook structure...');
    const { data: result, error } = await supabase
      .from('conversation_messages')
      .insert(testMessage)
      .select();

    if (error) {
      console.log(`❌ Insertion failed: ${error.message}`);
      console.log('Error code:', error.code);
      console.log('Error details:', error.details);
      console.log('Error hint:', error.hint);
    } else {
      console.log('✅ Message inserted successfully!');
      console.log('Message ID:', result[0]?.id);
      console.log('Content:', result[0]?.content);
      
      // Now test the conversation update (like webhook does)
      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          message_count: (await supabase
            .from('conversation_messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', testConv.id)
            .then(res => res.count || 0)) + 1,
          last_message_at: new Date().toISOString(),
          last_message_preview: testMessage.content
        })
        .eq('id', testConv.id);

      if (updateError) {
        console.log('⚠️ Could not update conversation:', updateError.message);
      } else {
        console.log('✅ Conversation updated successfully');
      }
      
      // Clean up test message
      if (result[0]) {
        await supabase
          .from('conversation_messages')
          .delete()
          .eq('id', result[0].id);
        console.log('🧹 Test message cleaned up');
      }
    }

  } catch (err) {
    console.error('❌ Exception:', err);
  }
}

testBasicInsertion(); 