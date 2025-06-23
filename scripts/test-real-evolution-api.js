#!/usr/bin/env node

/**
 * Test script for the actual Evolution API endpoints we discovered
 */

import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pfirjlhuulkchogjbvsv.supabase.co';
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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testRealEvolutionAPI() {
  try {
    console.log('🚀 Testing Real Evolution API Integration...');
    console.log('URL:', EVOLUTION_API_URL);

    const instanceName = 'personal';

    // 1. Get chats (we know this works)
    console.log('\n📞 Fetching chats...');
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

    // Show some sample chats
    console.log('\n📋 Sample chats:');
    chats.slice(0, 5).forEach((chat, idx) => {
      console.log(`  ${idx + 1}. ${chat.id} (owner: ${chat.owner})`);
    });

    // 2. Database integration test
    console.log('\n🗄️ Testing database integration...');
    
    // Check existing instances
    const { data: dbInstances, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .limit(5);

    if (instanceError) {
      console.log('❌ Database error:', instanceError.message);
      return;
    }

    console.log(`💾 Found ${dbInstances.length} instances in database`);
    
    let instanceId;
    if (dbInstances.length === 0) {
      console.log('📝 Creating instance in database...');
      
      const { data: newInstance, error: insertError } = await supabase
        .from('whatsapp_instances')
        .insert({
          name: instanceName,
          instance_id: '7b27a294-95a2-4bf2-b15c-4ea3c834c1f6',
          phone_number: '6281321249433@s.whatsapp.net',
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

      instanceId = newInstance.id;
      console.log('✅ Created database instance:', instanceId);
    } else {
      instanceId = dbInstances[0].id;
      console.log('✅ Using existing instance:', instanceId);
    }

    // 3. Store chat information as conversations
    console.log('\n💬 Storing chat information as conversations...');
    
    // First, get a test user ID since conversations require user_id
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
    
    let storedCount = 0;
    
    if (profileError || !profiles || profiles.length === 0) {
      console.log('❌ No user profiles found. Skipping conversation storage.');
      console.log('💡 Create a user account first to store conversations.');
    } else {
      const testUserId = profiles[0].id;
      console.log(`📝 Using user ID: ${testUserId}`);
      
      const sampleChats = chats.slice(0, 10); // Store first 10 chats
      
      for (const chat of sampleChats) {
        try {
          const conversationData = {
            user_id: testUserId,
            integration_type: 'whatsapp',
            integration_id: instanceId,
            instance_key: instanceName,
            contact_id: chat.id,
            contact_name: chat.name || 'Unknown',
            status: 'active',
            external_conversation_id: chat.id,
            message_count: 0,
            last_message_at: new Date().toISOString(),
            contact_metadata: chat
          };

          const { error: conversationError } = await supabase
            .from('conversations')
            .upsert(conversationData, { 
              onConflict: 'user_id,integration_type,contact_id,integration_id' 
            });

          if (conversationError) {
            console.log(`❌ Error storing conversation ${chat.id}:`, conversationError.message);
          } else {
            storedCount++;
          }
        } catch (error) {
          console.log(`❌ Error processing chat ${chat.id}:`, error.message);
        }
      }
      
      console.log(`✅ Stored ${storedCount} conversations in database`);
    }

    // 4. Summary
    console.log('\n📊 Evolution API Integration Summary:');
    console.log('✅ Evolution API connection: Working');
    console.log(`✅ Chats found: ${chats.length}`);
    console.log('❓ Direct message endpoint: Not found yet');
    console.log('✅ Database integration: Working');
    console.log(`✅ Conversations stored: ${storedCount}`);
    
    console.log('\n🔍 Next Steps:');
    console.log('1. Evolution API may require different authentication or endpoints for messages');
    console.log('2. Consider using webhook-based message capture instead of polling');
    console.log('3. Configure webhook URL in Evolution API to capture messages in real-time');
    console.log('4. Messages will be captured via webhook as they arrive');
    
    console.log('\n🌐 Webhook Configuration:');
    console.log('Set your Evolution API webhook URL to:');
    console.log('https://pfirjlhuulkchogjbvsv.supabase.co/functions/v1/whatsapp-webhook');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

testRealEvolutionAPI(); 