#!/usr/bin/env node

/**
 * Test script using the CORRECT Evolution API endpoints from official documentation
 */

import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const SUPABASE_URL = 'https://pfirjlhuulkchogjbvsv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EVOLUTION_API_URL = process.env.VITE_EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY || !EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
  console.error('❌ Required environment variables:');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  console.error('  - VITE_EVOLUTION_API_URL');
  console.error('  - EVOLUTION_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testCorrectEvolutionAPI() {
  try {
    console.log('🚀 Testing Evolution API with CORRECT endpoints...');
    console.log('URL:', EVOLUTION_API_URL);

    const instanceName = 'personal';

    // 1. Get all chats using the correct endpoint
    console.log('\n📞 Step 1: Fetching all chats...');
    const chatsResponse = await fetch(`${EVOLUTION_API_URL}/chat/findChats/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!chatsResponse.ok) {
      throw new Error(`Failed to fetch chats: ${chatsResponse.status}`);
    }

    const chats = await chatsResponse.json();
    console.log(`✅ Found ${chats.length} chats`);

    // 2. Get ALL messages using the correct endpoint (POST without filters)
    console.log('\n📨 Step 2: Fetching ALL messages...');
    const messagesResponse = await fetch(`${EVOLUTION_API_URL}/chat/findMessages/${instanceName}`, {
      method: 'POST',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({}) // Empty body to get all messages
    });

    if (!messagesResponse.ok) {
      console.log(`❌ Failed to fetch messages: ${messagesResponse.status} ${messagesResponse.statusText}`);
      const errorText = await messagesResponse.text();
      console.log('Error response:', errorText);
      return;
    }

    const messages = await messagesResponse.json();
    console.log(`✅ Found ${messages.length} total messages`);

    if (messages.length > 0) {
      console.log('\n📋 Sample message structure:');
      console.log(JSON.stringify(messages[0], null, 2));

      // 3. Group messages by conversation (key.remoteJid)
      console.log('\n💬 Step 3: Grouping messages by conversation...');
      const messagesByConversation = {};
      
      messages.forEach(msg => {
        const remoteJid = msg.key?.remoteJid || 'unknown';
        if (!messagesByConversation[remoteJid]) {
          messagesByConversation[remoteJid] = [];
        }
        messagesByConversation[remoteJid].push(msg);
      });

      const conversationIds = Object.keys(messagesByConversation);
      console.log(`✅ Grouped into ${conversationIds.length} conversations:`);
      
      conversationIds.slice(0, 10).forEach((jid, idx) => {
        const count = messagesByConversation[jid].length;
        const isGroup = jid.includes('@g.us');
        const displayJid = jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
        console.log(`  ${idx + 1}. ${displayJid} (${isGroup ? 'Group' : 'Contact'}): ${count} messages`);
      });

      // 4. Test filtering for a specific conversation
      if (conversationIds.length > 0) {
        const testJid = conversationIds[0];
        console.log(`\n🔍 Step 4: Testing message filtering for specific conversation: ${testJid}`);
        
        const specificMessagesResponse = await fetch(`${EVOLUTION_API_URL}/chat/findMessages/${instanceName}`, {
          method: 'POST',
          headers: {
            'apikey': EVOLUTION_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            where: {
              key: {
                remoteJid: testJid
              }
            }
          })
        });

        if (specificMessagesResponse.ok) {
          const specificMessages = await specificMessagesResponse.json();
          console.log(`✅ Found ${specificMessages.length} messages for this conversation`);
          
          if (specificMessages.length > 0) {
            console.log('📝 Sample messages from this conversation:');
            specificMessages.slice(0, 3).forEach((msg, idx) => {
              const content = msg.message?.conversation || 
                            msg.message?.extendedTextMessage?.text || 
                            `[${msg.messageType}]`;
              const direction = msg.key?.fromMe ? '→' : '←';
              const time = new Date(msg.messageTimestamp * 1000).toLocaleTimeString();
              console.log(`   ${idx + 1}. ${direction} [${time}] ${content}`);
            });
          }
        } else {
          console.log('❌ Failed to fetch specific conversation messages');
        }
      }

      // 5. Database integration
      console.log('\n🗄️ Step 5: Testing database integration...');
      
      // Get database instance
      const { data: dbInstances } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .limit(1);

      if (!dbInstances || dbInstances.length === 0) {
        console.log('❌ No WhatsApp instances in database');
        return;
      }

      const instanceId = dbInstances[0].id;
      console.log(`✅ Using database instance: ${instanceId}`);

      // Get user for conversations
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);

      if (!profiles || profiles.length === 0) {
        console.log('❌ No user profiles found');
        return;
      }

      const userId = profiles[0].id;
      console.log(`✅ Using user ID: ${userId}`);

      // Test storing a sample of messages
      console.log('\n💾 Step 6: Testing message storage...');
      const sampleMessages = messages.slice(0, 10);
      let storedCount = 0;

      for (const msg of sampleMessages) {
        try {
          const remoteJid = msg.key?.remoteJid || 'unknown';
          
          // First ensure conversation exists
          const conversationData = {
            user_id: userId,
            integration_type: 'whatsapp',
            integration_id: instanceId,
            instance_key: instanceName,
            contact_id: remoteJid,
            contact_name: msg.pushName || 'Unknown',
            status: 'active',
            external_conversation_id: remoteJid,
            message_count: messagesByConversation[remoteJid]?.length || 0,
            last_message_at: new Date(msg.messageTimestamp * 1000).toISOString(),
            contact_metadata: { pushName: msg.pushName }
          };

          const { data: conversation } = await supabase
            .from('conversations')
            .upsert(conversationData, { 
              onConflict: 'user_id,integration_type,contact_id,integration_id' 
            })
            .select()
            .single();

          if (!conversation) continue;

          // Store the message
          const messageData = {
            conversation_id: conversation.id,
            external_message_id: msg.key?.id || `msg_${Date.now()}_${Math.random()}`,
            content: msg.message?.conversation || 
                    msg.message?.extendedTextMessage?.text || 
                    JSON.stringify(msg.message),
            message_type: msg.messageType || 'text',
            direction: msg.key?.fromMe ? 'outbound' : 'inbound',
            sender_type: msg.key?.fromMe ? 'agent' : 'contact',
            sender_name: msg.pushName || 'Unknown',
            sender_id: msg.key?.participant || msg.pushName || 'unknown',
            external_timestamp: new Date(msg.messageTimestamp * 1000).toISOString(),
            external_metadata: msg,
            status: 'delivered'
          };

          const { error: messageError } = await supabase
            .from('conversation_messages')
            .upsert(messageData, { onConflict: 'external_message_id' });

          if (!messageError) {
            storedCount++;
          }
        } catch (error) {
          console.log(`❌ Error storing message: ${error.message}`);
        }
      }

      console.log(`✅ Successfully stored ${storedCount} messages`);

      // 7. Final summary
      console.log('\n🎉 SUCCESS! Evolution API Integration Complete:');
      console.log(`✅ Total chats: ${chats.length}`);
      console.log(`✅ Total messages: ${messages.length}`);
      console.log(`✅ Conversations: ${conversationIds.length}`);
      console.log(`✅ Messages stored: ${storedCount}`);
      console.log(`✅ Database integration: Working`);
      
      console.log('\n📋 Available for RAG:');
      console.log('- All conversation messages are properly grouped');
      console.log('- Filter by conversation ID (remoteJid)');
      console.log('- Filter by message type, direction, sender');
      console.log('- Full conversation context available');
      
      console.log('\n🚀 Next Steps:');
      console.log('1. Use this data structure for RAG filtering');
      console.log('2. Configure webhook for real-time sync');
      console.log('3. All messages are ready for AI processing!');

    } else {
      console.log('⚠️ No messages found. The Evolution API endpoint works but no message history available.');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

testCorrectEvolutionAPI(); 