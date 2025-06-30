import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://pfirjlhuulkchogjbvsv.supabase.co';
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

async function checkAndFixConstraints() {
  console.log('🔍 Checking unique constraints in production...');

  try {
    // Check if the unique constraint exists
    const { data: constraints, error: constraintError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT 
            conname,
            contype,
            pg_get_constraintdef(oid) as definition
          FROM pg_constraint 
          WHERE conrelid = 'conversation_messages'::regclass 
          AND conname LIKE '%external_message_id%';
        `
      });

    if (constraintError) {
      console.error('❌ Error checking constraints:', constraintError);
      return;
    }

    console.log('📋 Current constraints:', constraints);

    // Test upsert functionality
    console.log('\n🧪 Testing upsert functionality...');
    
    const testMessageId = `test_constraint_${Date.now()}`;
    
    // Get a conversation to test with
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id')
      .limit(1);

    if (!conversations || conversations.length === 0) {
      console.error('❌ No conversations found to test with');
      return;
    }

    const conversationId = conversations[0].id;

    const testMessage = {
      conversation_id: conversationId,
      external_message_id: testMessageId,
      content: 'Test constraint message',
      message_type: 'text',
      direction: 'inbound',
      sender_type: 'contact',
      sender_name: 'Test User',
      sender_id: 'test@s.whatsapp.net',
      external_timestamp: new Date().toISOString(),
      external_metadata: { test: true },
      status: 'delivered'
    };

    // First insert
    console.log('1️⃣ Testing initial insert...');
    const { data: insertResult, error: insertError } = await supabase
      .from('conversation_messages')
      .insert([testMessage])
      .select();

    if (insertError) {
      console.error('❌ Insert failed:', insertError);
      return;
    }
    console.log('✅ Initial insert successful');

    // Test upsert
    console.log('2️⃣ Testing upsert with same external_message_id...');
    const updatedMessage = {
      ...testMessage,
      content: 'Updated test constraint message'
    };

    const { data: upsertResult, error: upsertError } = await supabase
      .from('conversation_messages')
      .upsert([updatedMessage], {
        onConflict: 'external_message_id'
      })
      .select();

    if (upsertError) {
      console.error('❌ Upsert failed:', upsertError);
      console.log('\n🔧 Attempting to fix constraint...');
      
      // Try to create the proper constraint
      const { error: fixError } = await supabase
        .rpc('exec_sql', {
          sql: `
            -- Drop existing constraint if it exists
            ALTER TABLE conversation_messages 
            DROP CONSTRAINT IF EXISTS conversation_messages_external_message_id_unique;
            
            -- Drop existing index if it exists
            DROP INDEX IF EXISTS conversation_messages_external_message_id_unique;
            
            -- Create proper unique constraint
            ALTER TABLE conversation_messages 
            ADD CONSTRAINT conversation_messages_external_message_id_unique 
            UNIQUE (external_message_id);
          `
        });

      if (fixError) {
        console.error('❌ Failed to fix constraint:', fixError);
        console.log('\n📋 Manual steps needed:');
        console.log('1. Go to Supabase Dashboard > Database > Tables > conversation_messages');
        console.log('2. Run this SQL in the SQL Editor:');
        console.log(`
          -- Drop existing constraint/index if exists
          ALTER TABLE conversation_messages 
          DROP CONSTRAINT IF EXISTS conversation_messages_external_message_id_unique;
          DROP INDEX IF EXISTS conversation_messages_external_message_id_unique;
          
          -- Create proper unique constraint
          ALTER TABLE conversation_messages 
          ADD CONSTRAINT conversation_messages_external_message_id_unique 
          UNIQUE (external_message_id);
        `);
      } else {
        console.log('✅ Constraint fixed! Testing upsert again...');
        
        const { data: retryResult, error: retryError } = await supabase
          .from('conversation_messages')
          .upsert([updatedMessage], {
            onConflict: 'external_message_id'
          })
          .select();

        if (retryError) {
          console.error('❌ Upsert still failing:', retryError);
        } else {
          console.log('✅ Upsert now working!');
        }
      }
    } else {
      console.log('✅ Upsert successful - constraint is working properly');
    }

    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await supabase
      .from('conversation_messages')
      .delete()
      .eq('external_message_id', testMessageId);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkAndFixConstraints(); 