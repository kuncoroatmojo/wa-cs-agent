#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConversationsTable() {
  console.log('🔍 Checking conversations table...');
  
  try {
    // Check if we can read from the table
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('❌ Error reading conversations table:', error);
      return;
    }
    
    console.log(`✅ Conversations table accessible`);
    console.log(`📊 Found ${data.length} conversations (showing max 5)`);
    
    if (data.length > 0) {
      console.log('\n📋 Sample conversation:');
      console.log(JSON.stringify(data[0], null, 2));
    } else {
      console.log('📭 No conversations found in table');
    }
    
    // Try to insert a test record to see what columns exist
    console.log('\n🧪 Testing table structure...');
    const testRecord = {
      integration_type: 'whatsapp',
      contact_id: 'test_contact',
      contact_name: 'Test Contact'
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('conversations')
      .insert([testRecord])
      .select();
    
    if (insertError) {
      console.log('⚠️ Insert test failed (this shows missing columns):');
      console.log('Error:', insertError.message);
      
      if (insertError.message.includes('user_id')) {
        console.log('🔍 The user_id column constraint is failing');
        console.log('This suggests the table exists but may not have proper foreign key setup');
      }
    } else {
      console.log('✅ Test insert successful');
      console.log('Test record:', insertData);
      
      // Clean up test record
      if (insertData && insertData[0]) {
        await supabase
          .from('conversations')
          .delete()
          .eq('id', insertData[0].id);
        console.log('🧹 Test record cleaned up');
      }
    }
    
  } catch (err) {
    console.error('❌ Exception checking conversations table:', err);
  }
}

checkConversationsTable(); 