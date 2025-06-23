import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Read environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please ensure SUPABASE_URL and SUPABASE_ANON_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConversations() {
  console.log('📊 Checking conversations table...');

  // Check total count
  const { data: totalCount, error: countError } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Error checking conversations count:', countError);
    process.exit(1);
  }

  console.log(`Total conversations: ${totalCount?.count || 0}`);

  // Get sample conversations
  const { data: conversations, error } = await supabase
    .from('conversations')
    .select('*')
    .limit(5);

  if (error) {
    console.error('❌ Error fetching conversations:', error);
    process.exit(1);
  }

  if (conversations && conversations.length > 0) {
    console.log('\nSample conversations:');
    conversations.forEach(conv => {
      console.log(`- ${conv.id}: ${conv.contact_name || conv.contact_id} (${conv.integration_type})`);
    });
  } else {
    console.log('\n❌ No conversations found in the database');
  }

  // Check RLS policies
  const { data: policies, error: policyError } = await supabase
    .rpc('get_policies', { table_name: 'conversations' });

  if (policyError) {
    console.log('\n⚠️ Could not check RLS policies:', policyError);
  } else if (policies) {
    console.log('\nRLS Policies:', policies);
  }
}

checkConversations().catch(console.error); 