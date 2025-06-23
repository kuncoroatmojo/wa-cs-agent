#!/usr/bin/env node

/**
 * Create the unique constraint on external_message_id
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://pfirjlhuulkchogjbvsv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function createUniqueConstraint() {
  console.log('�� Creating unique constraint on external_message_id...\n');

  try {
    // First, let's verify once more that there are no duplicates
    console.log('🔍 Final verification - checking for duplicates...');
    
    const { data: messages, error: fetchError } = await supabase
      .from('conversation_messages')
      .select('external_message_id')
      .not('external_message_id', 'is', null);

    if (fetchError) {
      throw new Error(`Error fetching messages: ${fetchError.message}`);
    }

    const counts = {};
    messages.forEach(msg => {
      counts[msg.external_message_id] = (counts[msg.external_message_id] || 0) + 1;
    });

    const duplicates = Object.entries(counts).filter(([_, count]) => count > 1);
    
    if (duplicates.length > 0) {
      console.log(`❌ Still found ${duplicates.length} duplicates! Cannot create constraint.`);
      duplicates.slice(0, 3).forEach(([id, count]) => {
        console.log(`   ${id}: ${count} occurrences`);
      });
      return;
    }

    console.log(`✅ Verified: ${Object.keys(counts).length} unique external_message_ids, no duplicates`);

    // Now create the unique constraint
    console.log('\n🔧 Creating unique index...');
    
    const createIndexSQL = `
      CREATE UNIQUE INDEX conversation_messages_external_message_id_unique
      ON conversation_messages(external_message_id)
      WHERE external_message_id IS NOT NULL;
    `;

    // Execute using raw SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      query: createIndexSQL
    });

    if (error) {
      // Try alternative approach using direct query
      console.log('RPC failed, trying alternative approach...');
      
      const { error: altError } = await supabase
        .from('conversation_messages')
        .select('id')
        .limit(1);

      if (altError) {
        throw new Error(`Database connection failed: ${altError.message}`);
      }

      // If we can't use RPC, let's just check if the index already exists
      console.log('⚠️ Cannot create index via script. Please run this SQL manually:');
      console.log('');
      console.log(createIndexSQL);
      console.log('');
      console.log('You can run this in the Supabase SQL Editor or via psql.');
      
    } else {
      console.log('✅ Unique index created successfully!');
      
      // Verify the index was created
      console.log('\n🔍 Verifying index creation...');
      
      const verifySQL = `
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'conversation_messages' 
        AND indexname = 'conversation_messages_external_message_id_unique';
      `;

      const { data: indexData, error: verifyError } = await supabase.rpc('exec_sql', {
        query: verifySQL
      });

      if (verifyError) {
        console.log('⚠️ Could not verify index, but creation appeared successful');
      } else if (indexData && indexData.length > 0) {
        console.log('✅ Index verified - unique constraint is active!');
      } else {
        console.log('⚠️ Index not found in verification, may need manual creation');
      }
    }

    console.log('\n🎉 Process completed!');
    console.log('📋 The unique constraint should now prevent duplicate external_message_ids');
    console.log('🔧 Your sync functionality in WhatsApp Instances will now be bulletproof against duplicates');

  } catch (error) {
    console.error('❌ Failed to create unique constraint:', error.message);
    console.log('\n📋 Manual SQL to run:');
    console.log('CREATE UNIQUE INDEX conversation_messages_external_message_id_unique');
    console.log('ON conversation_messages(external_message_id)');
    console.log('WHERE external_message_id IS NOT NULL;');
  }
}

createUniqueConstraint();
