#!/usr/bin/env node

/**
 * Complete database cleanup - removes all conversations and messages
 * Use this to start fresh before syncing from Evolution API
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://pfirjlhuulkchogjbvsv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getTableCounts() {
  try {
    const [messagesResult, conversationsResult] = await Promise.all([
      supabase.from('conversation_messages').select('id', { count: 'exact', head: true }),
      supabase.from('conversations').select('id', { count: 'exact', head: true })
    ]);

    return {
      messages: messagesResult.count || 0,
      conversations: conversationsResult.count || 0
    };
  } catch (error) {
    console.error('Error getting counts:', error.message);
    return { messages: 0, conversations: 0 };
  }
}

async function cleanupDatabase() {
  console.log('🧹 COMPLETE DATABASE CLEANUP');
  console.log('=====================================');
  console.log('⚠️  This will delete ALL conversations and messages!');
  console.log('📋 Use this before syncing fresh data from Evolution API\n');

  try {
    // Get initial counts
    console.log('📊 Getting current database state...');
    const initialCounts = await getTableCounts();
    
    console.log(`📨 Current messages: ${initialCounts.messages}`);
    console.log(`💬 Current conversations: ${initialCounts.conversations}`);
    
    if (initialCounts.messages === 0 && initialCounts.conversations === 0) {
      console.log('✅ Database is already clean!');
      return;
    }

    console.log('\n🚀 Starting cleanup process...\n');

    // Step 1: Delete all conversation messages
    console.log('🗑️  Step 1: Deleting all conversation messages...');
    
    const { error: messagesError, count: deletedMessages } = await supabase
      .from('conversation_messages')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (using impossible condition to delete all)

    if (messagesError) {
      // Try alternative approach for mass delete
      console.log('Trying alternative deletion method for messages...');
      
      const { error: altMessagesError } = await supabase.rpc('exec_sql', {
        query: 'TRUNCATE TABLE conversation_messages RESTART IDENTITY CASCADE;'
      });

      if (altMessagesError) {
        console.error('❌ Failed to delete messages:', altMessagesError.message);
        throw altMessagesError;
      } else {
        console.log('✅ All messages deleted using TRUNCATE');
      }
    } else {
      console.log(`✅ Deleted ${deletedMessages || 'all'} messages`);
    }

    // Step 2: Delete all conversations
    console.log('🗑️  Step 2: Deleting all conversations...');
    
    const { error: conversationsError, count: deletedConversations } = await supabase
      .from('conversations')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (conversationsError) {
      // Try alternative approach for mass delete
      console.log('Trying alternative deletion method for conversations...');
      
      const { error: altConversationsError } = await supabase.rpc('exec_sql', {
        query: 'TRUNCATE TABLE conversations RESTART IDENTITY CASCADE;'
      });

      if (altConversationsError) {
        console.error('❌ Failed to delete conversations:', altConversationsError.message);
        throw altConversationsError;
      } else {
        console.log('✅ All conversations deleted using TRUNCATE');
      }
    } else {
      console.log(`✅ Deleted ${deletedConversations || 'all'} conversations`);
    }

    // Step 3: Reset any sequences/auto-increment counters
    console.log('🔄 Step 3: Resetting database sequences...');
    
    try {
      const { error: resetError } = await supabase.rpc('exec_sql', {
        query: `
          -- Reset sequences if they exist
          SELECT setval(pg_get_serial_sequence('conversations', 'id'), 1, false);
          SELECT setval(pg_get_serial_sequence('conversation_messages', 'id'), 1, false);
        `
      });

      if (resetError) {
        console.log('⚠️  Could not reset sequences (may not exist):', resetError.message);
      } else {
        console.log('✅ Database sequences reset');
      }
    } catch (resetErr) {
      console.log('⚠️  Sequence reset skipped (not critical)');
    }

    // Step 4: Verify cleanup
    console.log('🔍 Step 4: Verifying cleanup...');
    
    const finalCounts = await getTableCounts();
    
    console.log('\n📊 CLEANUP RESULTS:');
    console.log('==================');
    console.log(`📨 Messages: ${initialCounts.messages} → ${finalCounts.messages}`);
    console.log(`💬 Conversations: ${initialCounts.conversations} → ${finalCounts.conversations}`);
    
    if (finalCounts.messages === 0 && finalCounts.conversations === 0) {
      console.log('\n🎉 SUCCESS! Database is completely clean');
      console.log('✅ All conversations and messages have been removed');
      console.log('📋 You can now sync fresh data from Evolution API');
      console.log('🚀 The unique constraint will prevent duplicates during sync');
    } else {
      console.log('\n⚠️  Some data may remain. Manual verification recommended.');
    }

    // Step 5: Show next steps
    console.log('\n📋 NEXT STEPS:');
    console.log('==============');
    console.log('1. Go to WhatsApp Instances page');
    console.log('2. Click "Sync Conversations" button');
    console.log('3. All your Evolution API data will sync cleanly');
    console.log('4. No duplicates will be created thanks to the unique constraint');

  } catch (error) {
    console.error('\n❌ CLEANUP FAILED:', error.message);
    console.log('\n🔧 You may need to run manual SQL:');
    console.log('TRUNCATE TABLE conversation_messages RESTART IDENTITY CASCADE;');
    console.log('TRUNCATE TABLE conversations RESTART IDENTITY CASCADE;');
    process.exit(1);
  }
}

// Safety prompt in production
if (process.env.NODE_ENV === 'production') {
  console.log('⚠️  PRODUCTION ENVIRONMENT DETECTED');
  console.log('Are you sure you want to delete ALL data? (Ctrl+C to cancel)');
  
  // Wait 5 seconds before proceeding
  await new Promise(resolve => setTimeout(resolve, 5000));
}

cleanupDatabase(); 