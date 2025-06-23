import { createClient } from '@supabase/supabase-js';

// Get environment variables from command line
const SUPABASE_URL = process.argv[2];
const SUPABASE_SERVICE_ROLE_KEY = process.argv[3];

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Usage: node check-tables.js SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkTables() {
  try {
    console.log('📊 Checking table structures...\n');
    
    // Check messages table
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .limit(1);
    
    if (msgError) {
      console.error('Error checking messages table:', msgError);
    } else {
      console.log('Messages table columns:', messages && messages[0] ? Object.keys(messages[0]) : []);
    }
    
    // Check conversations table
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .limit(1);
    
    if (convError) {
      console.error('Error checking conversations table:', convError);
    } else {
      console.log('\nConversations table columns:', conversations && conversations[0] ? Object.keys(conversations[0]) : []);
    }
  } catch (error) {
    console.error('Error during check:', error);
    process.exit(1);
  }
}

checkTables()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
