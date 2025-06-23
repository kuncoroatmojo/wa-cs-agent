import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  VITE_EVOLUTION_API_URL,
  VITE_EVOLUTION_API_KEY
} = process.env;

// Validate environment
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required Supabase environment variables');
  process.exit(1);
}

if (!VITE_EVOLUTION_API_URL || !VITE_EVOLUTION_API_KEY) {
  console.error('❌ Missing required Evolution API environment variables');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Evolution API headers
const evolutionApiHeaders = {
  'Content-Type': 'application/json',
  'apikey': VITE_EVOLUTION_API_KEY
};

async function fetchActiveInstances() {
  try {
    const response = await axios.get(`${VITE_EVOLUTION_API_URL}/instance/fetchInstances`, {
      headers: evolutionApiHeaders
    });
    return (response.data.instances || []).map(i => i.instanceName);
  } catch (error) {
    console.error('Error fetching instances:', error);
    return [];
  }
}

async function deleteConversationsForInstance(instanceKey) {
  try {
    // First delete messages
    const { error: msgError } = await supabase
      .from('messages')
      .delete()
      .eq('instance_key', instanceKey);

    if (msgError) {
      throw msgError;
    }

    // Then delete conversations
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .delete()
      .eq('instance_key', instanceKey)
      .select('id');

    if (convError) {
      throw convError;
    }

    return conversations?.length || 0;
  } catch (error) {
    console.error(`Error deleting conversations for instance ${instanceKey}:`, error);
    return 0;
  }
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
    const activeInstances = await fetchActiveInstances();
    console.log(`Found ${activeInstances.length} active instances in Evolution API`);

    // Find deleted instances
    const deletedInstances = uniqueInstanceKeys.filter(key => !activeInstances.includes(key));
    console.log(`Found ${deletedInstances.length} deleted instances to clean up:`, deletedInstances);

    // Clean up conversations for each deleted instance
    let totalDeleted = 0;
    for (const instanceKey of deletedInstances) {
      console.log(`\n🗑️ Cleaning up conversations for instance: ${instanceKey}`);
      const deletedCount = await deleteConversationsForInstance(instanceKey);
      totalDeleted += deletedCount;
      console.log(`Deleted ${deletedCount} conversations for instance ${instanceKey}`);
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
