import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pfirjlhuulkchogjbvsv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmaXJqbGh1dWxrY2hvZ2pidnN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5NDMzNDAsImV4cCI6MjA2NTUxOTM0MH0.0AbJCCEJPwYFtMW7VJX5349ZnAqG3vkdteLHa2HvMO8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseSchema() {
  console.log('🔍 Checking whatsapp_instances table schema...\n');
  
  try {
    // Try to get table structure using information_schema
    const { data: columns, error: schemaError } = await supabase
      .rpc('get_table_columns', { table_name: 'whatsapp_instances' })
      .single();

    if (schemaError) {
      console.log('❌ Could not get schema via RPC, trying direct query...');
      
      // Try a simple select to see what columns exist
      const { data: testData, error: selectError } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .limit(1);

      if (selectError) {
        console.error('❌ Error querying table:', selectError);
        
        // Check if table exists at all
        const { data: tableExists, error: tableError } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_name', 'whatsapp_instances')
          .eq('table_schema', 'public');

        if (tableError) {
          console.error('❌ Cannot check if table exists:', tableError);
        } else if (tableExists && tableExists.length > 0) {
          console.log('✅ Table whatsapp_instances exists');
        } else {
          console.log('❌ Table whatsapp_instances does not exist!');
        }
      } else {
        console.log('✅ Table accessible, sample data structure:');
        if (testData && testData.length > 0) {
          console.log('Columns found:', Object.keys(testData[0]));
        } else {
          console.log('Table is empty, trying to describe structure...');
        }
      }
    } else {
      console.log('✅ Table schema:', columns);
    }

    // Test creating an instance with all required fields
    console.log('\n📝 Testing instance creation...');
    
    const testInstance = {
      name: 'Schema Test ' + Date.now(),
      connection_type: 'baileys',
      user_id: '026a714f-c809-4de8-bed6-1f0a5344c061', // Use the user ID from your error
      instance_key: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'disconnected',
      settings: {},
      credentials: {}
    };

    console.log('Attempting to insert:', testInstance);

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
    } else {
      console.log('✅ Insert successful:', insertResult);
      
      // Clean up
      const { error: deleteError } = await supabase
        .from('whatsapp_instances')
        .delete()
        .eq('id', insertResult.id);
        
      if (deleteError) {
        console.error('❌ Cleanup failed:', deleteError);
      } else {
        console.log('✅ Test data cleaned up');
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkDatabaseSchema().catch(console.error); 