import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://pfirjlhuulkchogjbvsv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function applyUniqueConstraint() {
  try {
    console.log('🔧 Applying unique constraint on external_message_id...');

    // First, clean up any duplicate external_message_id values
    console.log('🧹 Cleaning up duplicates...');
    const cleanupQuery = `
      DELETE FROM conversation_messages 
      WHERE id NOT IN (
        SELECT MIN(id) 
        FROM conversation_messages 
        GROUP BY external_message_id
        HAVING external_message_id IS NOT NULL
      ) AND external_message_id IS NOT NULL;
    `;

    // Since we can't execute SQL directly, let's check if there are duplicates first
    const { data: duplicateCheck, error: duplicateError } = await supabase
      .from('conversation_messages')
      .select('external_message_id')
      .not('external_message_id', 'is', null);

    if (duplicateError) {
      console.error('❌ Error checking duplicates:', duplicateError);
      return;
    }

    const externalIds = duplicateCheck.map(row => row.external_message_id);
    const uniqueIds = [...new Set(externalIds)];
    const duplicateCount = externalIds.length - uniqueIds.length;

    console.log(`📊 Found ${duplicateCount} duplicate external_message_ids`);

    if (duplicateCount > 0) {
      console.log('⚠️  Need to clean up duplicates manually before applying constraint');
      
      // Group duplicates
      const duplicates = {};
      externalIds.forEach(id => {
        duplicates[id] = (duplicates[id] || 0) + 1;
      });

      console.log('🔍 Duplicate external_message_ids:');
      Object.entries(duplicates)
        .filter(([id, count]) => count > 1)
        .slice(0, 5)
        .forEach(([id, count]) => {
          console.log(`   ${id}: ${count} occurrences`);
        });

      // For now, let's manually clean duplicates by deleting the newer ones
      for (const [externalId, count] of Object.entries(duplicates)) {
        if (count > 1) {
          console.log(`🗑️  Cleaning up ${count - 1} duplicates for ${externalId}...`);
          
          // Get all records with this external_message_id, ordered by created_at
          const { data: records } = await supabase
            .from('conversation_messages')
            .select('id, created_at')
            .eq('external_message_id', externalId)
            .order('created_at', { ascending: true });

          if (records && records.length > 1) {
            // Keep the first (oldest) record, delete the rest
            const idsToDelete = records.slice(1).map(r => r.id);
            
            const { error: deleteError } = await supabase
              .from('conversation_messages')
              .delete()
              .in('id', idsToDelete);

            if (deleteError) {
              console.error(`❌ Error deleting duplicates for ${externalId}:`, deleteError);
            } else {
              console.log(`✅ Deleted ${idsToDelete.length} duplicates for ${externalId}`);
            }
          }
        }
      }
    }

    // Now test if we can create the unique constraint by trying an insert that would violate it
    console.log('\n🧪 Testing if unique constraint exists...');
    
    const testId = 'test_unique_' + Date.now();
    const testMessage1 = {
      conversation_id: '00000000-0000-0000-0000-000000000002', // Use an existing conversation
      external_message_id: testId,
      content: 'Test message 1',
      message_type: 'text',
      direction: 'inbound',
      sender_type: 'contact',
      sender_name: 'Test',
      sender_id: 'test',
      status: 'delivered'
    };

    // Insert first message
    const { data: first, error: firstError } = await supabase
      .from('conversation_messages')
      .insert([testMessage1])
      .select();

    if (firstError) {
      console.error('❌ Error inserting first test message:', firstError);
      return;
    }

    console.log('✅ First test message inserted');

    // Try to insert second message with same external_message_id
    const testMessage2 = {
      ...testMessage1,
      content: 'Test message 2 (should fail if constraint exists)'
    };

    const { data: second, error: secondError } = await supabase
      .from('conversation_messages')
      .insert([testMessage2])
      .select();

    if (secondError) {
      if (secondError.code === '23505') { // Unique violation
        console.log('✅ Unique constraint exists! (Insert correctly failed)');
      } else {
        console.error('❌ Unexpected error:', secondError);
      }
    } else {
      console.log('⚠️  Unique constraint does NOT exist (Insert succeeded when it should have failed)');
      
      // Clean up the second message
      await supabase
        .from('conversation_messages')
        .delete()
        .eq('id', second[0].id);
    }

    // Clean up first test message
    await supabase
      .from('conversation_messages')
      .delete()
      .eq('id', first[0].id);

    console.log('🗑️  Test messages cleaned up');

    // If no constraint exists, we need to apply it manually
    // This would require direct database access via SQL
    
    console.log('\n💡 To add the unique constraint, run this SQL in your database:');
    console.log('CREATE UNIQUE INDEX IF NOT EXISTS conversation_messages_external_message_id_unique');
    console.log('ON conversation_messages(external_message_id)');
    console.log('WHERE external_message_id IS NOT NULL;');

  } catch (error) {
    console.error('❌ Failed to apply constraint:', error.message);
    console.error('Full error:', error);
  }
}

applyUniqueConstraint();
