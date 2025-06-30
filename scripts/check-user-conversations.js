import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://pfirjlhuulkchogjbvsv.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmaXJqbGh1dWxrY2hvZ2pidnN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI2MDk3MjMsImV4cCI6MjA0ODE4NTcyM30.VDbr9HgN29Qbe9w0TxZlcAT8YctOGqDSYoTlxE6p6og';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkUserConversations() {
  console.log('🔍 Checking user authentication and conversations...');

  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('❌ Auth error:', authError);
      console.log('💡 You need to be logged in. Try logging into the app first.');
      return;
    }

    if (!user) {
      console.log('❌ No authenticated user found');
      console.log('💡 You need to be logged in. Try logging into the app first.');
      return;
    }

    console.log(`✅ Authenticated user: ${user.id}`);
    console.log(`   Email: ${user.email}`);

    // Check all conversations (without user filter first)
    console.log('\n🔍 Checking all conversations in database...');
    const { data: allConversations, error: allError } = await supabase
      .from('conversations')
      .select('id, user_id, contact_id, contact_name, external_conversation_id, instance_key, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (allError) {
      console.error('❌ Error fetching all conversations:', allError);
    } else {
      console.log(`📋 Total conversations found: ${allConversations?.length || 0}`);
      
      if (allConversations && allConversations.length > 0) {
        allConversations.forEach((conv, index) => {
          console.log(`${index + 1}. Contact: ${conv.contact_id} (${conv.contact_name || 'N/A'})`);
          console.log(`   Conversation ID: ${conv.id}`);
          console.log(`   User ID: ${conv.user_id}`);
          console.log(`   External ID: ${conv.external_conversation_id || 'N/A'}`);
          console.log(`   Instance: ${conv.instance_key || 'N/A'}`);
          console.log(`   Created: ${new Date(conv.created_at).toLocaleString()}`);
          console.log(`   User Match: ${conv.user_id === user.id ? '✅ YES' : '❌ NO'}`);
          console.log('');
        });
      }
    }

    // Check conversations for the current user specifically
    console.log(`\n🎯 Checking conversations for current user: ${user.id}...`);
    const { data: userConversations, error: userError } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (userError) {
      console.error('❌ Error fetching user conversations:', userError);
    } else {
      console.log(`📋 Conversations for current user: ${userConversations?.length || 0}`);
      
      if (userConversations && userConversations.length > 0) {
        userConversations.forEach((conv, index) => {
          console.log(`${index + 1}. ${conv.contact_name || conv.contact_id}`);
          console.log(`   Last message: ${conv.last_message_preview || 'N/A'}`);
          console.log(`   Status: ${conv.status}`);
          console.log(`   Messages: ${conv.message_count}`);
        });
      } else {
        console.log('❌ No conversations found for current user');
        
        // Check if there are conversations with similar contact IDs but different user IDs
        console.log('\n🔍 Looking for conversations with contact 628111588698...');
        const { data: similarConversations, error: similarError } = await supabase
          .from('conversations')
          .select('id, user_id, contact_id, contact_name, external_conversation_id')
          .or('contact_id.like.%628111588698%,external_conversation_id.like.%628111588698%');

        if (similarError) {
          console.error('❌ Error checking similar conversations:', similarError);
        } else if (similarConversations && similarConversations.length > 0) {
          console.log(`🎯 Found ${similarConversations.length} conversations with this contact:`);
          similarConversations.forEach((conv, index) => {
            console.log(`${index + 1}. Contact: ${conv.contact_id}`);
            console.log(`   User ID: ${conv.user_id}`);
            console.log(`   Current User: ${user.id}`);
            console.log(`   Match: ${conv.user_id === user.id ? '✅ YES' : '❌ NO - THIS IS THE PROBLEM!'}`);
          });
        } else {
          console.log('No conversations found with this contact ID');
        }
      }
    }

    // Check WhatsApp instances
    console.log('\n🔍 Checking WhatsApp instances for current user...');
    const { data: instances, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('user_id', user.id);

    if (instanceError) {
      console.error('❌ Error fetching instances:', instanceError);
    } else {
      console.log(`📱 WhatsApp instances: ${instances?.length || 0}`);
      if (instances && instances.length > 0) {
        instances.forEach((instance, index) => {
          console.log(`${index + 1}. ${instance.instance_key} - ${instance.status}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkUserConversations(); 