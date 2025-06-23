import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { v4 as uuidv4 } from 'uuid'

/**
 * Create Test User Script
 * 
 * This script creates a test user account in Supabase for development/testing.
 * Run this after setting up your Supabase credentials in .env
 * 
 * Usage: node scripts/create-test-user.js
 */

dotenv.config()

const TEST_USER_EMAIL = 'test@example.com'
const TEST_USER_PASSWORD = 'test123456'

async function createTestUser() {
  console.log('🚀 Creating test user...')

  // Read environment variables
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables')
    console.error('Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const { data, error } = await supabase.auth.signUp({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      options: {
        data: {
          name: 'Test User',
          role: 'user'
        }
      }
    })

    if (error) {
      console.error('❌ Failed to create test user:', error.message)
      return false
    }

    console.log('✅ Test user created successfully!')
    console.log('📧 Email:', TEST_USER_EMAIL)
    console.log('🔑 Password:', TEST_USER_PASSWORD)
    console.log('👤 User ID:', data.user.id)
    return true

  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
    return false
  }
}

createTestUser().catch(console.error) 