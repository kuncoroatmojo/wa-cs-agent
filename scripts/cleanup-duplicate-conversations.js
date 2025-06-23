import { createClient } from '@supabase/supabase-js';

// Get environment variables from command line or environment
const SUPABASE_URL = process.env.SUPABASE_URL || process.argv[2];
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.argv[3];

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Usage: node cleanup-duplicate-conversations.js [SUPABASE_URL] [SUPABASE_SERVICE_ROLE_KEY]');
  console.error('Or set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function findDuplicateConversations() {
  try {
    console.log('🔍 Finding duplicate conversations based on external_conversation_id and instance_key...');
    
    // Get all conversations with external_conversation_id and instance_key
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('id, external_conversation_id, instance_key, contact_name, created_at, updated_at')
      .not('external_conversation_id', 'is', null)
      .not('instance_key', 'is', null)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    console.log(`📊 Found ${conversations.length} conversations with external IDs`);

    // Group by external_conversation_id + instance_key
    const groupedConversations = new Map();
    
    conversations.forEach(conv => {
      const key = `${conv.external_conversation_id}:${conv.instance_key}`;
      if (!groupedConversations.has(key)) {
        groupedConversations.set(key, []);
      }
      groupedConversations.get(key).push(conv);
    });

    // Find duplicates
    const duplicates = [];
    let totalDuplicates = 0;

    groupedConversations.forEach((convs, key) => {
      if (convs.length > 1) {
        duplicates.push({
          key,
          conversations: convs,
          count: convs.length
        });
        totalDuplicates += convs.length - 1; // Keep one, remove the rest
      }
    });

    if (duplicates.length === 0) {
      console.log('✅ No duplicate conversations found!');
      return;
    }

    console.log(`\n⚠️ Found ${duplicates.length} sets of duplicate conversations (${totalDuplicates} duplicates total):`);
    
    duplicates.forEach((dup, index) => {
      const [externalId, instanceKey] = dup.key.split(':');
      console.log(`\n${index + 1}. External ID: ${externalId} | Instance: ${instanceKey}`);
      console.log(`   ${dup.count} conversations found:`);
      
      dup.conversations.forEach((conv, idx) => {
        console.log(`   ${idx + 1}. ID: ${conv.id} | Name: ${conv.contact_name || 'Unknown'} | Created: ${new Date(conv.created_at).toLocaleString()}`);
      });
    });

    return duplicates;
  } catch (error) {
    console.error('❌ Error finding duplicates:', error);
    throw error;
  }
}

async function cleanupDuplicates(duplicates, dryRun = true) {
  if (!duplicates || duplicates.length === 0) {
    console.log('No duplicates to clean up');
    return;
  }

  let totalDeleted = 0;
  const errors = [];

  for (const dup of duplicates) {
    try {
      // Keep the oldest conversation (first in the array since we sorted by created_at)
      const [keepConv, ...deleteConvs] = dup.conversations;
      
      console.log(`\n🧹 Processing duplicate set: ${dup.key}`);
      console.log(`   Keeping: ${keepConv.id} (${keepConv.contact_name || 'Unknown'}) - ${new Date(keepConv.created_at).toLocaleString()}`);
      
      for (const deleteConv of deleteConvs) {
        console.log(`   ${dryRun ? 'Would delete' : 'Deleting'}: ${deleteConv.id} (${deleteConv.contact_name || 'Unknown'}) - ${new Date(deleteConv.created_at).toLocaleString()}`);
        
        if (!dryRun) {
          // First, move messages from duplicate conversation to the one we're keeping
          const { error: moveError } = await supabase
            .from('conversation_messages')
            .update({ conversation_id: keepConv.id })
            .eq('conversation_id', deleteConv.id);

          if (moveError) {
            console.error(`     ❌ Error moving messages: ${moveError.message}`);
            errors.push(`Failed to move messages from ${deleteConv.id}: ${moveError.message}`);
            continue;
          }

          // Then delete the duplicate conversation
          const { error: deleteError } = await supabase
            .from('conversations')
            .delete()
            .eq('id', deleteConv.id);

          if (deleteError) {
            console.error(`     ❌ Error deleting conversation: ${deleteError.message}`);
            errors.push(`Failed to delete conversation ${deleteConv.id}: ${deleteError.message}`);
          } else {
            console.log(`     ✅ Successfully deleted conversation ${deleteConv.id}`);
            totalDeleted++;
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error processing duplicate set ${dup.key}:`, error);
      errors.push(`Error processing ${dup.key}: ${error.message}`);
    }
  }

  if (dryRun) {
    console.log(`\n📊 Dry run complete. Would delete ${duplicates.reduce((sum, dup) => sum + dup.count - 1, 0)} duplicate conversations`);
    console.log('\n💡 To actually perform the cleanup, run:');
    console.log('   node cleanup-duplicate-conversations.js --execute');
  } else {
    console.log(`\n✅ Cleanup complete! Deleted ${totalDeleted} duplicate conversations`);
    if (errors.length > 0) {
      console.log(`\n⚠️ ${errors.length} errors occurred:`);
      errors.forEach(error => console.log(`   - ${error}`));
    }
  }
}

async function main() {
  try {
    const executeCleanup = process.argv.includes('--execute');
    
    console.log('🧹 Duplicate Conversation Cleanup Tool');
    console.log('=====================================\n');
    
    if (!executeCleanup) {
      console.log('📝 Running in DRY RUN mode (no actual changes will be made)');
      console.log('💡 Add --execute flag to perform actual cleanup\n');
    }

    const duplicates = await findDuplicateConversations();
    
    if (duplicates && duplicates.length > 0) {
      await cleanupDuplicates(duplicates, !executeCleanup);
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

main(); 