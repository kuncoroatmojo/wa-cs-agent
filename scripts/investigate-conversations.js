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

async function investigateConversations() {
  console.log('🔍 Investigating conversations...\n');
  
  try {
    // Get detailed conversation data
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (convError) {
      console.error('❌ Error fetching conversations:', convError);
      return;
    }

    if (!conversations || conversations.length === 0) {
      console.log('📭 No conversations found');
      return;
    }

    console.log(`📋 Found ${conversations.length} conversations (showing latest 10):\n`);

    conversations.forEach((conv, index) => {
      console.log(`${index + 1}. Conversation ID: ${conv.id}`);
      console.log(`   Contact: ${conv.contact_name || 'Unknown'} (${conv.contact_id})`);
      console.log(`   Integration: ${conv.integration_type}`);
      console.log(`   Instance Key: ${conv.instance_key || 'N/A'}`);
      console.log(`   Status: ${conv.status}`);
      console.log(`   Message Count: ${conv.message_count}`);
      console.log(`   Last Message: ${conv.last_message_at ? new Date(conv.last_message_at).toLocaleString() : 'N/A'}`);
      console.log(`   Last Message Preview: ${conv.last_message_preview || 'N/A'}`);
      console.log(`   Created: ${new Date(conv.created_at).toLocaleString()}`);
      console.log(`   User ID: ${conv.user_id}`);
      console.log(`   Integration ID: ${conv.integration_id || 'N/A'}`);
      console.log(`   External Conv ID: ${conv.external_conversation_id || 'N/A'}`);
      console.log(`   Last Synced: ${conv.last_synced_at ? new Date(conv.last_synced_at).toLocaleString() : 'N/A'}`);
      console.log(`   Sync Status: ${conv.sync_status}`);
      console.log('');
    });

    // Check for any sync events
    const { data: syncEvents, error: syncError } = await supabase
      .from('conversation_sync_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (syncError) {
      console.error('❌ Error fetching sync events:', syncError);
    } else if (syncEvents && syncEvents.length > 0) {
      console.log(`📡 Found ${syncEvents.length} sync events (latest 10):\n`);
      syncEvents.forEach((event, index) => {
        console.log(`${index + 1}. Event Type: ${event.event_type}`);
        console.log(`   Integration: ${event.integration_type}`);
        console.log(`   Processed: ${event.processed}`);
        console.log(`   Created: ${new Date(event.created_at).toLocaleString()}`);
        console.log(`   Error: ${event.error_message || 'None'}`);
        console.log('');
      });
    } else {
      console.log('📡 No sync events found\n');
    }

    // Check WhatsApp instances table
    const { data: instances, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .order('created_at', { ascending: false });

    if (instanceError) {
      console.error('❌ Error fetching WhatsApp instances:', instanceError);
    } else if (instances && instances.length > 0) {
      console.log(`📱 Found ${instances.length} WhatsApp instances:\n`);
      instances.forEach((instance, index) => {
        console.log(`${index + 1}. Instance: ${instance.name}`);
        console.log(`   Key: ${instance.instance_key}`);
        console.log(`   Status: ${instance.status}`);
        console.log(`   Connection Type: ${instance.connection_type}`);
        console.log(`   Phone: ${instance.phone_number || 'N/A'}`);
        console.log(`   User ID: ${instance.user_id}`);
        console.log(`   Created: ${new Date(instance.created_at).toLocaleString()}`);
        console.log('');
      });
    } else {
      console.log('📱 No WhatsApp instances found\n');
    }

    // Check if there are any messages in other tables
    const { count: legacyMessageCount, error: legacyError } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true });

    if (!legacyError && legacyMessageCount > 0) {
      console.log(`📝 Found ${legacyMessageCount} messages in legacy 'messages' table`);
      
      const { data: sampleMessages, error: sampleError } = await supabase
        .from('messages')
        .select('*')
        .limit(3);

      if (!sampleError && sampleMessages) {
        console.log('\nSample legacy messages:');
        sampleMessages.forEach((msg, index) => {
          console.log(`${index + 1}. ${msg.type}: ${msg.content?.substring(0, 50)}...`);
          console.log(`   From: ${msg.phone_number} | Instance: ${msg.instance_id}`);
          console.log(`   Direction: ${msg.direction} | Status: ${msg.status}`);
          console.log(`   Created: ${new Date(msg.created_at).toLocaleString()}`);
          console.log('');
        });
      }
    } else {
      console.log('📝 No messages found in legacy messages table\n');
    }

    console.log('✅ Investigation completed!');
    
  } catch (err) {
    console.error('❌ Exception during investigation:', err);
  }
}

investigateConversations(); 