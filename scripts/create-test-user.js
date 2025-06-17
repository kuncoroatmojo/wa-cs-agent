import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

/**
 * Create Test User Script
 * 
 * This script creates a test user account in Supabase for development/testing.
 * Run this after setting up your Supabase credentials in .env
 * 
 * Usage: node scripts/create-test-user.js
 */

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Try multiple email domains that are commonly allowed
const testEmails = [
  'admin@gmail.com',
  'test@gmail.com', 
  'admin@outlook.com',
  'test@outlook.com',
  'admin@yahoo.com',
  'user@hotmail.com',
  'admin@protonmail.com',
  'test@icloud.com'
];

async function createTestUser() {
  console.log('🚀 Attempting to create test user account...');
  console.log('🔍 Trying multiple email domains to find allowed ones...');
  console.log('');

  const password = 'admin123456';
  const name = 'Test Admin';

  for (const email of testEmails) {
    console.log(`📧 Trying: ${email}`);
    
    try {
      // First, try to sign up the user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            name: name,
            role: 'admin'
          }
        }
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          console.log(`   ✅ User already exists! Testing sign in...`);
          
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
          });

          if (signInError) {
            console.log(`   ❌ Sign in failed: ${signInError.message}`);
            continue;
          }

          console.log(`   🎉 SUCCESS! Working credentials found:`);
          console.log(`   📧 Email: ${email}`);
          console.log(`   🔑 Password: ${password}`);
          console.log(`   👤 User ID: ${signInData.user?.id}`);
          console.log('');
          return { email, password, success: true };
        } else if (signUpError.message.includes('invalid')) {
          console.log(`   ⚠️  Email domain not allowed: ${signUpError.message}`);
          continue;
        } else {
          console.log(`   ❌ Error: ${signUpError.message}`);
          continue;
        }
      }

      if (signUpData.user) {
        console.log(`   🎉 SUCCESS! New user created:`);
        console.log(`   📧 Email: ${email}`);
        console.log(`   🔑 Password: ${password}`);
        console.log(`   👤 User ID: ${signUpData.user.id}`);
        
        if (signUpData.user.email_confirmed_at) {
          console.log(`   ✅ Email confirmed - ready to login!`);
        } else {
          console.log(`   ⚠️  Email confirmation required`);
          console.log(`   💡 Check your email or disable email confirmation in Supabase settings`);
        }
        console.log('');
        return { email, password, success: true };
      }

    } catch (error) {
      console.log(`   ❌ Unexpected error: ${error.message}`);
      continue;
    }
  }

  console.log('');
  console.log('❌ No working email domains found!');
  console.log('');
  console.log('🔧 SOLUTIONS:');
  console.log('1. Go to Supabase Dashboard > Authentication > Settings');
  console.log('2. Scroll down to "Email Auth" section');
  console.log('3. Either:');
  console.log('   a) Disable "Restrict email domains" (recommended for development)');
  console.log('   b) Add allowed domains like "gmail.com, outlook.com, yahoo.com"');
  console.log('4. Or manually create a user in Supabase Dashboard > Authentication > Users');
  console.log('');
  
  return { success: false };
}

// Test Supabase connection first
async function testConnection() {
  console.log('🔍 Testing Supabase connection...');
  console.log('🌐 URL:', supabaseUrl);
  console.log('🔑 API Key:', supabaseAnonKey.substring(0, 20) + '...');
  console.log('');

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.log('⚠️  Connection test warning:', error.message);
    } else {
      console.log('✅ Supabase connection successful');
    }
  } catch (error) {
    console.log('❌ Connection failed:', error.message);
    return false;
  }
  
  return true;
}

async function main() {
  const connected = await testConnection();
  if (connected) {
    const result = await createTestUser();
    
    if (result.success) {
      console.log('🎯 READY TO TEST:');
      console.log('1. Go to your app (local or deployed)');
      console.log('2. Use the debug tools or login form');
      console.log(`3. Email: ${result.email}`);
      console.log(`4. Password: ${result.password}`);
    }
  }
}

main(); 