import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCreateInstance() {
  console.log('Testing WhatsApp instance creation...');
  
  try {
    // First, test authentication
    const { data: user, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user || !user.user) {
      console.log('❌ Authentication required!');
      console.log('The 400 Bad Request error is likely due to missing authentication.');
      console.log('To fix this issue:');
      console.log('1. Make sure you are logged in to your application at wacanda.vercel.app');
      console.log('2. The user needs to be authenticated to create WhatsApp instances');
      console.log('3. Check that RLS (Row Level Security) policies are correctly configured');
      
      // Try to create a test user if possible
      console.log('\nAttempting to create a test user...');
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: 'test@example.com',
        password: 'testpassword123'
      });
      
      if (signUpError) {
        console.error('❌ Cannot create test user:', signUpError.message);
        console.log('\n💡 Solution: Please log in at wacanda.vercel.app first, then try creating a WhatsApp instance');
      } else {
        console.log('✅ Test user created or already exists');
        
        // Try signing in
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: 'test@example.com',
          password: 'testpassword123'
        });
        
        if (signInError) {
          console.error('❌ Cannot sign in:', signInError.message);
        } else {
          console.log('✅ Successfully signed in test user');
          await testInstanceCreation(signInData.user.id);
        }
      }
      return;
    }

    console.log('✅ User authenticated:', user.user.email);
    await testInstanceCreation(user.user.id);
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

async function testInstanceCreation(userId) {
  console.log('\n📱 Testing WhatsApp instance creation...');
  
  const testInstance = {
    name: 'Test Instance ' + Date.now(),
    connection_type: 'baileys',
    user_id: userId,
    instance_key: `test_instance_${Date.now()}`,
    settings: {
      autoReply: true,
      businessHours: {
        enabled: false,
        timezone: 'UTC',
        schedule: {}
      },
      welcomeMessage: 'Hello! How can I help you today?',
      outOfHoursMessage: 'We are currently closed. Please try again during business hours.',
      humanHandoffKeywords: ['human', 'agent', 'support'],
      maxResponseTime: 30
    }
  };

  console.log('Attempting to insert instance:', { 
    name: testInstance.name, 
    connection_type: testInstance.connection_type,
    user_id: testInstance.user_id 
  });

  const { data, error } = await supabase
    .from('whatsapp_instances')
    .insert(testInstance)
    .select()
    .single();

  if (error) {
    console.error('❌ Insert error:', error.message);
    console.error('Error code:', error.code);
    console.error('Error details:', error.details);
    console.error('Error hint:', error.hint);
    
    if (error.code === '42501' || error.message.includes('permission')) {
      console.log('\n💡 This appears to be a Row Level Security (RLS) policy issue.');
      console.log('Please check that the RLS policies on whatsapp_instances table allow INSERT for authenticated users.');
    }
  } else {
    console.log('✅ Success! Created instance:', {
      id: data.id,
      name: data.name,
      status: data.status
    });
    
    // Clean up - delete the test instance
    const { error: deleteError } = await supabase
      .from('whatsapp_instances')
      .delete()
      .eq('id', data.id);
      
    if (deleteError) {
      console.error('❌ Failed to clean up test instance:', deleteError.message);
    } else {
      console.log('✅ Test instance cleaned up successfully');
    }
  }
}

testCreateInstance().catch(console.error); 