#!/usr/bin/env node

/**
 * Create Test User Script
 * 
 * This script creates a test user account in Supabase for development/testing.
 * Run this after setting up your Supabase credentials in .env
 * 
 * Usage: node scripts/create-test-user.js
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.log('Please set:');
  console.log('- VITE_SUPABASE_URL=https://your-project-id.supabase.co');
  console.log('- VITE_SUPABASE_ANON_KEY=your-anon-key-here');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createTestUser() {
  const testUser = {
    email: 'admin@wacanda.com',
    password: 'admin123456',
    name: 'Admin User',
    role: 'admin'
  };

  console.log('🚀 Creating test user account...');
  console.log(`📧 Email: ${testUser.email}`);
  console.log(`🔑 Password: ${testUser.password}`);
  console.log('');

  try {
    // Create user account
    const { data, error } = await supabase.auth.signUp({
      email: testUser.email,
      password: testUser.password,
      options: {
        data: {
          name: testUser.name,
          role: testUser.role
        }
      }
    });

    if (error) {
      if (error.message.includes('already registered')) {
        console.log('✅ User already exists! You can login with:');
        console.log(`📧 Email: ${testUser.email}`);
        console.log(`🔑 Password: ${testUser.password}`);
        return;
      }
      throw error;
    }

    if (data.user) {
      console.log('✅ Test user created successfully!');
      console.log('');
      console.log('🔐 Login Credentials:');
      console.log(`📧 Email: ${testUser.email}`);
      console.log(`🔑 Password: ${testUser.password}`);
      console.log('');
      
      if (data.user.email_confirmed_at) {
        console.log('✅ Email confirmed - ready to login!');
      } else {
        console.log('⚠️  Email confirmation required');
        console.log('Check your email or disable email confirmation in Supabase Auth settings');
      }
    }

  } catch (error) {
    console.error('❌ Error creating test user:', error.message);
    
    if (error.message.includes('email_address_not_authorized')) {
      console.log('');
      console.log('💡 Solution: Go to Supabase Dashboard > Authentication > Settings');
      console.log('   and disable "Enable email confirmations" for development');
    }
  }
}

// Run the script
createTestUser(); 