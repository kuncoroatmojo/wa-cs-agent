#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

console.log('Creating Supabase client with URL:', SUPABASE_URL);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  console.log('🔧 Applying migration...');

  // Drop the unique constraint on external_message_id since it's optional
  const { error: error1 } = await supabase.rpc('alter_table', {
    sql: 'ALTER TABLE conversation_messages DROP CONSTRAINT IF EXISTS conversation_messages_external_message_id_key'
  });

  if (error1) {
    console.error('❌ Error dropping external_message_id constraint:', error1);
  } else {
    console.log('✅ Dropped external_message_id constraint');
  }

  // Drop the unique constraint on conversations
  const { error: error2 } = await supabase.rpc('alter_table', {
    sql: 'ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_user_id_integration_type_contact_id_integration_id_key'
  });

  if (error2) {
    console.error('❌ Error dropping conversations constraint:', error2);
  } else {
    console.log('✅ Dropped conversations constraint');
  }

  // Add new unique constraint on conversations
  const { error: error3 } = await supabase.rpc('alter_table', {
    sql: 'ALTER TABLE conversations ADD CONSTRAINT conversations_user_id_integration_type_contact_id_key UNIQUE (user_id, integration_type, contact_id)'
  });

  if (error3) {
    console.error('❌ Error adding new conversations constraint:', error3);
  } else {
    console.log('✅ Added new conversations constraint');
  }

  console.log('✅ Migration completed!');
}

applyMigration().catch(console.error); 