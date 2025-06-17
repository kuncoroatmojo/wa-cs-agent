#!/usr/bin/env tsx

/**
 * Test Data Seeding Script
 * Seeds the database with test data for integration testing
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const supabase = createClient(supabaseUrl, supabaseKey)

async function seedTestData() {
  try {
    console.log('🌱 Starting test data seeding...')

    // Create test user
    const testUser = {
      id: 'test-user-123',
      email: 'test@example.com',
      full_name: 'Test User',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    console.log('📝 Creating test user profile...')
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(testUser, { onConflict: 'id' })

    if (profileError && !profileError.message.includes('duplicate key')) {
      console.warn('⚠️ Profile creation warning:', profileError.message)
    }

    // Create test conversation
    console.log('💬 Creating test conversation...')
    const { error: conversationError } = await supabase
      .from('conversations')
      .upsert({
        id: 'test-conversation-123',
        user_id: testUser.id,
        phone_number: '+1234567890',
        contact_name: 'Test Contact',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })

    if (conversationError && !conversationError.message.includes('duplicate key')) {
      console.warn('⚠️ Conversation creation warning:', conversationError.message)
    }

    // Create test document
    console.log('📄 Creating test document...')
    const { error: documentError } = await supabase
      .from('documents')
      .upsert({
        id: 'test-document-123',
        user_id: testUser.id,
        name: 'Test Document',
        content: 'This is a test document for integration testing.',
        type: 'text',
        size: 1024,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })

    if (documentError && !documentError.message.includes('duplicate key')) {
      console.warn('⚠️ Document creation warning:', documentError.message)
    }

    console.log('✅ Test data seeding completed successfully!')
    console.log(`📊 Seeded data:`)
    console.log(`   - User: ${testUser.email}`)
    console.log(`   - Conversation: ${testUser.full_name}`)
    console.log(`   - Document: Test Document`)

  } catch (error) {
    console.error('❌ Error seeding test data:', error)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  seedTestData()
}

export { seedTestData } 