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

async function checkConversation() {
  console.log('🔍 Checking for conversation: 628111588698@s.whatsapp.net');

  try {
    // 1. Check if conversation exists
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .or(`external_conversation_id.eq.628111588698@s.whatsapp.net,contact_id.eq.628111588698`);

    if (convError) {
      console.error('❌ Error checking conversations:', convError);
      return;
    }

    console.log(`📋 Found ${conversations?.length || 0} conversations matching this contact`);
    
    if (conversations && conversations.length > 0) {
      conversations.forEach((conv, index) => {
        console.log(`\n${index + 1}. Conversation Details:`);
        console.log(`   ID: ${conv.id}`);
        console.log(`   User ID: ${conv.user_id}`);
        console.log(`   Contact ID: ${conv.contact_id}`);
        console.log(`   Contact Name: ${conv.contact_name || 'N/A'}`);
        console.log(`   External Conv ID: ${conv.external_conversation_id || 'N/A'}`);
        console.log(`   Integration Type: ${conv.integration_type}`);
        console.log(`   Integration ID: ${conv.integration_id || 'N/A'}`);
        console.log(`   Instance Key: ${conv.instance_key || 'N/A'}`);
        console.log(`   Status: ${conv.status}`);
        console.log(`   Message Count: ${conv.message_count}`);
        console.log(`   Last Message At: ${conv.last_message_at ? new Date(conv.last_message_at).toLocaleString() : 'N/A'}`);
        console.log(`   Last Message Preview: ${conv.last_message_preview || 'N/A'}`);
        console.log(`   Created At: ${new Date(conv.created_at).toLocaleString()}`);
        console.log(`   Updated At: ${new Date(conv.updated_at).toLocaleString()}`);
        console.log(`   Last Synced At: ${conv.last_synced_at ? new Date(conv.last_synced_at).toLocaleString() : 'N/A'}`);
        console.log(`   Sync Status: ${conv.sync_status}`);
      });

      // 2. Check messages for these conversations
      for (const conv of conversations) {
        console.log(`\n🔍 Checking messages for conversation ${conv.id}...`);
        
        const { data: messages, error: msgError } = await supabase
          .from('conversation_messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('external_timestamp', { ascending: false })
          .limit(5);

        if (msgError) {
          console.error(`❌ Error fetching messages for ${conv.id}:`, msgError);
          continue;
        }

        console.log(`📧 Found ${messages?.length || 0} messages in this conversation`);
        
        if (messages && messages.length > 0) {
          console.log('Recent messages:');
          messages.forEach((msg, index) => {
            console.log(`   ${index + 1}. ${msg.sender_type} (${msg.direction}): "${msg.content.substring(0, 50)}..."`);
            console.log(`      External ID: ${msg.external_message_id}`);
            console.log(`      Timestamp: ${msg.external_timestamp ? new Date(msg.external_timestamp).toLocaleString() : 'N/A'}`);
          });
        }
      }
    } else {
      console.log('❌ No conversations found for this contact');
      
      // Check if there are any messages with this contact ID
      console.log('\n🔍 Checking for orphaned messages...');
      const { data: orphanedMessages, error: msgError } = await supabase
        .from('conversation_messages')
        .select('*')
        .like('external_metadata', '%628111588698%')
        .limit(10);

      if (msgError) {
        console.error('❌ Error checking orphaned messages:', msgError);
      } else if (orphanedMessages && orphanedMessages.length > 0) {
        console.log(`📧 Found ${orphanedMessages.length} orphaned messages containing this contact ID`);
        orphanedMessages.forEach((msg, index) => {
          console.log(`   ${index + 1}. Conversation ID: ${msg.conversation_id}`);
          console.log(`      Content: "${msg.content.substring(0, 50)}..."`);
          console.log(`      External ID: ${msg.external_message_id}`);
        });
      } else {
        console.log('No orphaned messages found');
      }
    }

    // 3. Check recent conversation sync events
    console.log('\n🔍 Checking recent sync events...');
    const { data: syncEvents, error: syncError } = await supabase
      .from('conversation_sync_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (syncError) {
      console.error('❌ Error checking sync events:', syncError);
    } else if (syncEvents && syncEvents.length > 0) {
      console.log(`📊 Found ${syncEvents.length} recent sync events`);
      syncEvents.forEach((event, index) => {
        console.log(`   ${index + 1}. ${event.event_type} - ${event.processed ? 'Processed' : 'Pending'}`);
        console.log(`      Created: ${new Date(event.created_at).toLocaleString()}`);
        if (event.error_message) {
          console.log(`      Error: ${event.error_message}`);
        }
      });
    } else {
      console.log('No recent sync events found');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkConversation(); 