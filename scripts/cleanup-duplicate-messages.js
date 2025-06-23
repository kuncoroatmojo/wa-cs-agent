#!/usr/bin/env node

/**
 * Clean up duplicate messages based on external_message_id
 * Keeps the most recent message and removes duplicates
 */

import { createClient } from '@supabase/supabase-js';

// Get credentials from command line args or environment
const EXECUTE_CLEANUP = process.argv.includes('--execute');
// Filter out the --execute flag from argv when getting URL and key
const filteredArgs = process.argv.filter(arg => arg !== '--execute');
const SUPABASE_URL = filteredArgs[2] || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = filteredArgs[3] || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.log('Usage: node cleanup-duplicate-messages.js [SUPABASE_URL] [SUPABASE_SERVICE_ROLE_KEY] [--execute]');
  console.log('Or set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function cleanupDuplicateMessages() {
  console.log('🧹 Duplicate Message Cleanup Tool');
  console.log('==================================\n');

  if (!EXECUTE_CLEANUP) {
    console.log('📝 Running in DRY RUN mode (no actual changes will be made)');
    console.log('💡 Add --execute flag to perform actual cleanup\n');
  }

  try {
    // Step 1: Find all messages with duplicate external_message_id
    console.log('🔍 Finding duplicate messages based on external_message_id...');
    
    const { data: allMessages, error: fetchError } = await supabase
      .from('conversation_messages')
      .select('id, external_message_id, conversation_id, content, created_at, external_timestamp, external_metadata')
      .not('external_message_id', 'is', null)
      .order('external_message_id', { ascending: true })
      .order('created_at', { ascending: true });

    if (fetchError) {
      throw new Error(`Error fetching messages: ${fetchError.message}`);
    }

    console.log(`📊 Found ${allMessages.length} messages with external IDs`);

    // Group by external_message_id
    const messageGroups = {};
    allMessages.forEach(msg => {
      if (!messageGroups[msg.external_message_id]) {
        messageGroups[msg.external_message_id] = [];
      }
      messageGroups[msg.external_message_id].push(msg);
    });

    const duplicateGroups = Object.entries(messageGroups)
      .filter(([_, messages]) => messages.length > 1);

    if (duplicateGroups.length === 0) {
      console.log('✅ No duplicate messages found!');
      return;
    }

    console.log(`⚠️ Found ${duplicateGroups.length} external_message_id with duplicates (${duplicateGroups.reduce((sum, [_, msgs]) => sum + msgs.length - 1, 0)} duplicates total):\n`);

    // Show examples
    duplicateGroups.slice(0, 5).forEach(([externalId, messages], index) => {
      console.log(`${index + 1}. External ID: ${externalId}`);
      messages.forEach((msg, msgIdx) => {
        console.log(`   ${msgIdx + 1}. ID: ${msg.id} | Conversation: ${msg.conversation_id} | Created: ${new Date(msg.created_at).toLocaleString()}`);
        console.log(`      Content: ${msg.content.substring(0, 80)}${msg.content.length > 80 ? '...' : ''}`);
      });
      console.log('');
    });

    if (duplicateGroups.length > 5) {
      console.log(`... and ${duplicateGroups.length - 5} more duplicate groups\n`);
    }

    // Step 2: Process duplicates
    let deletedCount = 0;
    let processedGroups = 0;

    for (const [externalId, messages] of duplicateGroups) {
      // Sort messages to determine which one to keep
      // Priority: 1. Most recent created_at, 2. Longest content, 3. Has external_metadata
      const sortedMessages = messages.sort((a, b) => {
        // First, prefer most recent
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        if (timeA !== timeB) return timeB - timeA; // Most recent first
        
        // Then prefer longer content (more complete)
        const contentLengthDiff = b.content.length - a.content.length;
        if (contentLengthDiff !== 0) return contentLengthDiff;
        
        // Finally prefer messages with more metadata
        const metadataA = a.external_metadata ? JSON.stringify(a.external_metadata).length : 0;
        const metadataB = b.external_metadata ? JSON.stringify(b.external_metadata).length : 0;
        return metadataB - metadataA;
      });

      const messageToKeep = sortedMessages[0];
      const messagesToDelete = sortedMessages.slice(1);

      console.log(`🧹 Processing duplicate set: ${externalId}`);
      console.log(`   Keeping: ${messageToKeep.id} (${messageToKeep.content.substring(0, 50)}...) - ${new Date(messageToKeep.created_at).toLocaleString()}`);
      
      for (const msgToDelete of messagesToDelete) {
        console.log(`   ${EXECUTE_CLEANUP ? 'Deleting' : 'Would delete'}: ${msgToDelete.id} (${msgToDelete.content.substring(0, 50)}...) - ${new Date(msgToDelete.created_at).toLocaleString()}`);
        
        if (EXECUTE_CLEANUP) {
          const { error: deleteError } = await supabase
            .from('conversation_messages')
            .delete()
            .eq('id', msgToDelete.id);

          if (deleteError) {
            console.error(`     ❌ Error deleting message ${msgToDelete.id}:`, deleteError.message);
          } else {
            console.log(`     ✅ Successfully deleted message ${msgToDelete.id}`);
            deletedCount++;
          }
        } else {
          deletedCount++;
        }
      }

      processedGroups++;
      console.log('');

      // Progress update every 50 groups
      if (processedGroups % 50 === 0) {
        console.log(`📈 Progress: ${processedGroups}/${duplicateGroups.length} groups processed\n`);
      }
    }

    // Step 3: Summary
    console.log(`📊 ${EXECUTE_CLEANUP ? 'Cleanup' : 'Dry run'} complete!`);
    console.log(`   Processed ${duplicateGroups.length} duplicate groups`);
    console.log(`   ${EXECUTE_CLEANUP ? 'Deleted' : 'Would delete'} ${deletedCount} duplicate messages`);
    console.log(`   Kept ${duplicateGroups.length} unique messages`);

    if (!EXECUTE_CLEANUP) {
      console.log('\n💡 To actually perform the cleanup, run:');
      console.log('   node cleanup-duplicate-messages.js --execute');
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    process.exit(1);
  }
}

// Run the cleanup
cleanupDuplicateMessages(); 