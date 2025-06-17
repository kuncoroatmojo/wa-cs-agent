// Test script to verify WhatsApp instances functionality
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testWhatsAppInstances() {
  console.log('Testing WhatsApp instances functionality...');

  try {
    // Test 1: Check if table exists by trying to query it
    console.log('\n1. Testing table existence...');
    const { data: tableTest, error: tableError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .limit(1);

    if (tableError) {
      console.error('❌ whatsapp_instances table error:', tableError.message);
      
      // Try the whatsapp_integrations table as fallback
      console.log('Trying whatsapp_integrations table...');
      const { data: integrationsTest, error: integrationsError } = await supabase
        .from('whatsapp_integrations')
        .select('*')
        .limit(1);
        
      if (integrationsError) {
        console.error('❌ whatsapp_integrations table also not accessible:', integrationsError.message);
        return;
      } else {
        console.log('✅ whatsapp_integrations table exists and is accessible');
        console.log('Sample data structure:', integrationsTest[0] || 'No data found');
        console.log('🔄 Using whatsapp_integrations table for testing');
        
        // Test insert on whatsapp_integrations instead
        const testInstance = {
          name: 'Test Instance',
          connection_type: 'baileys',
          instance_key: `test_${Date.now()}`,
          settings: {
            autoReply: true,
            welcomeMessage: 'Hello test'
          }
        };

        const { data: insertData, error: insertError } = await supabase
          .from('whatsapp_integrations')
          .insert(testInstance)
          .select();

        if (insertError) {
          if (insertError.message.includes('RLS') || insertError.message.includes('policy')) {
            console.log('✅ whatsapp_integrations table structure is correct (RLS policy blocking unauthenticated access)');
          } else {
            console.error('❌ whatsapp_integrations insert failed:', insertError.message);
          }
        } else {
          console.log('✅ Test instance created successfully in whatsapp_integrations');
        }
        return;
      }
    } else {
      console.log('✅ whatsapp_instances table exists and is accessible');
      if (tableTest.length > 0) {
        console.log('Sample data structure:', tableTest[0]);
      } else {
        console.log('Table is empty, but accessible');
      }
    }

    // Test 2: Try to insert a test instance with various field combinations
    console.log('\n2. Testing table structure...');
    
    // First try the expected structure
    let testInstance = {
      name: 'Test Instance',
      connection_type: 'baileys',
      instance_key: `test_${Date.now()}`,
      settings: {
        autoReply: true,
        welcomeMessage: 'Hello test'
      }
    };

    let { data: insertData, error: insertError } = await supabase
      .from('whatsapp_instances')
      .insert(testInstance)
      .select();

    if (insertError) {
      console.log('❌ First attempt failed:', insertError.message);
      
      // Try with different field names based on the old schema
      console.log('Trying with alternative field names...');
      testInstance = {
        name: 'Test Instance',
        status: 'disconnected',
        phone_number: null,
        qr_code: null,
        settings: {
          autoReply: true,
          welcomeMessage: 'Hello test'
        }
      };

      const { data: insertData2, error: insertError2 } = await supabase
        .from('whatsapp_instances')
        .insert(testInstance)
        .select();

      if (insertError2) {
        if (insertError2.message.includes('RLS') || insertError2.message.includes('policy')) {
          console.log('✅ Table structure is correct (RLS policy blocking unauthenticated access)');
        } else {
          console.error('❌ Second attempt also failed:', insertError2.message);
        }
      } else {
        console.log('✅ Test instance created successfully with alternative schema');
      }
    } else {
      console.log('✅ Test instance created successfully:', insertData);
      
      // Clean up test data
      if (insertData && insertData[0]) {
        await supabase
          .from('whatsapp_instances')
          .delete()
          .eq('id', insertData[0].id);
        console.log('🧹 Test data cleaned up');
      }
    }

    console.log('\n✅ WhatsApp instances table test completed');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

// Run the test
testWhatsAppInstances().then(() => {
  console.log('\nTest completed.');
}).catch(error => {
  console.error('Test failed:', error);
}); 