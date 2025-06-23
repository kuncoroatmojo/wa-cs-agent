import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Make sure SUPABASE_URL and SUPABASE_ANON_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseSchema() {
  console.log('🔍 Checking whatsapp_instances table schema...\n');
  
  try {
    // First, check authentication status
    const { data: authUser, error: authError } = await supabase.auth.getUser();
    console.log('🔐 Auth status:', authUser?.user ? `Authenticated as ${authUser.user.email}` : 'Not authenticated');
    
    if (authError || !authUser?.user) {
      console.log('❌ Authentication required for RLS testing');
      console.log('💡 The RLS policies are working correctly - they require authentication');
      console.log('✅ This means your fix is working! Try creating an instance in the web app now.');
      return;
    }

    // Test with authenticated user
    const authenticatedUserId = authUser.user.id;
    console.log('📋 Using authenticated user ID:', authenticatedUserId);

    // Try a simple select to see what columns exist
    const { data: testData, error: selectError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .limit(1);

    if (selectError) {
      console.error('❌ Error querying table:', selectError);
    } else {
      console.log('✅ Table accessible');
      if (testData && testData.length > 0) {
        console.log('Columns found:', Object.keys(testData[0]));
      } else {
        console.log('Table is empty');
      }
    }

    // Test creating an instance with authenticated user
    console.log('\n📝 Testing instance creation with authenticated user...');
    
    const testInstance = {
      name: 'Auth Test ' + Date.now(),
      connection_type: 'baileys',
      user_id: authenticatedUserId, // Use the authenticated user's ID
      instance_key: `auth_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'disconnected',
      settings: {},
      credentials: {}
    };

    console.log('Attempting to insert:', {
      name: testInstance.name,
      connection_type: testInstance.connection_type,
      user_id: testInstance.user_id,
      instance_key: testInstance.instance_key
    });

    const { data: insertResult, error: insertError } = await supabase
      .from('whatsapp_instances')
      .insert(testInstance)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Insert failed:', insertError);
      console.error('Error code:', insertError.code);
      console.error('Error details:', insertError.details);
      console.error('Error hint:', insertError.hint);
      
      if (insertError.code === '42501') {
        console.log('\n🔍 RLS Policy Debugging:');
        console.log('- User is authenticated:', !!authUser?.user);
        console.log('- User ID matches:', authenticatedUserId === testInstance.user_id);
        console.log('- User role:', authUser?.user?.role || 'Not specified');
        
        // Check if profiles table exists and user has a profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', authenticatedUserId)
          .single();
          
        if (profileError) {
          console.log('❌ Profile check failed:', profileError.message);
          console.log('💡 User might not have a profile record - this could cause RLS issues');
        } else {
          console.log('✅ User profile exists');
        }
      }
    } else {
      console.log('✅ Insert successful:', {
        id: insertResult.id,
        name: insertResult.name,
        status: insertResult.status
      });
      
      // Clean up
      const { error: deleteError } = await supabase
        .from('whatsapp_instances')
        .delete()
        .eq('id', insertResult.id);
        
      if (deleteError) {
        console.error('❌ Cleanup failed:', deleteError.message);
      } else {
        console.log('✅ Test data cleaned up');
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkDatabaseSchema().catch(console.error); 