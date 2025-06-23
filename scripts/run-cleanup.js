import { createClient } from '@supabase/supabase-js';

// Get environment variables from command line
const SUPABASE_URL = process.argv[2];
const SUPABASE_SERVICE_ROLE_KEY = process.argv[3];

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Usage: node run-cleanup.js SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runCleanup() {
  try {
    console.log('�� Starting cleanup...');
    
    // Get all instance keys from conversations
    const { data: instances, error: instanceError } = await supabase
      .from('conversations')
      .select('instance_key')
      .not('instance_key', 'is', null);
    
    if (instanceError) throw instanceError;
    
    const uniqueInstances = [...new Set(instances.map(i => i.instance_key).filter(Boolean))];
    console.log(`\nFound ${uniqueInstances.length} unique instances with conversations:`);
    console.log(uniqueInstances);
    
    // For each instance, delete its conversations
    let totalConversationsDeleted = 0;
    
    for (const instanceKey of uniqueInstances) {
      console.log(`\nProcessing instance: ${instanceKey}`);
      
      // Delete conversations
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .delete()
        .eq('instance_key', instanceKey)
        .select('id');
      
      if (convError) {
        console.error(`Error deleting conversations for ${instanceKey}:`, convError);
        continue;
      }
      
      totalConversationsDeleted += conversations?.length || 0;
      console.log(`Deleted ${conversations?.length || 0} conversations`);
    }
    
    console.log(`\n✅ Cleanup complete!`);
    console.log(`Total deleted: ${totalConversationsDeleted} conversations`);
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

runCleanup()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
