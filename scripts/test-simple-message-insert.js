#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testMessageInsertion() {
  try {
    console.log('🧪 Testing simple message insertion...');

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

    // Try inserting a simple message without any conflict handling
    const testMessage = {
      conversation_id: testConv.id,
      content: 'Test message - simple insertion',
      message_type: 'text',
      direction: 'inbound',
      sender_type: 'contact',
      sender_name: 'Test Contact',
      status: 'delivered',
      external_message_id: `test_simple_${Date.now()}`,
      external_timestamp: new Date().toISOString(),
      external_metadata: { test: true }
    };

    console.log('📝 Inserting message...');
    const { data: result, error } = await supabase
      .from('conversation_messages')
      .insert([testMessage])
      .select();

    if (error) {
      console.log(`❌ Insertion failed: ${error.message}`);
      console.log('Error details:', error);
      
      // Check what constraints exist on the table
      console.log('\n🔍 Let me check the table schema...');
      
      // Try to get table info (this might not work with service role)
      const { data: columns, error: schemaError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable')
        .eq('table_name', 'conversation_messages')
        .eq('table_schema', 'public');

      if (!schemaError && columns) {
        console.log('Table columns:');
        columns.forEach(col => {
          console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        });
      } else {
        console.log('Could not fetch schema info');
      }
      
    } else {
      console.log('✅ Message inserted successfully!');
      console.log('Message ID:', result[0]?.id);
      
      // Update conversation message count
      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          message_count: 1,
          last_message_at: new Date().toISOString(),
          last_message_preview: testMessage.content
        })
        .eq('id', testConv.id);

      if (updateError) {
        console.log('⚠️ Could not update conversation:', updateError.message);
      } else {
        console.log('✅ Conversation updated with message count');
      }
      
      // Clean up
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

testMessageInsertion(); 