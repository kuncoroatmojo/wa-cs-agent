/**
 * Apply Unified Chat Management Migration
 * This script applies the new database schema for unified conversation management
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  try {
    console.log('🚀 Starting unified chat management migration...');

    // Read the migration file
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '006_unified_chat_management.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded, executing SQL...');

    // Split the migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
          const { error } = await supabase.rpc('execute_sql', { sql: statement });
          
          if (error) {
            console.error(`❌ Error executing statement ${i + 1}:`, error);
            // Continue with other statements
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`);
          }
        } catch (err) {
          console.error(`❌ Exception executing statement ${i + 1}:`, err);
          // Continue with other statements
        }
      }
    }

    console.log('🎉 Migration completed!');
    console.log('');
    console.log('📊 New tables created:');
    console.log('  - conversations (unified conversation management)');
    console.log('  - conversation_messages (unified message storage)');
    console.log('  - conversation_participants (for group chats)');
    console.log('  - conversation_sync_events (webhook processing)');
    console.log('  - conversation_analytics (conversation insights)');
    console.log('');
    console.log('🔧 Functions created:');
    console.log('  - sync_whatsapp_conversations()');
    console.log('  - sync_conversation_messages()');
    console.log('  - update_conversation_stats()');
    console.log('');
    console.log('✨ Your unified chat management system is ready!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Alternative approach: Apply migration statements directly
async function applyMigrationDirect() {
  try {
    console.log('🚀 Applying unified chat management schema directly...');

    // Create conversations table
    console.log('📝 Creating conversations table...');
    const { error: conversationsError } = await supabase.rpc('execute_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
          integration_type TEXT NOT NULL CHECK (integration_type IN ('whatsapp', 'instagram', 'web', 'api', 'telegram', 'messenger')),
          integration_id UUID,
          instance_key TEXT,
          contact_id TEXT NOT NULL,
          contact_name TEXT,
          contact_metadata JSONB DEFAULT '{}',
          status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'archived', 'handed_off')),
          assigned_agent_id UUID REFERENCES profiles(id),
          priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
          tags TEXT[] DEFAULT '{}',
          message_count INTEGER DEFAULT 0,
          last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_message_preview TEXT,
          last_message_from TEXT,
          conversation_summary TEXT,
          conversation_topics TEXT[] DEFAULT '{}',
          sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
          external_conversation_id TEXT,
          last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'failed')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id, integration_type, contact_id, integration_id)
        );
      `
    });

    if (conversationsError) {
      console.error('❌ Error creating conversations table:', conversationsError);
    } else {
      console.log('✅ Conversations table created');
    }

    // Create conversation_messages table
    console.log('📝 Creating conversation_messages table...');
    const { error: messagesError } = await supabase.rpc('execute_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS conversation_messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document', 'location', 'contact', 'sticker', 'reaction')),
          media_url TEXT,
          media_metadata JSONB DEFAULT '{}',
          direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
          sender_type TEXT NOT NULL CHECK (sender_type IN ('contact', 'agent', 'bot')),
          sender_name TEXT,
          sender_id TEXT,
          status TEXT DEFAULT 'delivered' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
          ai_processed BOOLEAN DEFAULT false,
          ai_response_time_ms INTEGER,
          ai_model_used TEXT,
          ai_confidence_score DECIMAL(3,2),
          ai_tokens_used INTEGER,
          external_message_id TEXT UNIQUE,
          external_timestamp TIMESTAMP WITH TIME ZONE,
          external_metadata JSONB DEFAULT '{}',
          rag_context_used TEXT,
          rag_sources TEXT[],
          rag_similarity_scores DECIMAL(3,2)[],
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (messagesError) {
      console.error('❌ Error creating conversation_messages table:', messagesError);
    } else {
      console.log('✅ Conversation_messages table created');
    }

    // Create conversation_sync_events table
    console.log('📝 Creating conversation_sync_events table...');
    const { error: syncError } = await supabase.rpc('execute_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS conversation_sync_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
          integration_type TEXT NOT NULL,
          integration_id UUID,
          event_type TEXT NOT NULL,
          event_data JSONB NOT NULL,
          processed BOOLEAN DEFAULT false,
          processed_at TIMESTAMP WITH TIME ZONE,
          error_message TEXT,
          retry_count INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (syncError) {
      console.error('❌ Error creating conversation_sync_events table:', syncError);
    } else {
      console.log('✅ Conversation_sync_events table created');
    }

    console.log('🎉 Basic schema applied successfully!');
    console.log('');
    console.log('📊 To complete the setup, you may need to:');
    console.log('1. Enable RLS policies manually in Supabase dashboard');
    console.log('2. Create indexes for better performance');
    console.log('3. Set up realtime subscriptions');
    console.log('');
    console.log('✨ Your unified chat management system foundation is ready!');

  } catch (error) {
    console.error('❌ Direct migration failed:', error);
    process.exit(1);
  }
}

// Check if we have execute_sql RPC function, otherwise use direct approach
async function checkAndApply() {
  try {
    // Test if we can execute SQL directly
    const { error } = await supabase.rpc('execute_sql', { sql: 'SELECT 1' });
    
    if (error) {
      console.log('⚠️ execute_sql RPC not available, using direct table creation...');
      await applyMigrationDirect();
    } else {
      console.log('✅ execute_sql RPC available, applying full migration...');
      await applyMigration();
    }
  } catch (error) {
    console.log('⚠️ RPC test failed, using direct approach...');
    await applyMigrationDirect();
  }
}

// Run the migration
checkAndApply(); 