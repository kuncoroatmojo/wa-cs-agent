#!/usr/bin/env node

/**
 * Test the enhanced sync functionality that combines conversation and message sync
 */

import { createClient } from '@supabase/supabase-js';
import { conversationService } from '../src/services/conversationService.js';

const SUPABASE_URL = 'https://pfirjlhuulkchogjbvsv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testEnhancedSync() {
  try {
    console.log('🧪 Testing enhanced sync functionality...');

    // Get user profile
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (!profiles?.length) {
      throw new Error('No user profiles found');
    }

    const userId = profiles[0].id;
    console.log(`✅ Using user ID: ${userId}`);

    // Get WhatsApp instance
    const { data: instances } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('user_id', userId)
      .eq('connection_type', 'evolution_api')
      .limit(1);

    if (!instances?.length) {
      throw new Error('No Evolution API instances found');
    }

    const instance = instances[0];
    console.log(`✅ Using instance: ${instance.name} (${instance.instance_key})`);

    // Check initial state
    console.log('\n📊 Current database state:');
    const { count: initialConversations } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const { count: initialMessages } = await supabase
      .from('conversation_messages')
      .select('*', { count: 'exact', head: true });

    console.log(`  - Conversations: ${initialConversations}`);
    console.log(`  - Messages: ${initialMessages}`);

    // Test the enhanced sync functionality
    console.log('\n🔄 Testing enhanced sync (conversations + messages)...');
    const startTime = new Date();

    const result = await conversationService.syncAllMessagesForRAG(userId, instance.instance_key);

    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);

    console.log('\n🎉 Enhanced sync completed!');
    console.log(`📊 Results:`);
    console.log(`  - Total conversations: ${result.totalConversations}`);
    console.log(`  - Total messages synced: ${result.totalMessagesSynced}`);
    console.log(`  - Errors: ${result.errors.length}`);
    console.log(`  - Duration: ${duration} seconds`);

    if (result.errors.length > 0) {
      console.log('\n⚠️ Errors encountered:');
      result.errors.slice(0, 5).forEach((error, idx) => {
        console.log(`  ${idx + 1}. ${error}`);
      });
      if (result.errors.length > 5) {
        console.log(`  ... and ${result.errors.length - 5} more errors`);
      }
    }

    // Check final state
    console.log('\n📊 Final database state:');
    const { count: finalConversations } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const { count: finalMessages } = await supabase
      .from('conversation_messages')
      .select('*', { count: 'exact', head: true });

    console.log(`  - Conversations: ${finalConversations} (+${finalConversations - initialConversations})`);
    console.log(`  - Messages: ${finalMessages} (+${finalMessages - initialMessages})`);

    // Test retrieving messages for a sample conversation
    console.log('\n📱 Testing message retrieval...');
    const { data: sampleConversations } = await supabase
      .from('conversations')
      .select('id, contact_name, message_count')
      .eq('user_id', userId)
      .gt('message_count', 0)
      .order('message_count', { ascending: false })
      .limit(3);

    if (sampleConversations?.length) {
      console.log('📋 Sample conversations with messages:');
      for (const conv of sampleConversations) {
        console.log(`  - ${conv.contact_name}: ${conv.message_count} messages`);
        
        // Test getting messages for this conversation
        const messages = await conversationService.getConversationMessages(conv.id, 5);
        console.log(`    Retrieved ${messages.length} sample messages`);
        
        if (messages.length > 0) {
          console.log(`    Latest message: "${messages[messages.length - 1].content.substring(0, 50)}..."`);
        }
      }
    }

    console.log('\n✅ Enhanced sync test completed successfully!');
    console.log('\n🚀 Ready for use:');
    console.log('1. Open WhatsApp Instances page');
    console.log('2. Click "Sync Conversations" button');
    console.log('3. It will now sync both conversations AND all messages');
    console.log('4. Go to Conversations page to see all messages');

  } catch (error) {
    console.error('❌ Enhanced sync test failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testEnhancedSync(); 