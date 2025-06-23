#!/usr/bin/env node

/**
 * Script to sync all Evolution API messages for RAG functionality
 */

import { EvolutionMessageSyncService } from '../src/services/evolutionMessageSync.ts';

async function syncAllEvolutionMessages() {
  try {
    console.log('🚀 Starting Evolution API message sync for RAG...');
    
    // Initialize the sync service
    const syncService = new EvolutionMessageSyncService();
    
    // Check current database status
    console.log('\n📊 Checking current database status...');
    const currentProgress = await syncService.getSyncProgress();
    console.log(`Current state:`);
    console.log(`  - Instances: ${currentProgress.totalInstances}`);
    console.log(`  - Conversations: ${currentProgress.totalConversations}`);
    console.log(`  - Messages: ${currentProgress.totalMessages}`);
    if (currentProgress.lastSyncTime) {
      console.log(`  - Last sync: ${currentProgress.lastSyncTime.toLocaleString()}`);
    }

    // Start the sync process
    console.log('\n🔄 Starting message sync for instance "personal"...');
    const progress = await syncService.syncAllMessages('personal');
    
    // Display results
    console.log('\n📈 Sync Results:');
    console.log(`✅ Status: ${progress.status}`);
    console.log(`📨 Total messages processed: ${progress.processedMessages}/${progress.totalMessages}`);
    console.log(`💬 Total conversations processed: ${progress.processedConversations}/${progress.totalConversations}`);
    console.log(`⏱️ Duration: ${Math.round((progress.endTime - progress.startTime) / 1000)}s`);
    
    if (progress.errors.length > 0) {
      console.log(`\n⚠️ Errors (${progress.errors.length}):`);
      progress.errors.slice(0, 5).forEach((error, idx) => {
        console.log(`  ${idx + 1}. ${error}`);
      });
      if (progress.errors.length > 5) {
        console.log(`  ... and ${progress.errors.length - 5} more`);
      }
    }

    // Final database status
    console.log('\n📊 Final database status...');
    const finalProgress = await syncService.getSyncProgress();
    console.log(`Final state:`);
    console.log(`  - Instances: ${finalProgress.totalInstances}`);
    console.log(`  - Conversations: ${finalProgress.totalConversations}`);
    console.log(`  - Messages: ${finalProgress.totalMessages}`);
    console.log(`  - Last sync: ${finalProgress.lastSyncTime?.toLocaleString()}`);

    // Test RAG functionality
    console.log('\n🧠 Testing RAG message filtering...');
    
    // Get sample messages for RAG
    const ragMessages = await syncService.getMessagesForRAG({
      limit: 5,
      textOnly: true,
      direction: 'inbound'
    });
    
    console.log(`Found ${ragMessages.length} text messages for RAG:`);
    ragMessages.forEach((msg, idx) => {
      const preview = msg.content.substring(0, 100);
      console.log(`  ${idx + 1}. [${msg.message_type}] ${preview}${msg.content.length > 100 ? '...' : ''}`);
    });

    // Test conversation context
    if (ragMessages.length > 0) {
      const sampleRemoteJid = ragMessages[0].conversation?.external_conversation_id;
      if (sampleRemoteJid) {
        console.log(`\n🔍 Testing conversation context for: ${sampleRemoteJid}`);
        const context = await syncService.getConversationContext(sampleRemoteJid, {
          maxMessages: 10,
          includeMetadata: true
        });
        
        console.log(`Conversation summary:`);
        console.log(`  - Contact: ${context.conversation.contact_name}`);
        console.log(`  - Messages: ${context.summary.totalMessages}`);
        console.log(`  - Participants: ${context.summary.participantCount}`);
        console.log(`  - Message types: ${context.summary.messageTypes.join(', ')}`);
        if (context.summary.keyTopics?.length) {
          console.log(`  - Key topics: ${context.summary.keyTopics.slice(0, 5).join(', ')}`);
        }
        if (context.summary.timeSpan) {
          const days = Math.ceil((context.summary.timeSpan.end.getTime() - context.summary.timeSpan.start.getTime()) / (1000 * 60 * 60 * 24));
          console.log(`  - Time span: ${days} days`);
        }
      }
    }

    console.log('\n🎉 SUCCESS! All Evolution API messages have been synced for RAG functionality!');
    console.log('\n🚀 Next steps:');
    console.log('1. Messages are now available for AI processing');
    console.log('2. Use getMessagesForRAG() to filter messages for AI context');
    console.log('3. Use getConversationContext() for detailed conversation analysis');
    console.log('4. Configure webhook for real-time message sync');

  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Run the sync
syncAllEvolutionMessages(); 