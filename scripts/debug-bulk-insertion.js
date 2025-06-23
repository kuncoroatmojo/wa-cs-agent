import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const SUPABASE_URL = 'https://pfirjlhuulkchogjbvsv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmaXJqbGh1dWxrY2hvZ2pidnN2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDIwNzE0NywiZXhwIjoyMDQ5NzgzMTQ3fQ.nSqBAT-BhNBuXW6EHn6mPf5D9VQDe1b0tEiMPmJJH7Q';
const EVOLUTION_API_URL = 'https://evo.istn.ac.id';
const EVOLUTION_API_KEY = 'YGyPcZ5tn8RfmaATbP5ou9bOP4Usc7Pk4G0k04p9G7iNMpWqbNhga2FOl6T7ud26';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function extractMessageContent(message) {
  if (message.message?.conversation) {
    return message.message.conversation;
  }
  
  if (message.message?.extendedTextMessage?.text) {
    return message.message.extendedTextMessage.text;
  }

  // For media messages, return type description
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

async function debugBulkInsertion() {
  try {
    console.log('🔍 Debugging bulk message insertion...');

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

    // Fetch a small sample of messages
    console.log('\n📨 Fetching sample messages from Evolution API...');
    const response = await fetch(`${EVOLUTION_API_URL}/chat/findMessages/${instanceName}`, {
      method: 'POST',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({}) 
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch messages: ${response.status}`);
    }

    const allMessages = await response.json();
    console.log(`✅ Found ${allMessages.length} total messages`);

    // Take just first 10 messages for debugging
    const sampleMessages = allMessages.slice(0, 10);
    console.log(`🔬 Using ${sampleMessages.length} sample messages for debugging`);

    // Group by conversation
    const messagesByConversation = {};
    sampleMessages.forEach(msg => {
      const remoteJid = msg.key?.remoteJid || 'unknown';
      if (!messagesByConversation[remoteJid]) {
        messagesByConversation[remoteJid] = [];
      }
      messagesByConversation[remoteJid].push(msg);
    });

    console.log(`📊 Grouped into ${Object.keys(messagesByConversation).length} conversations`);

    // Test with first conversation only
    const [firstRemoteJid, firstMessages] = Object.entries(messagesByConversation)[0];
    console.log(`\n🎯 Testing with conversation: ${firstRemoteJid} (${firstMessages.length} messages)`);

    // Ensure conversation exists
    const sortedMessages = firstMessages.sort((a, b) => a.messageTimestamp - b.messageTimestamp);
    const latestMessage = sortedMessages[sortedMessages.length - 1];
    const isGroup = firstRemoteJid.includes('@g.us');
    const contactName = latestMessage.pushName || 
                       (isGroup ? 'Group Chat' : firstRemoteJid.replace('@s.whatsapp.net', ''));

    const conversationData = {
      user_id: userId,
      integration_type: 'whatsapp',
      integration_id: instanceId,
      instance_key: instanceName,
      contact_id: firstRemoteJid,
      contact_name: contactName,
      status: 'active',
      external_conversation_id: firstRemoteJid,
      message_count: firstMessages.length,
      last_message_at: new Date(latestMessage.messageTimestamp * 1000).toISOString(),
      contact_metadata: { 
        pushName: contactName,
        isGroup,
        messageTypes: [...new Set(firstMessages.map(m => m.messageType))]
      }
    };

    console.log('📝 Creating/updating conversation...');
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .upsert(conversationData, { 
        onConflict: 'user_id,integration_type,contact_id,integration_id' 
      })
      .select()
      .single();

    if (convError) {
      console.error('❌ Conversation error:', convError);
      throw new Error(`Failed to create conversation: ${convError.message}`);
    }

    console.log(`✅ Conversation created/updated: ${conversation.id}`);

    // Prepare message inserts
    console.log('\n🔨 Preparing message inserts...');
    const messageInserts = sortedMessages.map((msg, idx) => {
      const messageData = {
        conversation_id: conversation.id,
        external_message_id: msg.key?.id || `debug_msg_${msg.messageTimestamp}_${idx}`,
        content: extractMessageContent(msg),
        message_type: msg.messageType || 'text',
        direction: msg.key?.fromMe ? 'outbound' : 'inbound',
        sender_type: msg.key?.fromMe ? 'agent' : 'contact',
        sender_name: msg.pushName || 'Unknown',
        sender_id: msg.key?.participant || msg.pushName || firstRemoteJid,
        external_timestamp: new Date(msg.messageTimestamp * 1000).toISOString(),
        external_metadata: msg,
        status: 'delivered',
        rag_metadata: {
          hasText: !!(msg.message?.conversation || msg.message?.extendedTextMessage?.text),
          isMedia: !!(msg.message?.imageMessage || msg.message?.audioMessage || msg.message?.videoMessage),
          wordCount: extractMessageContent(msg).split(' ').length
        }
      };
      
      console.log(`  Message ${idx + 1}: ${messageData.external_message_id} - "${messageData.content.substring(0, 50)}..."`);
      return messageData;
    });

    // Test individual insert first
    console.log('\n🧪 Testing individual message insert...');
    const { data: singleInsert, error: singleError } = await supabase
      .from('conversation_messages')
      .insert([messageInserts[0]])
      .select();

    if (singleError) {
      console.error('❌ Single insert failed:', singleError);
      console.error('Failed message data:', JSON.stringify(messageInserts[0], null, 2));
    } else {
      console.log('✅ Single insert successful:', singleInsert[0]?.id);
      
      // Delete the test message
      await supabase
        .from('conversation_messages')
        .delete()
        .eq('id', singleInsert[0].id);
      console.log('🗑️ Cleaned up test message');
    }

    // Test bulk insert
    console.log('\n🚀 Testing bulk insert...');
    const { data: bulkInsert, error: bulkError } = await supabase
      .from('conversation_messages')
      .insert(messageInserts)
      .select();

    if (bulkError) {
      console.error('❌ Bulk insert failed:', bulkError);
      console.error('Full error details:');
      console.error(JSON.stringify(bulkError, null, 2));
      
      // Try to identify problematic message
      console.log('\n🔍 Analyzing message data for issues...');
      messageInserts.forEach((msg, idx) => {
        console.log(`Message ${idx + 1}:`);
        console.log(`  - ID: ${msg.external_message_id}`);
        console.log(`  - Content length: ${msg.content?.length || 0}`);
        console.log(`  - Has external_metadata: ${!!msg.external_metadata}`);
        console.log(`  - Timestamp: ${msg.external_timestamp}`);
        
        // Check for potential issues
        if (!msg.conversation_id) console.log('  ⚠️ Missing conversation_id');
        if (!msg.external_message_id) console.log('  ⚠️ Missing external_message_id');
        if (!msg.content) console.log('  ⚠️ Missing content');
        if (!msg.external_timestamp) console.log('  ⚠️ Missing timestamp');
      });
    } else {
      console.log(`✅ Bulk insert successful: ${bulkInsert.length} messages inserted`);
      
      // Clean up test messages
      const messageIds = bulkInsert.map(m => m.id);
      await supabase
        .from('conversation_messages')
        .delete()
        .in('id', messageIds);
      console.log('🗑️ Cleaned up test messages');
    }

    // Test upsert (what the main script uses)
    console.log('\n🔄 Testing bulk upsert...');
    const { data: upsertResult, error: upsertError } = await supabase
      .from('conversation_messages')
      .upsert(messageInserts, { onConflict: 'external_message_id' })
      .select();

    if (upsertError) {
      console.error('❌ Bulk upsert failed:', upsertError);
      console.error('Full error details:');
      console.error(JSON.stringify(upsertError, null, 2));
    } else {
      console.log(`✅ Bulk upsert successful: ${upsertResult.length} messages upserted`);
      
      // Clean up test messages
      const messageIds = upsertResult.map(m => m.id);
      await supabase
        .from('conversation_messages')
        .delete()
        .in('id', messageIds);
      console.log('🗑️ Cleaned up test messages');
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error('Full error:', error);
  }
}

debugBulkInsertion();
