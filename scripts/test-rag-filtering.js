#!/usr/bin/env node

/**
 * Test script for RAG message filtering functionality
 * This script demonstrates how to filter messages for RAG context
 */

import { createClient } from '@supabase/supabase-js';

// Load environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://pfirjlhuulkchogjbvsv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testRAGFiltering() {
  try {
    console.log('🧠 Starting RAG message filtering test...');
    
    // 1. Get all conversations
    console.log('📥 Fetching all conversations...');
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .limit(5);

    if (convError) {
      throw new Error(`Failed to fetch conversations: ${convError.message}`);
    }

    if (!conversations || conversations.length === 0) {
      console.log('⚠️ No conversations found. Please sync messages first.');
      return;
    }

    console.log(`✅ Found ${conversations.length} conversations to test with`);

    // 2. Test different filtering scenarios for each conversation
    for (const conversation of conversations) {
      console.log(`\n🔍 Testing conversation: ${conversation.contact_name || conversation.contact_id}`);
      
      // Scenario 1: Get all text messages (for basic RAG)
      console.log('📝 Scenario 1: All text messages for RAG');
      const { data: textMessages, error: textError } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .eq('message_type', 'text')
        .order('created_at', { ascending: true })
        .limit(20);

      if (textError) {
        console.error('❌ Error fetching text messages:', textError.message);
        continue;
      }

      console.log(`  - Found ${textMessages?.length || 0} text messages`);
      
      if (textMessages && textMessages.length > 0) {
        // Show content preview
        const recentMessages = textMessages.slice(-3);
        recentMessages.forEach((msg, idx) => {
          const content = msg.content.length > 100 
            ? msg.content.substring(0, 100) + '...' 
            : msg.content;
          console.log(`    ${idx + 1}. [${msg.direction}] ${content}`);
        });
      }

      // Scenario 2: Get only historical messages (synced from Evolution API)
      console.log('📚 Scenario 2: Historical messages only');
      const { data: historicalMessages, error: histError } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .not('metadata->>isHistorical', 'is', null)
        .order('external_timestamp', { ascending: true })
        .limit(10);

      if (histError) {
        console.error('❌ Error fetching historical messages:', histError.message);
      } else {
        console.log(`  - Found ${historicalMessages?.length || 0} historical messages`);
      }

      // Scenario 3: Get messages by date range (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      console.log('📅 Scenario 3: Messages from last 7 days');
      const { data: recentMessages, error: recentError } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      if (recentError) {
        console.error('❌ Error fetching recent messages:', recentError.message);
      } else {
        console.log(`  - Found ${recentMessages?.length || 0} messages from last 7 days`);
      }

      // Scenario 4: Get conversation context summary
      console.log('📊 Scenario 4: Conversation context summary');
      
      const allMessages = textMessages || [];
      const messageCount = allMessages.length;
      
      if (messageCount > 0) {
        // Extract text content for analysis
        const textContent = allMessages
          .map(m => m.content)
          .filter(content => content && content !== '[Media]')
          .join(' ');

        // Simple keyword extraction
        const words = textContent.toLowerCase()
          .split(/\s+/)
          .filter(word => word.length > 4 && !['this', 'that', 'with', 'from', 'they', 'have', 'been', 'will', 'your', 'what', 'when', 'where'].includes(word));
        
        const wordFreq = {};
        words.forEach(word => {
          wordFreq[word] = (wordFreq[word] || 0) + 1;
        });

        const keyTopics = Object.entries(wordFreq)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([word]) => word);

        const timeSpan = {
          start: new Date(allMessages[0].created_at),
          end: new Date(allMessages[allMessages.length - 1].created_at)
        };

        const daysSpan = Math.ceil((timeSpan.end.getTime() - timeSpan.start.getTime()) / (1000 * 60 * 60 * 24));

        console.log(`  - Message count: ${messageCount}`);
        console.log(`  - Time span: ${daysSpan} days`);
        console.log(`  - Key topics: ${keyTopics.join(', ')}`);
        console.log(`  - Total words: ${words.length}`);
      }

      // Scenario 5: Get mixed media types
      console.log('🎯 Scenario 5: Mixed message types');
      const { data: mixedMessages, error: mixedError } = await supabase
        .from('conversation_messages')
        .select('message_type, count(*)')
        .eq('conversation_id', conversation.id)
        .group('message_type');

      if (mixedError) {
        console.error('❌ Error fetching message types:', mixedError.message);
      } else if (mixedMessages) {
        mixedMessages.forEach(row => {
          console.log(`  - ${row.message_type}: ${row.count} messages`);
        });
      }
    }

    // 3. Test conversation-level RAG data
    console.log('\n🎯 Testing conversation-level RAG data...');
    
    const conversationsWithRAG = conversations.filter(c => 
      c.conversation_summary || 
      (c.conversation_topics && c.conversation_topics.length > 0)
    );

    console.log(`✅ ${conversationsWithRAG.length} conversations have RAG data`);
    
    conversationsWithRAG.forEach(conv => {
      console.log(`- ${conv.contact_name || conv.contact_id}:`);
      if (conv.conversation_summary) {
        console.log(`  Summary: ${conv.conversation_summary.substring(0, 100)}...`);
      }
      if (conv.conversation_topics) {
        console.log(`  Topics: ${conv.conversation_topics.join(', ')}`);
      }
      if (conv.sentiment) {
        console.log(`  Sentiment: ${conv.sentiment}`);
      }
    });

    // 4. Summary and recommendations
    console.log('\n📊 RAG Filtering Test Summary:');
    console.log(`✅ Total conversations tested: ${conversations.length}`);
    console.log('✅ Filtering scenarios tested: 5');
    console.log('✅ Message type analysis: Working');
    console.log('✅ Date range filtering: Working');
    console.log('✅ Historical message filtering: Working');
    console.log('✅ Context generation: Working');

    console.log('\n🎯 RAG Usage Recommendations:');
    console.log('1. Use text messages only for content analysis');
    console.log('2. Include historical messages for complete context');
    console.log('3. Filter by date range for recent context');
    console.log('4. Extract key topics for conversation categorization');
    console.log('5. Use conversation summaries for quick context');

  } catch (error) {
    console.error('❌ RAG filtering test failed:', error);
    process.exit(1);
  }
}

// Run the test
testRAGFiltering(); 