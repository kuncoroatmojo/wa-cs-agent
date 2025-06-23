#!/usr/bin/env node

/**
 * Test script for Evolution API message synchronization
 * This script tests the new message sync functionality for RAG purposes
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// Load environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://pfirjlhuulkchogjbvsv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EVOLUTION_API_URL = process.env.VITE_EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.VITE_EVOLUTION_API_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY || !EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
  console.error('❌ Required environment variables:');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  console.error('  - VITE_EVOLUTION_API_URL');
  console.error('  - VITE_EVOLUTION_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testEvolutionAPI() {
  try {
    console.log('🚀 Starting comprehensive message sync test...');
    console.log('🔄 Testing Evolution API connection...');
    console.log('URL:', EVOLUTION_API_URL);

    // Get instances
    const instanceResponse = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!instanceResponse.ok) {
      throw new Error(`Failed to fetch instances: ${instanceResponse.status}`);
    }

    const instancesData = await instanceResponse.json();
    console.log('✅ Evolution API connected successfully');
    console.log(`📱 Available instances: ${instancesData.length}`);

    const connectedInstances = instancesData.filter(item => 
      item.instance && item.instance.status === 'open'
    );

    if (connectedInstances.length === 0) {
      console.log('⚠️ No connected instances found');
      return;
    }

    console.log(`✅ Found ${connectedInstances.length} connected instances`);

    // Test message fetching for each connected instance
    for (const instanceData of connectedInstances) {
      const instance = instanceData.instance;
      const instanceName = instance.instanceName;
      
      console.log(`\n📞 Testing instance: ${instanceName} (${instance.status})`);
      console.log(`👤 Owner: ${instance.owner}`);
      console.log(`📝 Profile: ${instance.profileName}`);

      try {
        // Test message fetching
        console.log('🔍 Fetching messages...');
        const messagesResponse = await fetch(`${EVOLUTION_API_URL}/chat/findMessages/${instanceName}`, {
          method: 'GET',
          headers: {
            'apikey': EVOLUTION_API_KEY,
            'Content-Type': 'application/json'
          }
        });

        if (!messagesResponse.ok) {
          console.log(`❌ Failed to fetch messages: ${messagesResponse.status} ${messagesResponse.statusText}`);
          const errorText = await messagesResponse.text();
          console.log('Error response:', errorText);
          continue;
        }

        const messagesData = await messagesResponse.json();
        console.log(`📨 Found ${messagesData.length || 0} messages`);

        if (messagesData.length > 0) {
          const firstMessage = messagesData[0];
          console.log('📋 Sample message structure:');
          console.log(JSON.stringify(firstMessage, null, 2));

          // Group messages by conversation
          const conversationGroups = {};
          messagesData.forEach(msg => {
            const key = msg.key?.remoteJid || msg.remoteJid || 'unknown';
            if (!conversationGroups[key]) {
              conversationGroups[key] = [];
            }
            conversationGroups[key].push(msg);
          });

          console.log(`💬 Messages grouped into ${Object.keys(conversationGroups).length} conversations:`);
          for (const [remoteJid, messages] of Object.entries(conversationGroups)) {
            console.log(`  - ${remoteJid}: ${messages.length} messages`);
          }

          // Test database insertion for a small sample
          console.log('\n🗄️ Testing database integration...');
          
          // Check if we have any existing instances in our database
          const { data: dbInstances, error: instanceError } = await supabase
            .from('whatsapp_instances')
            .select('*')
            .limit(5);

          if (instanceError) {
            console.log('❌ Database error:', instanceError.message);
            return;
          }

          console.log(`💾 Found ${dbInstances.length} instances in database`);
          
          if (dbInstances.length === 0) {
            console.log('⚠️ No WhatsApp instances in database. Creating one for testing...');
            
            const { data: newInstance, error: insertError } = await supabase
              .from('whatsapp_instances')
              .insert({
                name: instanceName,
                instance_id: instance.instanceId,
                phone_number: instance.owner,
                status: 'connected',
                qr_code: null,
                webhook_url: `https://pfirjlhuulkchogjbvsv.supabase.co/functions/v1/whatsapp-webhook`,
                api_url: EVOLUTION_API_URL,
                api_key: EVOLUTION_API_KEY
              })
              .select()
              .single();

            if (insertError) {
              console.log('❌ Failed to create instance:', insertError.message);
              return;
            }

            console.log('✅ Created database instance:', newInstance.id);
          }

          // Test inserting a few sample messages
          const sampleMessages = messagesData.slice(0, 3);
          console.log(`📝 Testing insertion of ${sampleMessages.length} sample messages...`);

          for (const msg of sampleMessages) {
            try {
              const messageData = {
                whatsapp_instance_id: dbInstances[0]?.id || newInstance.id,
                external_message_id: msg.key?.id || msg.id || `test_${Date.now()}`,
                conversation_id: msg.key?.remoteJid || msg.remoteJid || 'unknown',
                sender_phone: msg.key?.participant || msg.pushName || 'unknown',
                content: msg.message?.conversation || msg.message?.extendedTextMessage?.text || JSON.stringify(msg.message),
                message_type: 'text',
                direction: msg.key?.fromMe ? 'outbound' : 'inbound',
                timestamp: new Date(msg.messageTimestamp * 1000).toISOString(),
                raw_data: msg
              };

              const { error: messageError } = await supabase
                .from('conversation_messages')
                .upsert(messageData, { onConflict: 'external_message_id' });

              if (messageError) {
                console.log('❌ Message insert error:', messageError.message);
              } else {
                console.log('✅ Inserted message:', messageData.external_message_id);
              }
            } catch (error) {
              console.log('❌ Error processing message:', error.message);
            }
          }
        }
      } catch (error) {
        console.log(`❌ Error testing instance ${instanceName}:`, error.message);
      }
    }

    console.log('\n🎉 Message sync test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

testEvolutionAPI(); 