#!/usr/bin/env node

/**
 * Check for duplicate messages based on external_message_id
 * and also check for potential duplicates across conversations
 */

import { createClient } from '@supabase/supabase-js';

// Get credentials from command line args or environment
const SUPABASE_URL = process.argv[2] || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.argv[3] || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.log('Usage: node check-duplicate-messages.js [SUPABASE_URL] [SUPABASE_SERVICE_ROLE_KEY]');
  console.log('Or set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkDuplicateMessages() {
  console.log('🔍 Duplicate Message Checker');
  console.log('============================\n');

  try {
    // Check 1: Duplicate external_message_id
    console.log('📋 1. Checking for duplicate external_message_id...');
    
    const { data: duplicateExternalIds, error: externalError } = await supabase
      .from('conversation_messages')
      .select('external_message_id, id, conversation_id, content, created_at')
      .not('external_message_id', 'is', null)
      .order('external_message_id', { ascending: true });

    if (externalError) {
      throw new Error(`Error fetching messages: ${externalError.message}`);
    }

    // Group by external_message_id to find duplicates
    const externalIdGroups = {};
    duplicateExternalIds.forEach(msg => {
      if (!externalIdGroups[msg.external_message_id]) {
        externalIdGroups[msg.external_message_id] = [];
      }
      externalIdGroups[msg.external_message_id].push(msg);
    });

    const duplicateExternalIdGroups = Object.entries(externalIdGroups)
      .filter(([_, messages]) => messages.length > 1);

    if (duplicateExternalIdGroups.length > 0) {
      console.log(`⚠️ Found ${duplicateExternalIdGroups.length} external_message_id with duplicates:\n`);
      
      duplicateExternalIdGroups.slice(0, 10).forEach(([externalId, messages]) => {
        console.log(`External Message ID: ${externalId}`);
        messages.forEach((msg, idx) => {
          console.log(`  ${idx + 1}. ID: ${msg.id} | Conversation: ${msg.conversation_id} | Created: ${new Date(msg.created_at).toLocaleString()}`);
          console.log(`     Content: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
        });
        console.log('');
      });

      if (duplicateExternalIdGroups.length > 10) {
        console.log(`... and ${duplicateExternalIdGroups.length - 10} more duplicate groups\n`);
      }
    } else {
      console.log('✅ No duplicate external_message_id found\n');
    }

    // Check 2: Messages with same content and timestamp in same conversation
    console.log('📋 2. Checking for duplicate content within conversations...');
    
    const { data: allMessages, error: allError } = await supabase
      .from('conversation_messages')
      .select('id, conversation_id, content, external_timestamp, external_message_id, created_at')
      .order('conversation_id', { ascending: true })
      .order('external_timestamp', { ascending: true });

    if (allError) {
      throw new Error(`Error fetching all messages: ${allError.message}`);
    }

    // Group by conversation_id and then check for duplicates
    const conversationGroups = {};
    allMessages.forEach(msg => {
      if (!conversationGroups[msg.conversation_id]) {
        conversationGroups[msg.conversation_id] = [];
      }
      conversationGroups[msg.conversation_id].push(msg);
    });

    let contentDuplicatesFound = 0;
    const contentDuplicateExamples = [];

    Object.entries(conversationGroups).forEach(([conversationId, messages]) => {
      // Check for messages with same content and close timestamps
      const duplicateContentGroups = {};
      
      messages.forEach(msg => {
        // Create a key based on content and rounded timestamp (within 1 minute)
        const timestamp = new Date(msg.external_timestamp || msg.created_at);
        const roundedTime = Math.floor(timestamp.getTime() / (60 * 1000)); // Round to minute
        const key = `${msg.content.trim()}_${roundedTime}`;
        
        if (!duplicateContentGroups[key]) {
          duplicateContentGroups[key] = [];
        }
        duplicateContentGroups[key].push(msg);
      });

      // Find groups with more than one message
      Object.entries(duplicateContentGroups).forEach(([key, duplicateMsgs]) => {
        if (duplicateMsgs.length > 1) {
          contentDuplicatesFound++;
          if (contentDuplicateExamples.length < 5) {
            contentDuplicateExamples.push({
              conversationId,
              messages: duplicateMsgs
            });
          }
        }
      });
    });

    if (contentDuplicatesFound > 0) {
      console.log(`⚠️ Found ${contentDuplicatesFound} potential content duplicates within conversations:\n`);
      
      contentDuplicateExamples.forEach((example, idx) => {
        console.log(`${idx + 1}. Conversation ID: ${example.conversationId}`);
        example.messages.forEach((msg, msgIdx) => {
          console.log(`   ${msgIdx + 1}. ID: ${msg.id} | External ID: ${msg.external_message_id || 'none'}`);
          console.log(`      Time: ${new Date(msg.external_timestamp || msg.created_at).toLocaleString()}`);
          console.log(`      Content: ${msg.content.substring(0, 80)}${msg.content.length > 80 ? '...' : ''}`);
        });
        console.log('');
      });
    } else {
      console.log('✅ No obvious content duplicates found within conversations\n');
    }

    // Check 3: Statistics
    console.log('📊 3. Message Statistics:');
    
    const totalMessages = allMessages.length;
    const messagesWithExternalId = allMessages.filter(m => m.external_message_id).length;
    const messagesWithoutExternalId = totalMessages - messagesWithExternalId;
    const uniqueConversations = Object.keys(conversationGroups).length;

    console.log(`   Total messages: ${totalMessages}`);
    console.log(`   Messages with external_message_id: ${messagesWithExternalId}`);
    console.log(`   Messages without external_message_id: ${messagesWithoutExternalId}`);
    console.log(`   Unique conversations: ${uniqueConversations}`);
    console.log(`   Average messages per conversation: ${Math.round(totalMessages / uniqueConversations)}`);

    // Check 4: Look for potential cross-conversation duplicates
    console.log('\n📋 4. Checking for messages appearing in multiple conversations...');
    
    const externalIdToConversations = {};
    allMessages.forEach(msg => {
      if (msg.external_message_id) {
        if (!externalIdToConversations[msg.external_message_id]) {
          externalIdToConversations[msg.external_message_id] = new Set();
        }
        externalIdToConversations[msg.external_message_id].add(msg.conversation_id);
      }
    });

    const crossConversationDuplicates = Object.entries(externalIdToConversations)
      .filter(([_, conversations]) => conversations.size > 1);

    if (crossConversationDuplicates.length > 0) {
      console.log(`⚠️ Found ${crossConversationDuplicates.length} messages appearing in multiple conversations:\n`);
      
      crossConversationDuplicates.slice(0, 5).forEach(([externalId, conversations]) => {
        console.log(`External Message ID: ${externalId}`);
        console.log(`   Appears in conversations: ${Array.from(conversations).join(', ')}`);
      });

      if (crossConversationDuplicates.length > 5) {
        console.log(`... and ${crossConversationDuplicates.length - 5} more cross-conversation duplicates`);
      }
    } else {
      console.log('✅ No messages found in multiple conversations');
    }

    console.log('\n✅ Duplicate message check complete!');

  } catch (error) {
    console.error('❌ Error checking for duplicate messages:', error.message);
    process.exit(1);
  }
}

// Run the check
checkDuplicateMessages(); 