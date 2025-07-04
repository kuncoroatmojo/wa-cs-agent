import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllConversations() {
  try {
    console.log('🔍 Checking all conversations in the database...\n');

    // Get all conversations
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id, contact_name, contact_id, external_conversation_id, instance_key, integration_type, updated_at')
      .order('updated_at', { ascending: false })
      .limit(50); // Show the most recent 50

    if (convError) {
      throw convError;
    }

    console.log(`📊 Found ${conversations.length} conversations in total\n`);

    if (conversations.length === 0) {
      console.log('No conversations found in the database.');
      return;
    }

    // Group by contact name patterns
    const phoneNumberPattern = /^\+\d+$/;
    const conversationsWithNames = conversations.filter(conv => 
      conv.contact_name && !phoneNumberPattern.test(conv.contact_name)
    );
    const conversationsWithPhoneNumbers = conversations.filter(conv => 
      conv.contact_name && phoneNumberPattern.test(conv.contact_name)
    );
    const conversationsWithoutNames = conversations.filter(conv => !conv.contact_name);

    console.log('📈 Contact Name Analysis:');
    console.log(`   With actual names: ${conversationsWithNames.length}`);
    console.log(`   With phone numbers only: ${conversationsWithPhoneNumbers.length}`);
    console.log(`   Without contact names: ${conversationsWithoutNames.length}\n`);

    // Show conversations with actual names
    if (conversationsWithNames.length > 0) {
      console.log('👥 Conversations with actual names:');
      conversationsWithNames.forEach((conv, index) => {
        console.log(`   ${index + 1}. "${conv.contact_name}" (${conv.contact_id})`);
        console.log(`      Instance: ${conv.instance_key}, Type: ${conv.integration_type}`);
        console.log(`      Remote JID: ${conv.external_conversation_id}`);
        console.log(`      Updated: ${new Date(conv.updated_at).toLocaleString()}\n`);
      });
    }

    // Show a few examples of phone number conversations
    if (conversationsWithPhoneNumbers.length > 0) {
      console.log('📱 Sample phone number conversations:');
      conversationsWithPhoneNumbers.slice(0, 5).forEach((conv, index) => {
        console.log(`   ${index + 1}. "${conv.contact_name}" (${conv.contact_id})`);
        console.log(`      Instance: ${conv.instance_key}, Type: ${conv.integration_type}`);
      });
      console.log('');
    }

    // Get some message data for conversations with names to understand sender patterns
    if (conversationsWithNames.length > 0) {
      console.log('💬 Checking message patterns for named conversations...\n');
      
      for (const conv of conversationsWithNames.slice(0, 3)) { // Check first 3
        const { data: messages, error: msgError } = await supabase
          .from('conversation_messages')
          .select('sender_name, direction, external_metadata')
          .eq('conversation_id', conv.id)
          .limit(10);

        if (!msgError && messages && messages.length > 0) {
          console.log(`📝 Messages for "${conv.contact_name}":`);
          
          const inboundMessages = messages.filter(m => m.direction === 'inbound');
          const outboundMessages = messages.filter(m => m.direction === 'outbound');
          
          console.log(`   Inbound messages (from contact): ${inboundMessages.length}`);
          console.log(`   Outbound messages (from agent): ${outboundMessages.length}`);
          
          if (inboundMessages.length > 0) {
            const senderNames = [...new Set(inboundMessages
              .map(m => m.external_metadata?.pushName || m.sender_name)
              .filter(Boolean)
            )];
            console.log(`   Contact sender names: ${senderNames.join(', ')}`);
          }
          
          console.log('');
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the script
checkAllConversations(); 