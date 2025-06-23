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

async function testWebhookSetup() {
  console.log('🔍 Testing webhook setup and checking events...\n');
  
  try {
    // Check recent sync events in detail
    const { data: syncEvents, error: syncError } = await supabase
      .from('conversation_sync_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (syncError) {
      console.error('❌ Error fetching sync events:', syncError);
    } else {
      console.log(`📡 Found ${syncEvents?.length || 0} sync events in database`);
      
      if (syncEvents && syncEvents.length > 0) {
        console.log('\nRecent sync events:');
        syncEvents.forEach((event, index) => {
          console.log(`${index + 1}. ${event.event_type} - ${event.integration_type}`);
          console.log(`   Processed: ${event.processed}`);
          console.log(`   Created: ${new Date(event.created_at).toLocaleString()}`);
          console.log(`   Error: ${event.error_message || 'None'}`);
          console.log(`   Data: ${JSON.stringify(event.event_data).substring(0, 100)}...`);
          console.log('');
        });
      } else {
        console.log('⚠️ No sync events found - this suggests webhooks are not being received\n');
      }
    }

    // Check Edge Function logs (if accessible)
    console.log('🔗 Webhook URL should be:');
    console.log(`   ${supabaseUrl}/functions/v1/whatsapp-webhook`);
    console.log('');

    // Check specific messages that should exist based on conversation previews
    console.log('🔍 Checking specific message content vs database...\n');
    
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id, contact_name, last_message_preview, external_conversation_id')
      .limit(5);

    if (convError) {
      console.error('❌ Error fetching conversations:', convError);
    } else if (conversations) {
      for (const conv of conversations) {
        console.log(`📱 Conversation: ${conv.contact_name || 'Unknown'}`);
        console.log(`   Preview: ${conv.last_message_preview?.substring(0, 50)}...`);
        
        // Check if we have messages for this conversation
        const { count: messageCount, error: msgError } = await supabase
          .from('conversation_messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id);

        if (msgError) {
          console.log(`   ❌ Error checking messages: ${msgError.message}`);
        } else {
          console.log(`   💬 Messages in DB: ${messageCount || 0}`);
          
          if (messageCount === 0 && conv.last_message_preview && conv.last_message_preview !== '[Media]') {
            console.log('   ⚠️ MISMATCH: Preview exists but no messages in DB');
          }
        }
        console.log('');
      }
    }

    // Test if we can insert a sample message (to check constraints)
    console.log('🧪 Testing message insertion constraints...');
    
    const { data: testConv } = await supabase
      .from('conversations')
      .select('id, user_id')
      .limit(1)
      .single();

    if (testConv) {
      const testMessage = {
        conversation_id: testConv.id,
        content: 'Test message from webhook investigation',
        message_type: 'text',
        direction: 'inbound',
        sender_type: 'contact',
        sender_name: 'Test Contact',
        status: 'delivered',
        external_message_id: `test_msg_${Date.now()}`,
        external_timestamp: new Date().toISOString(),
        external_metadata: { test: true }
      };

      const { data: insertResult, error: insertError } = await supabase
        .from('conversation_messages')
        .insert([testMessage])
        .select();

      if (insertError) {
        console.log(`❌ Test message insertion failed: ${insertError.message}`);
        console.log('This suggests constraint issues in the database schema');
      } else {
        console.log('✅ Test message insertion successful');
        console.log('Database schema constraints are working correctly');
        
        // Clean up test message
        if (insertResult && insertResult[0]) {
          await supabase
            .from('conversation_messages')
            .delete()
            .eq('id', insertResult[0].id);
          console.log('🧹 Test message cleaned up');
        }
      }
    } else {
      console.log('⚠️ No conversations found to test message insertion');
    }

    console.log('\n📋 SUMMARY:');
    console.log('================');
    console.log('1. Check if Evolution API webhook is configured correctly');
    console.log('2. Verify webhook events are being sent to Supabase function');
    console.log('3. Check Supabase Edge Function logs for errors');
    console.log('4. Ensure webhook URL is accessible from Evolution API server');
    console.log('\n✅ Webhook investigation completed!');
    
  } catch (err) {
    console.error('❌ Exception during webhook testing:', err);
  }
}

testWebhookSetup(); 