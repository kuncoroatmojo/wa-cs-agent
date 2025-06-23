import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://pfirjlhuulkchogjbvsv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testUpsertSyntax() {
  try {
    console.log('🔍 Testing upsert syntax options...');

    // Get an existing conversation
    const { data: conversations } = await supabase
      .from('conversations')
      .select('*')
      .limit(1);

    const conversation = conversations[0];
    console.log(`✅ Using conversation: ${conversation.id}`);

    const testMessage = {
      conversation_id: conversation.id,
      external_message_id: 'syntax_test_' + Date.now(),
      content: 'Test upsert syntax',
      message_type: 'text',
      direction: 'inbound',
      sender_type: 'contact',
      sender_name: 'Test User',
      sender_id: 'test@s.whatsapp.net',
      external_timestamp: new Date().toISOString(),
      external_metadata: { test: true },
      status: 'delivered'
    };

    // Test 1: Regular insert first
    console.log('\n1️⃣ Testing regular insert...');
    const { data: insertResult, error: insertError } = await supabase
      .from('conversation_messages')
      .insert([testMessage])
      .select();

    if (insertError) {
      console.error('❌ Insert failed:', insertError);
      return;
    } else {
      console.log('✅ Insert successful');
    }

    // Test 2: Try upsert with same external_message_id (should update)
    console.log('\n2️⃣ Testing upsert with existing external_message_id...');
    const updatedMessage = {
      ...testMessage,
      content: 'UPDATED: Test upsert syntax'
    };

    // Try different upsert syntaxes
    const syntaxOptions = [
      { onConflict: 'external_message_id' },
      { onConflict: 'external_message_id,external_message_id' },
      { ignoreDuplicates: false, onConflict: 'external_message_id' }
    ];

    for (let i = 0; i < syntaxOptions.length; i++) {
      const option = syntaxOptions[i];
      console.log(`\n   Option ${i + 1}: ${JSON.stringify(option)}`);
      
      const { data: upsertResult, error: upsertError } = await supabase
        .from('conversation_messages')
        .upsert([updatedMessage], option);

      if (upsertError) {
        console.error(`   ❌ Failed:`, upsertError.message);
      } else {
        console.log(`   ✅ Success`);
        break;
      }
    }

    // Test 3: Check database state
    console.log('\n3️⃣ Checking final database state...');
    const { data: finalCheck } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('external_message_id', testMessage.external_message_id);

    console.log(`📊 Found ${finalCheck?.length || 0} messages with external_message_id`);
    
    if (finalCheck?.length) {
      console.log(`📝 Content: "${finalCheck[0].content}"`);
      
      // Clean up
      await supabase
        .from('conversation_messages')
        .delete()
        .eq('external_message_id', testMessage.external_message_id);
      console.log('🗑️ Cleaned up test message');
    }

    // Test 4: Test insert without external_message_id
    console.log('\n4️⃣ Testing insert without external_message_id...');
    const messageWithoutExternal = {
      conversation_id: conversation.id,
      // No external_message_id
      content: 'Test without external ID',
      message_type: 'text',
      direction: 'inbound',
      sender_type: 'contact',
      sender_name: 'Test User',
      sender_id: 'test@s.whatsapp.net',
      external_timestamp: new Date().toISOString(),
      external_metadata: { test: true },
      status: 'delivered'
    };

    const { data: noExternalResult, error: noExternalError } = await supabase
      .from('conversation_messages')
      .insert([messageWithoutExternal])
      .select();

    if (noExternalError) {
      console.error('❌ Insert without external_message_id failed:', noExternalError);
    } else {
      console.log('✅ Insert without external_message_id successful');
      // Clean up
      await supabase
        .from('conversation_messages')
        .delete()
        .eq('id', noExternalResult[0].id);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

testUpsertSyntax();
