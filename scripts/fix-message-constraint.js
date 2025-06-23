#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fixConstraint() {
  try {
    console.log('🔧 Fixing external_message_id constraint...');

    // Test constraint by trying to insert a message with conflict handling
    const { data: testConv } = await supabase
      .from('conversations')
      .select('id, user_id')
      .limit(1)
      .single();

    if (!testConv) {
      console.log('⚠️ No conversations found to test with');
      return;
    }

    // Try inserting a test message without ON CONFLICT first
    const testMessageId = `test_${Date.now()}`;
    const testMessage = {
      conversation_id: testConv.id,
      content: 'Test message for constraint fix',
      message_type: 'text',
      direction: 'inbound',
      sender_type: 'contact',
      sender_name: 'Test Contact',
      status: 'delivered',
      external_message_id: testMessageId,
      external_timestamp: new Date().toISOString(),
      external_metadata: { test: true }
    };

    console.log('🧪 Testing message insertion without conflict handling...');
    const { data: insertResult, error: insertError } = await supabase
      .from('conversation_messages')
      .insert([testMessage])
      .select();

    if (insertError) {
      console.log(`❌ Regular insertion failed: ${insertError.message}`);
      console.log('This means there are other constraint issues');
      return;
    }

    console.log('✅ Regular message insertion successful');
    
    // Now test upsert with the same external_message_id
    console.log('🧪 Testing upsert with same external_message_id...');
    
    const updatedMessage = {
      ...testMessage,
      content: 'Updated test message content'
    };

    const { data: upsertResult, error: upsertError } = await supabase
      .from('conversation_messages')
      .upsert(updatedMessage, {
        onConflict: 'external_message_id'
      })
      .select();

    if (upsertError) {
      console.log(`❌ Upsert failed: ${upsertError.message}`);
      
      // Try creating the constraint manually
      console.log('🔧 Attempting to create unique constraint...');
      
      // First delete our test messages
      await supabase
        .from('conversation_messages')
        .delete()
        .eq('external_message_id', testMessageId);

      console.log('Constraint creation would need to be done via SQL admin interface');
      console.log('The constraint should be:');
      console.log('CREATE UNIQUE INDEX conversation_messages_external_message_id_unique ON conversation_messages(external_message_id) WHERE external_message_id IS NOT NULL;');
      
    } else {
      console.log('✅ Upsert with onConflict successful! Constraint is working');
      
      // Clean up test messages
      await supabase
        .from('conversation_messages')
        .delete()
        .eq('external_message_id', testMessageId);
      
      console.log('🧹 Test data cleaned up');
    }

    console.log('\n📋 Summary:');
    console.log('If upsert failed, you need to manually add the constraint in Supabase dashboard:');
    console.log('1. Go to Supabase Dashboard > Database > Tables > conversation_messages');
    console.log('2. Click on Indexes tab');
    console.log('3. Add unique index on external_message_id with WHERE external_message_id IS NOT NULL');

  } catch (error) {
    console.error('❌ Error during constraint fix:', error);
  }
}

fixConstraint(); 