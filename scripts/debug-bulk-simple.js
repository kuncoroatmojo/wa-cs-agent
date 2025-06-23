import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://pfirjlhuulkchogjbvsv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function debugBulkInsertion() {
  try {
    console.log('🔍 Debugging bulk message insertion...');

    // Get an existing conversation
    const { data: conversations } = await supabase
      .from('conversations')
      .select('*')
      .limit(1);

    if (!conversations?.length) {
      console.log('❌ No conversations found. Creating a test conversation first...');
      
      const { data: profiles } = await supabase.from('profiles').select('id').limit(1);
      const { data: instances } = await supabase.from('whatsapp_instances').select('*').limit(1);
      
      if (!profiles?.length || !instances?.length) {
        throw new Error('Missing profiles or instances');
      }
      
      const testConv = {
        user_id: profiles[0].id,
        integration_type: 'whatsapp',
        integration_id: instances[0].id,
        instance_key: 'personal',
        contact_id: 'test@s.whatsapp.net',
        contact_name: 'Test Contact',
        status: 'active',
        external_conversation_id: 'test@s.whatsapp.net',
        message_count: 0,
        last_message_at: new Date().toISOString(),
        contact_metadata: { isTest: true }
      };
      
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert(testConv)
        .select()
        .single();
        
      if (convError) {
        throw new Error(`Failed to create test conversation: ${convError.message}`);
      }
      
      conversations.push(newConv);
      console.log('✅ Created test conversation');
    }

    const conversation = conversations[0];
    console.log(`✅ Using conversation: ${conversation.id}`);

    // Create test messages with correct schema
    const testMessages = [
      {
        conversation_id: conversation.id,
        external_message_id: 'test_msg_1',
        content: 'Hello world',
        message_type: 'text',
        direction: 'inbound',
        sender_type: 'contact',
        sender_name: 'Test User',
        sender_id: 'test@s.whatsapp.net',
        external_timestamp: new Date().toISOString(),
        external_metadata: { test: true },
        status: 'delivered',
        rag_context_used: null,
        rag_sources: [],
        rag_similarity_scores: []
      },
      {
        conversation_id: conversation.id,
        external_message_id: 'test_msg_2',
        content: 'This is another test message',
        message_type: 'text',
        direction: 'outbound',
        sender_type: 'agent',
        sender_name: 'Agent',
        sender_id: 'agent',
        external_timestamp: new Date().toISOString(),
        external_metadata: { test: true },
        status: 'delivered',
        rag_context_used: null,
        rag_sources: [],
        rag_similarity_scores: []
      },
      {
        conversation_id: conversation.id,
        external_message_id: 'test_msg_3',
        content: '[Image]',
        message_type: 'image',
        direction: 'inbound',
        sender_type: 'contact',
        sender_name: 'Test User',
        sender_id: 'test@s.whatsapp.net',
        external_timestamp: new Date().toISOString(),
        external_metadata: { test: true, messageType: 'image' },
        status: 'delivered',
        rag_context_used: null,
        rag_sources: [],
        rag_similarity_scores: []
      }
    ];

    console.log(`\n📝 Testing with ${testMessages.length} messages...`);

    // Test 1: Single insert
    console.log('\n🧪 Testing single insert...');
    const { data: singleResult, error: singleError } = await supabase
      .from('conversation_messages')
      .insert([testMessages[0]])
      .select();

    if (singleError) {
      console.error('❌ Single insert failed:', singleError);
      console.error('Message data:', JSON.stringify(testMessages[0], null, 2));
      return;
    } else {
      console.log('✅ Single insert successful');
      // Clean up
      await supabase.from('conversation_messages').delete().eq('id', singleResult[0].id);
    }

    // Test 2: Bulk insert
    console.log('\n🚀 Testing bulk insert...');
    const { data: bulkResult, error: bulkError } = await supabase
      .from('conversation_messages')
      .insert(testMessages)
      .select();

    if (bulkError) {
      console.error('❌ Bulk insert failed:', bulkError);
      console.log('\n🔍 Analyzing error...');
      
      // Check for common issues
      testMessages.forEach((msg, idx) => {
        console.log(`Message ${idx + 1}:`);
        Object.keys(msg).forEach(key => {
          const value = msg[key];
          if (value === null || value === undefined) {
            console.log(`  ⚠️ ${key}: null/undefined`);
          } else if (typeof value === 'string' && value.length > 500) {
            console.log(`  📏 ${key}: ${value.length} chars (long)`);
          } else if (typeof value === 'object') {
            console.log(`  📦 ${key}: ${JSON.stringify(value).length} chars (object)`);
          }
        });
      });
      
      return;
    } else {
      console.log(`✅ Bulk insert successful: ${bulkResult.length} messages`);
      // Clean up
      const ids = bulkResult.map(m => m.id);
      await supabase.from('conversation_messages').delete().in('id', ids);
    }

    // Test 3: Bulk upsert (what the main script uses)
    console.log('\n🔄 Testing bulk upsert...');
    const { data: upsertResult, error: upsertError } = await supabase
      .from('conversation_messages')
      .upsert(testMessages, { onConflict: 'external_message_id' })
      .select();

    if (upsertError) {
      console.error('❌ Bulk upsert failed:', upsertError);
      console.error('Full error:', JSON.stringify(upsertError, null, 2));
      
      // Test upsert without .select()
      console.log('\n🔄 Testing upsert without select...');
      const { error: upsertNoSelectError } = await supabase
        .from('conversation_messages')
        .upsert(testMessages, { onConflict: 'external_message_id' });
        
      if (upsertNoSelectError) {
        console.error('❌ Upsert without select also failed:', upsertNoSelectError);
      } else {
        console.log('✅ Upsert without select succeeded');
        
        // Check if messages were actually inserted
        const { data: checkResult } = await supabase
          .from('conversation_messages')
          .select('*')
          .in('external_message_id', testMessages.map(m => m.external_message_id));
          
        console.log(`📊 Found ${checkResult?.length || 0} messages after upsert`);
        
        if (checkResult?.length) {
          // Clean up
          const ids = checkResult.map(m => m.id);
          await supabase.from('conversation_messages').delete().in('id', ids);
        }
      }
      
    } else {
      console.log(`✅ Bulk upsert successful: ${upsertResult.length} messages`);
      // Clean up
      const ids = upsertResult.map(m => m.id);
      await supabase.from('conversation_messages').delete().in('id', ids);
    }

    // Test 4: Check table constraints
    console.log('\n🔍 Checking table constraints...');
    
    // Try to insert invalid data to see what constraints exist
    const invalidMessage = {
      conversation_id: conversation.id,
      external_message_id: 'invalid_test',
      // missing required fields
    };
    
    const { error: constraintError } = await supabase
      .from('conversation_messages')
      .insert([invalidMessage]);
      
    if (constraintError) {
      console.log('📋 Constraint error (expected):', constraintError.message);
    }

    console.log('\n✅ Debug complete!');

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error('Full error:', error);
  }
}

debugBulkInsertion();
