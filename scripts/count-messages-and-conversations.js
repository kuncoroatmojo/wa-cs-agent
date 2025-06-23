#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please ensure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function countMessagesAndConversations() {
  console.log('📊 Counting messages and conversations...\n');
  
  try {
    // Count total conversations
    const { count: totalConversations, error: convError } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true });
    
    if (convError) {
      console.error('❌ Error counting conversations:', convError);
      return;
    }

    // Count conversations by status
    const { data: conversationsByStatus, error: statusError } = await supabase
      .from('conversations')
      .select('status')
      .then(({ data, error }) => {
        if (error) return { data: null, error };
        const statusCounts = data?.reduce((acc, conv) => {
          acc[conv.status] = (acc[conv.status] || 0) + 1;
          return acc;
        }, {}) || {};
        return { data: statusCounts, error: null };
      });

    if (statusError) {
      console.error('❌ Error counting conversations by status:', statusError);
      return;
    }

    // Count conversations by integration type
    const { data: conversationsByIntegration, error: integrationError } = await supabase
      .from('conversations')
      .select('integration_type')
      .then(({ data, error }) => {
        if (error) return { data: null, error };
        const integrationCounts = data?.reduce((acc, conv) => {
          acc[conv.integration_type] = (acc[conv.integration_type] || 0) + 1;
          return acc;
        }, {}) || {};
        return { data: integrationCounts, error: null };
      });

    if (integrationError) {
      console.error('❌ Error counting conversations by integration:', integrationError);
      return;
    }

    // Count total messages
    const { count: totalMessages, error: msgError } = await supabase
      .from('conversation_messages')
      .select('*', { count: 'exact', head: true });
    
    if (msgError) {
      console.error('❌ Error counting messages:', msgError);
      return;
    }

    // Count messages by direction
    const { data: messagesByDirection, error: directionError } = await supabase
      .from('conversation_messages')
      .select('direction')
      .then(({ data, error }) => {
        if (error) return { data: null, error };
        const directionCounts = data?.reduce((acc, msg) => {
          acc[msg.direction] = (acc[msg.direction] || 0) + 1;
          return acc;
        }, {}) || {};
        return { data: directionCounts, error: null };
      });

    if (directionError) {
      console.error('❌ Error counting messages by direction:', directionError);
      return;
    }

    // Count messages by sender type
    const { data: messagesBySender, error: senderError } = await supabase
      .from('conversation_messages')
      .select('sender_type')
      .then(({ data, error }) => {
        if (error) return { data: null, error };
        const senderCounts = data?.reduce((acc, msg) => {
          acc[msg.sender_type] = (acc[msg.sender_type] || 0) + 1;
          return acc;
        }, {}) || {};
        return { data: senderCounts, error: null };
      });

    if (senderError) {
      console.error('❌ Error counting messages by sender type:', senderError);
      return;
    }

    // Count messages by type
    const { data: messagesByType, error: typeError } = await supabase
      .from('conversation_messages')
      .select('message_type')
      .then(({ data, error }) => {
        if (error) return { data: null, error };
        const typeCounts = data?.reduce((acc, msg) => {
          acc[msg.message_type] = (acc[msg.message_type] || 0) + 1;
          return acc;
        }, {}) || {};
        return { data: typeCounts, error: null };
      });

    if (typeError) {
      console.error('❌ Error counting messages by type:', typeError);
      return;
    }

    // Get recent activity
    const { data: recentMessages, error: recentError } = await supabase
      .from('conversation_messages')
      .select('created_at, conversation_id, sender_type, message_type')
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentError) {
      console.error('❌ Error getting recent messages:', recentError);
      return;
    }

    // Display results
    console.log('📈 DATABASE STATISTICS');
    console.log('=' .repeat(50));
    
    console.log('\n💬 CONVERSATIONS');
    console.log(`Total Conversations: ${totalConversations || 0}`);
    if (conversationsByStatus && Object.keys(conversationsByStatus).length > 0) {
      console.log('\nBy Status:');
      Object.entries(conversationsByStatus).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });
    }
    
    if (conversationsByIntegration && Object.keys(conversationsByIntegration).length > 0) {
      console.log('\nBy Integration:');
      Object.entries(conversationsByIntegration).forEach(([integration, count]) => {
        console.log(`  ${integration}: ${count}`);
      });
    }

    console.log('\n📝 MESSAGES');
    console.log(`Total Messages: ${totalMessages || 0}`);
    
    if (messagesByDirection && Object.keys(messagesByDirection).length > 0) {
      console.log('\nBy Direction:');
      Object.entries(messagesByDirection).forEach(([direction, count]) => {
        console.log(`  ${direction}: ${count}`);
      });
    }
    
    if (messagesBySender && Object.keys(messagesBySender).length > 0) {
      console.log('\nBy Sender Type:');
      Object.entries(messagesBySender).forEach(([sender, count]) => {
        console.log(`  ${sender}: ${count}`);
      });
    }
    
    if (messagesByType && Object.keys(messagesByType).length > 0) {
      console.log('\nBy Message Type:');
      Object.entries(messagesByType).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
    }

    if (recentMessages && recentMessages.length > 0) {
      console.log('\n🕒 RECENT ACTIVITY (Last 5 messages)');
      recentMessages.forEach((msg, index) => {
        const date = new Date(msg.created_at).toLocaleString();
        console.log(`  ${index + 1}. ${date} - ${msg.sender_type} (${msg.message_type})`);
      });
    }

    // Calculate averages if we have data
    if (totalConversations && totalMessages && totalConversations > 0) {
      const avgMessagesPerConversation = (totalMessages / totalConversations).toFixed(2);
      console.log(`\n📊 AVERAGES`);
      console.log(`Average messages per conversation: ${avgMessagesPerConversation}`);
    }

    console.log('\n✅ Count completed successfully!');
    
  } catch (err) {
    console.error('❌ Exception counting messages and conversations:', err);
  }
}

countMessagesAndConversations(); 