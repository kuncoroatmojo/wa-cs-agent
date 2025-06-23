#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testWithoutTriggers() {
  try {
    console.log('🧪 Testing message insertion by manually managing conversation updates...');

    // Get a test conversation
    const { data: testConv } = await supabase
      .from('conversations')
      .select('id, user_id, contact_name, message_count')
      .limit(1)
      .single();

    if (!testConv) {
      console.log('⚠️ No conversations found to test with');
      return;
    }

    console.log(`📱 Using conversation: ${testConv.contact_name} (ID: ${testConv.id})`);
    console.log(`📊 Current message count: ${testConv.message_count || 0}`);

    // Try a minimal message first
    const minimalMessage = {
      conversation_id: testConv.id,
      content: 'Simple test message',
      message_type: 'text',
      direction: 'inbound',
      sender_type: 'contact',
      status: 'delivered'
    };

    console.log('📝 Inserting minimal message first...');
    const { data: result1, error: error1 } = await supabase
      .from('conversation_messages')
      .insert(minimalMessage)
      .select();

    if (error1) {
      console.log(`❌ Minimal insertion failed: ${error1.message}`);
      console.log('This suggests the trigger itself is the problem');
      
      // Let's check if we can manually add the missing constraint
      console.log('\n🔧 Attempting to manually fix constraints via raw SQL...');
      
      // This is a workaround - we'll create the missing constraint
      const sqlFix = `
        ALTER TABLE conversation_analytics 
        ADD CONSTRAINT IF NOT EXISTS conversation_analytics_conversation_id_unique 
        UNIQUE (conversation_id);
        
        ALTER TABLE conversations 
        ADD COLUMN IF NOT EXISTS last_message_from TEXT;
      `;
      
      console.log('SQL to fix constraints:');
      console.log(sqlFix);
      console.log('\nYou need to run this SQL in Supabase SQL Editor or Dashboard');
      
    } else {
      console.log('✅ Minimal message inserted successfully!');
      console.log('Message ID:', result1[0]?.id);
      
      // Check if conversation was updated by the trigger
      const { data: updatedConv } = await supabase
        .from('conversations')
        .select('message_count, last_message_at, last_message_preview')
        .eq('id', testConv.id)
        .single();

      if (updatedConv) {
        console.log(`📊 Conversation updated - Message count: ${updatedConv.message_count}`);
        console.log(`📅 Last message at: ${updatedConv.last_message_at}`);
        console.log(`💬 Last message preview: ${updatedConv.last_message_preview}`);
      }
      
      // Now try with external_message_id
      const fullMessage = {
        conversation_id: testConv.id,
        content: 'Full test message with external ID',
        message_type: 'text',
        direction: 'inbound',
        sender_type: 'contact',
        sender_name: 'Test Contact',
        sender_id: '1234567890@s.whatsapp.net',
        status: 'delivered',
        external_message_id: `FULL_TEST_${Date.now()}`,
        external_timestamp: new Date().toISOString(),
        external_metadata: { test: true }
      };

      console.log('\n📝 Inserting full message with external_message_id...');
      const { data: result2, error: error2 } = await supabase
        .from('conversation_messages')
        .insert(fullMessage)
        .select();

      if (error2) {
        console.log(`❌ Full insertion failed: ${error2.message}`);
      } else {
        console.log('✅ Full message inserted successfully!');
        console.log('Message ID:', result2[0]?.id);
      }
      
      // Clean up test messages
      if (result1[0]) {
        await supabase.from('conversation_messages').delete().eq('id', result1[0].id);
      }
      if (result2?.[0]) {
        await supabase.from('conversation_messages').delete().eq('id', result2[0].id);
      }
      console.log('🧹 Test messages cleaned up');
    }

  } catch (err) {
    console.error('❌ Exception:', err);
  }
}

testWithoutTriggers(); 