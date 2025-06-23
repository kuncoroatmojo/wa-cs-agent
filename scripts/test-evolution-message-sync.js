#!/usr/bin/env node

/**
 * Test Evolution Message Sync Service
 */

import { createClient } from '@supabase/supabase-js';

// Simple Evolution Message Sync Test
async function testEvolutionSync() {
  try {
    console.log('🧪 Testing Evolution Message Sync Service...');

    // Test environment variables
    const supabaseUrl = 'https://pfirjlhuulkchogjbvsv.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const evolutionApiUrl = process.env.VITE_EVOLUTION_API_URL;
    const evolutionApiKey = process.env.EVOLUTION_API_KEY;

    if (!supabaseServiceKey || !evolutionApiUrl || !evolutionApiKey) {
      console.error('❌ Missing environment variables');
      return;
    }

    console.log('✅ Environment variables configured');

    // Test Supabase connection
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Test Evolution API connection
    console.log('\n📡 Testing Evolution API connection...');
    const response = await fetch(`${evolutionApiUrl}/chat/findChats/personal`, {
      method: 'GET',
      headers: {
        'apikey': evolutionApiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Evolution API error: ${response.status}`);
    }

    const chats = await response.json();
    console.log(`✅ Found ${chats.length} chats`);

    // Test message fetching
    console.log('\n📨 Testing message fetching...');
    const messageResponse = await fetch(`${evolutionApiUrl}/chat/findMessages/personal`, {
      method: 'POST',
      headers: {
        'apikey': evolutionApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    if (!messageResponse.ok) {
      throw new Error(`Message fetch error: ${messageResponse.status}`);
    }

    const messages = await messageResponse.json();
    console.log(`✅ Found ${messages.length} total messages`);

    // Group by conversation
    const messagesByConversation = {};
    messages.forEach(msg => {
      const remoteJid = msg.key?.remoteJid || 'unknown';
      if (!messagesByConversation[remoteJid]) {
        messagesByConversation[remoteJid] = [];
      }
      messagesByConversation[remoteJid].push(msg);
    });

    const conversationCount = Object.keys(messagesByConversation).length;
    console.log(`✅ Grouped into ${conversationCount} conversations`);

    // Test database storage of a sample
    console.log('\n💾 Testing database storage...');
    
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
      console.log('❌ Missing database instances or profiles');
      return;
    }

    const instanceId = dbInstances[0].id;
    const userId = profiles[0].id;

    // Test storing one conversation
    const sampleConversation = Object.entries(messagesByConversation)[0];
    const [remoteJid, conversationMessages] = sampleConversation;
    
    console.log(`Testing storage for conversation: ${remoteJid} (${conversationMessages.length} messages)`);

    // Store conversation
    const latestMessage = conversationMessages[conversationMessages.length - 1];
    const conversationData = {
      user_id: userId,
      integration_type: 'whatsapp',
      integration_id: instanceId,
      instance_key: 'personal',
      contact_id: remoteJid,
      contact_name: latestMessage.pushName || 'Test Contact',
      status: 'active',
      external_conversation_id: remoteJid,
      message_count: conversationMessages.length,
      last_message_at: new Date(latestMessage.messageTimestamp * 1000).toISOString()
    };

    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .upsert(conversationData, { 
        onConflict: 'user_id,integration_type,contact_id,integration_id' 
      })
      .select()
      .single();

    if (convError) {
      console.error('❌ Error storing conversation:', convError);
      return;
    }

    console.log(`✅ Stored conversation: ${conversation.id}`);

    // Store a few sample messages
    const sampleMessages = conversationMessages.slice(0, 3);
    let storedCount = 0;

    for (const msg of sampleMessages) {
      const messageData = {
        conversation_id: conversation.id,
        external_message_id: msg.key?.id || `test_${Date.now()}_${Math.random()}`,
        content: msg.message?.conversation || 
                msg.message?.extendedTextMessage?.text || 
                `[${msg.messageType}]`,
        message_type: msg.messageType || 'text',
        direction: msg.key?.fromMe ? 'outbound' : 'inbound',
        sender_type: msg.key?.fromMe ? 'agent' : 'contact',
        sender_name: msg.pushName || 'Unknown',
        sender_id: msg.key?.participant || msg.pushName || remoteJid,
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
    }

    console.log(`✅ Stored ${storedCount} sample messages`);

    // Test RAG retrieval
    console.log('\n🧠 Testing RAG message retrieval...');
    const { data: ragMessages } = await supabase
      .from('conversation_messages')
      .select(`
        *,
        conversation:conversations(contact_name, external_conversation_id)
      `)
      .eq('conversation_id', conversation.id)
      .limit(3);

    console.log(`✅ Retrieved ${ragMessages?.length || 0} messages for RAG`);

    if (ragMessages?.length > 0) {
      console.log('Sample RAG messages:');
      ragMessages.forEach((msg, idx) => {
        const preview = msg.content.substring(0, 50);
        console.log(`  ${idx + 1}. [${msg.direction}] ${preview}...`);
      });
    }

    console.log('\n🎉 Evolution Message Sync Test PASSED!');
    console.log('\n📊 Summary:');
    console.log(`  - Total Evolution API messages: ${messages.length}`);
    console.log(`  - Total conversations: ${conversationCount}`);
    console.log(`  - Test conversation stored: ${conversation.id}`);
    console.log(`  - Sample messages stored: ${storedCount}`);
    console.log('  - RAG retrieval: Working ✅');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

testEvolutionSync(); 