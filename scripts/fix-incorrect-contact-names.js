import { createClient } from '@supabase/supabase-js';
import readline from 'readline';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixIncorrectContactNames() {
  try {
    console.log('🔍 Analyzing conversations for incorrect contact names...\n');

    // Get all conversations
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id, contact_name, contact_id, external_conversation_id, instance_key')
      .eq('integration_type', 'whatsapp')
      .not('contact_name', 'like', '+%') // Exclude phone numbers (those are probably fine)
      .order('updated_at', { ascending: false });

    if (convError) {
      throw convError;
    }

    console.log(`📊 Found ${conversations.length} conversations with named contacts\n`);

    const conversationsToFix = [];
    const possibleInstanceOwnerNames = new Set();

    // Analyze each conversation
    for (const conv of conversations) {
      // Get messages for this conversation, particularly from the contact
      const { data: contactMessages, error: msgError } = await supabase
        .from('conversation_messages')
        .select('sender_name, direction, external_metadata')
        .eq('conversation_id', conv.id)
        .eq('direction', 'inbound') // Messages from contact
        .not('sender_name', 'is', null)
        .limit(5);

      if (msgError) {
        console.error(`❌ Error fetching messages for conversation ${conv.id}:`, msgError);
        continue;
      }

      if (contactMessages && contactMessages.length > 0) {
        // Get actual contact names from messages
        const contactNamesFromMessages = contactMessages
          .map(msg => {
            // Try to get pushName from external_metadata
            const pushName = msg.external_metadata?.pushName;
            return pushName || msg.sender_name;
          })
          .filter(name => name && name !== 'Unknown' && name !== conv.contact_name)
          .filter((name, index, arr) => arr.indexOf(name) === index); // Unique names

        if (contactNamesFromMessages.length > 0) {
          const correctContactName = contactNamesFromMessages[0];
          
          // If the stored contact name is different from what we found in messages,
          // this might be an incorrect contact name
          if (conv.contact_name !== correctContactName) {
            console.log(`🔍 Conversation ${conv.id}:`);
            console.log(`   Stored name: "${conv.contact_name}"`);
            console.log(`   Messages show: "${correctContactName}"`);
            console.log(`   Remote JID: ${conv.external_conversation_id}`);
            
            conversationsToFix.push({
              ...conv,
              correctContactName
            });
            
            // Track possible instance owner names
            possibleInstanceOwnerNames.add(conv.contact_name);
          }
        }
      }
    }

    console.log(`\n📈 Analysis Results:`);
    console.log(`   Total conversations analyzed: ${conversations.length}`);
    console.log(`   Conversations with potential incorrect names: ${conversationsToFix.length}`);
    console.log(`   Possible instance owner names found: ${Array.from(possibleInstanceOwnerNames).join(', ')}\n`);

    if (conversationsToFix.length === 0) {
      console.log('✅ No conversations found with incorrect contact names!');
      return;
    }

    // Ask for confirmation before fixing
    console.log('🔧 Would you like to fix these conversations? (y/N)');
    
    // For automated execution, you can uncomment the next line and comment out the prompt
    // const shouldFix = 'y';
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const shouldFix = await new Promise(resolve => {
      rl.question('', (answer) => {
        rl.close();
        resolve(answer.toLowerCase());
      });
    });

    if (shouldFix !== 'y' && shouldFix !== 'yes') {
      console.log('❌ Aborted. No changes made.');
      return;
    }

    console.log('\n🔧 Fixing contact names...\n');

    let fixedCount = 0;
    for (const conv of conversationsToFix) {
      try {
        const { error: updateError } = await supabase
          .from('conversations')
          .update({
            contact_name: conv.correctContactName,
            updated_at: new Date().toISOString()
          })
          .eq('id', conv.id);

        if (updateError) {
          console.error(`❌ Failed to update conversation ${conv.id}:`, updateError);
        } else {
          console.log(`✅ Fixed: "${conv.contact_name}" → "${conv.correctContactName}"`);
          fixedCount++;
        }
      } catch (error) {
        console.error(`❌ Error updating conversation ${conv.id}:`, error);
      }
    }

    console.log(`\n🎉 Successfully fixed ${fixedCount} out of ${conversationsToFix.length} conversations!`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the script
fixIncorrectContactNames(); 