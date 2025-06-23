import { createClient } from '@supabase/supabase-js';
import { Database } from '../src/types/database';
import { EvolutionApiService } from '../src/services/evolutionApiService';
import { ConversationService } from '../src/services/conversationService';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create a standalone Supabase client for this script
const supabase = createClient<Database>(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Create services with the standalone client
const evolutionApiService = new EvolutionApiService();
const conversationService = new ConversationService();

// Validate environment
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!process.env.VITE_EVOLUTION_API_URL || !process.env.VITE_EVOLUTION_API_KEY) {
  console.error('❌ Missing required environment variables: VITE_EVOLUTION_API_URL, VITE_EVOLUTION_API_KEY');
  process.exit(1);
}

async function cleanupDeletedInstances() {
  try {
    console.log('🧹 Starting cleanup of deleted instances...');

    // Get all instance_keys from conversations
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('instance_key')
      .not('instance_key', 'is', null);

    if (convError) {
      throw convError;
    }

    // Get unique instance keys
    const uniqueInstanceKeys = [...new Set(conversations?.map(c => c.instance_key).filter(Boolean))];
    console.log(`Found ${uniqueInstanceKeys.length} unique instance keys in conversations`);

    // Get all active instances from Evolution API
    const activeInstances = await evolutionApiService.fetchInstances();
    const activeInstanceNames = new Set(activeInstances.map(i => i.instanceName));

    console.log(`Found ${activeInstances.length} active instances in Evolution API`);

    // Find deleted instances
    const deletedInstances = uniqueInstanceKeys.filter(key => !activeInstanceNames.has(key));

    console.log(`Found ${deletedInstances.length} deleted instances to clean up:`, deletedInstances);

    // Clean up conversations for each deleted instance
    let totalDeleted = 0;
    for (const instanceKey of deletedInstances) {
      console.log(`\n🗑️ Cleaning up conversations for instance: ${instanceKey}`);
      const deletedCount = await conversationService.deleteInstanceConversations(instanceKey);
      totalDeleted += deletedCount;
    }

    console.log(`\n✅ Cleanup complete! Deleted conversations from ${deletedInstances.length} instances (${totalDeleted} conversations total)`);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupDeletedInstances()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }); 