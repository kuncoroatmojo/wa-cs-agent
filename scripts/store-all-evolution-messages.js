#!/usr/bin/env node

/**
 * Store ALL Evolution API messages in database for RAG and conversations page
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://pfirjlhuulkchogjbvsv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EVOLUTION_API_URL = process.env.VITE_EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.VITE_EVOLUTION_API_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY || !EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  console.error('  - VITE_EVOLUTION_API_URL');
  console.error('  - VITE_EVOLUTION_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function extractMessageContent(message) {
  if (message.message?.conversation) {
    return message.message.conversation;
  }
  
  if (message.message?.extendedTextMessage?.text) {
    return message.message.extendedTextMessage.text;
  }

  // For media messages, return type description with caption
  if (message.message?.imageMessage) {
    const caption = message.message.imageMessage.caption || '';
    return caption ? `[Image] ${caption}` : '[Image]';
  }

  if (message.message?.audioMessage) {
    return '[Audio]';
  }

  if (message.message?.videoMessage) {
    const caption = message.message.videoMessage.caption || '';
    return caption ? `[Video] ${caption}` : '[Video]';
  }

  if (message.message?.documentMessage) {
    const title = message.message.documentMessage.title || 'Document';
    return `[Document: ${title}]`;
  }

  if (message.message?.locationMessage) {
    return '[Location]';
  }

  if (message.message?.contactMessage) {
    return '[Contact]';
  }

  if (message.message?.stickerMessage) {
    return '[Sticker]';
  }

  // Fallback to message type
  return `[${message.messageType}]`;
}

function normalizeMessageType(evolutionMessageType) {
  const typeMapping = {
    // Text messages
    'conversation': 'text',
    'extendedTextMessage': 'text',
    'buttonsMessage': 'text',
    'buttonsResponseMessage': 'text',
    'interactiveMessage': 'text',
    'templateMessage': 'text',
    
    // Media messages
    'imageMessage': 'image',
    'audioMessage': 'audio',
    'videoMessage': 'video',
    'documentMessage': 'document',
    'documentWithCaptionMessage': 'document',
    'ptvMessage': 'video', // PTV is a video message type
    'viewOnceMessageV2': 'image', // View once is typically image
    
    // Contact and location
    'contactMessage': 'contact',
    'contactsArrayMessage': 'contact',
    'locationMessage': 'location',
    
    // Stickers and reactions
    'stickerMessage': 'sticker',
    
    // Special message types - categorize as text for RAG processing
    'pollCreationMessageV2': 'text',
    'pollCreationMessageV3': 'text',
    'groupInviteMessage': 'text',
    'productMessage': 'text',
    'protocolMessage': 'text',
    'editedMessage': 'text',
    'commentMessage': 'text'
  };

  return typeMapping[evolutionMessageType] || 'text'; // Default to 'text' for unknown types
}

async function storeAllEvolutionMessages() {
  try {
    console.log('🚀 Starting to store ALL Evolution API messages...');
    const startTime = new Date();

    // Get database instance and user
    const { data: dbInstances } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .limit(1);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (!dbInstances?.length || !profiles?.length) {
      throw new Error('Missing database instances or profiles');
    }

    const instanceId = dbInstances[0].id;
    const userId = profiles[0].id;
    const instanceName = 'personal';

    console.log(`✅ Using instance: ${instanceId}, user: ${userId}`);

    // Fetch ALL messages from Evolution API
    console.log('\n📨 Fetching ALL messages from Evolution API...');
    const response = await fetch(`${EVOLUTION_API_URL}/chat/findMessages/${instanceName}`, {
      method: 'POST',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({}) // Empty body to get all messages
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch messages: ${response.status}`);
    }

    const allMessages = await response.json();
    console.log(`✅ Found ${allMessages.length} total messages`);

    // Group messages by conversation
    console.log('\n💬 Grouping messages by conversation...');
    const messagesByConversation = {};
    
    allMessages.forEach(msg => {
      const remoteJid = msg.key?.remoteJid || 'unknown';
      if (!messagesByConversation[remoteJid]) {
        messagesByConversation[remoteJid] = [];
      }
      messagesByConversation[remoteJid].push(msg);
    });

    const conversationIds = Object.keys(messagesByConversation);
    console.log(`✅ Grouped into ${conversationIds.length} conversations`);

    // Show top conversations by message count
    console.log('\n📊 Top conversations by message count:');
    const sortedConversations = conversationIds
      .map(jid => ({
        jid,
        count: messagesByConversation[jid].length,
        isGroup: jid.includes('@g.us')
      }))
      .sort((a, b) => b.count - a.count);

    sortedConversations.slice(0, 10).forEach((conv, idx) => {
      const displayJid = conv.jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
      console.log(`  ${idx + 1}. ${displayJid} (${conv.isGroup ? 'Group' : 'Contact'}): ${conv.count} messages`);
    });

    // Process each conversation
    console.log(`\n💾 Storing messages for ${conversationIds.length} conversations...`);
    let totalStoredMessages = 0;
    let processedConversations = 0;
    let errors = [];

    for (const [remoteJid, messages] of Object.entries(messagesByConversation)) {
      try {
        // Sort messages by timestamp
        const sortedMessages = messages.sort((a, b) => a.messageTimestamp - b.messageTimestamp);
        const latestMessage = sortedMessages[sortedMessages.length - 1];

        // Determine if this is a group chat
        const isGroup = remoteJid.includes('@g.us');
        
        // Extract contact name from latest message or use phone number
        const contactName = latestMessage.pushName || 
                           (isGroup ? 'Group Chat' : remoteJid.replace('@s.whatsapp.net', ''));

        // Ensure conversation exists
        const conversationData = {
          user_id: userId,
          integration_type: 'whatsapp',
          integration_id: instanceId,
          instance_key: instanceName,
          contact_id: remoteJid,
          contact_name: contactName,
          status: 'active',
          external_conversation_id: remoteJid,
          message_count: messages.length,
          last_message_at: new Date(latestMessage.messageTimestamp * 1000).toISOString(),
          contact_metadata: { 
            pushName: contactName,
            isGroup,
            messageTypes: [...new Set(messages.map(m => m.messageType))]
          }
        };

        const { data: conversation, error: convError } = await supabase
          .from('conversations')
          .upsert(conversationData, { 
            onConflict: 'user_id,integration_type,contact_id,integration_id' 
          })
          .select()
          .single();

        if (convError || !conversation) {
          throw new Error(`Failed to create conversation: ${convError?.message}`);
        }

        // Batch process messages (chunks of 50 for better performance)
        const batchSize = 50;
        let conversationStoredCount = 0;

        for (let i = 0; i < sortedMessages.length; i += batchSize) {
          const batch = sortedMessages.slice(i, i + batchSize);
          
          const messageInserts = batch.map(msg => ({
            conversation_id: conversation.id,
            external_message_id: msg.key?.id || `msg_${msg.messageTimestamp}_${Math.random()}`,
            content: extractMessageContent(msg),
            message_type: normalizeMessageType(msg.messageType),
            direction: msg.key?.fromMe ? 'outbound' : 'inbound',
            sender_type: msg.key?.fromMe ? 'agent' : 'contact',
            sender_name: msg.pushName || 'Unknown',
            sender_id: msg.key?.participant || msg.pushName || remoteJid,
            external_timestamp: new Date(msg.messageTimestamp * 1000).toISOString(),
            external_metadata: msg,
            status: 'delivered'
          }));

          // Insert batch (fixed: using insert instead of upsert)
          const { error: messageError } = await supabase
            .from('conversation_messages')
            .insert(messageInserts);

          if (messageError) {
            console.error(`❌ Error inserting batch for ${remoteJid}:`, messageError.message);
          } else {
            conversationStoredCount += messageInserts.length;
          }
        }

        totalStoredMessages += conversationStoredCount;
        processedConversations++;

        // Log progress every 50 conversations
        if (processedConversations % 50 === 0) {
          console.log(`📈 Progress: ${processedConversations}/${conversationIds.length} conversations (${totalStoredMessages} messages stored)`);
        }

      } catch (error) {
        const errorMsg = `Error storing conversation ${remoteJid}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);

    console.log('\n🎉 Storage Complete!');
    console.log('📊 Final Results:');
    console.log(`  ✅ Total messages processed: ${allMessages.length}`);
    console.log(`  ✅ Total messages stored: ${totalStoredMessages}`);
    console.log(`  ✅ Conversations processed: ${processedConversations}/${conversationIds.length}`);
    console.log(`  ⏱️ Duration: ${duration} seconds`);
    console.log(`  ❌ Errors: ${errors.length}`);

    if (errors.length > 0 && errors.length <= 5) {
      console.log('\n⚠️ Errors:');
      errors.forEach((error, idx) => {
        console.log(`  ${idx + 1}. ${error}`);
      });
    } else if (errors.length > 5) {
      console.log(`\n⚠️ ${errors.length} errors occurred (showing first 3):`);
      errors.slice(0, 3).forEach((error, idx) => {
        console.log(`  ${idx + 1}. ${error}`);
      });
    }

    // Check final database state
    console.log('\n📊 Verifying database state...');
    const { count: finalMessageCount } = await supabase
      .from('conversation_messages')
      .select('*', { count: 'exact', head: true });

    const { count: finalConversationCount } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('integration_type', 'whatsapp');

    console.log(`✅ Database now contains:`);
    console.log(`  - Messages: ${finalMessageCount}`);
    console.log(`  - Conversations: ${finalConversationCount}`);

    console.log('\n🚀 Ready! You can now:');
    console.log('1. Start the development server');
    console.log('2. Open /conversations page');
    console.log('3. View all stored messages and conversations');
    console.log('4. Use RAG functionality with real message data');

  } catch (error) {
    console.error('❌ Storage failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

storeAllEvolutionMessages(); 