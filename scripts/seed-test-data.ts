#!/usr/bin/env tsx

/**
 * Test Data Seeding Script
 * Seeds the database with test data for integration testing
 */

import { createClient } from '@supabase/supabase-js'

// Read environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

console.log('Creating Supabase client with URL:', SUPABASE_URL)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function seedTestData() {
  console.log('🌱 Seeding test data...')

  const timestamp = Date.now()
  const testEmail = `test+${timestamp}@example.com`

  // Create a test user first
  console.log('Creating test user...')
  const { data: user, error: userError } = await supabase.auth.admin.createUser({
    email: testEmail,
    user_metadata: {
      full_name: 'Test User'
    }
  })

  if (userError) {
    console.error('❌ Error creating test user:', userError)
    process.exit(1)
  }

  if (!user.user) {
    console.error('❌ No user created')
    process.exit(1)
  }

  console.log('✅ Created test user:', user.user.id)

  // Create a test profile
  const testProfile = {
    id: user.user.id,
    email: testEmail,
    full_name: 'Test User',
    avatar_url: null,
    created_at: new Date().toISOString()
  }

  console.log('Creating test profile...')
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(testProfile)

  if (profileError) {
    console.error('❌ Error creating test profile:', profileError)
    process.exit(1)
  }

  // Create a test conversation
  const testConversation = {
    user_id: user.user.id,
    integration_type: 'whatsapp',
    integration_id: null,
    contact_id: '1234567890',
    contact_name: 'Test Contact',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_message_at: new Date().toISOString()
  }

  console.log('Creating test conversation...')
  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .insert(testConversation)
    .select()
    .single()

  if (conversationError) {
    console.error('❌ Error creating test conversation:', conversationError)
    process.exit(1)
  }

  if (!conversation) {
    console.error('❌ No conversation created')
    process.exit(1)
  }

  // Create test messages
  const testMessages = [
    {
      conversation_id: conversation.id,
      content: 'Hello! How can I help you today?',
      message_type: 'text',
      direction: 'outbound',
      sender_type: 'bot',
      sender_name: 'AI Assistant',
      sender_id: user.user.id,
      status: 'delivered',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      conversation_id: conversation.id,
      content: 'I have a question about my order',
      message_type: 'text',
      direction: 'inbound',
      sender_type: 'contact',
      sender_name: 'Test Contact',
      sender_id: '1234567890',
      status: 'delivered',
      created_at: new Date(Date.now() + 1000).toISOString(),
      updated_at: new Date(Date.now() + 1000).toISOString()
    }
  ]

  console.log('Creating test messages...')
  const { error: messagesError } = await supabase
    .from('conversation_messages')
    .insert(testMessages)

  if (messagesError) {
    console.error('❌ Error creating test messages:', messagesError)
    process.exit(1)
  }

  console.log('✅ Test data seeded successfully!')
}

seedTestData().catch(console.error)

// Run if called directly
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  seedTestData()
}

export { seedTestData } 