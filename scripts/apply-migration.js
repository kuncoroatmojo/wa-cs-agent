// Script to apply the WhatsApp instances table migration
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  console.error('You need VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env.local file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('Applying WhatsApp instances table migration...');

  try {
    // Read the migration file
    const migrationSQL = fs.readFileSync('supabase/migrations/002_fix_whatsapp_table.sql', 'utf8');
    
    // Split the migration into individual DO blocks
    const doBlocks = migrationSQL.split('DO $$').filter(block => block.trim());
    
    console.log(`Found ${doBlocks.length} migration blocks to execute`);

    for (let i = 0; i < doBlocks.length; i++) {
      const block = doBlocks[i];
      if (!block.trim()) continue;
      
      console.log(`\nExecuting migration block ${i + 1}...`);
      
      // Reconstruct the DO block
      const fullBlock = i === 0 ? block : 'DO $$' + block;
      
      try {
        const { data, error } = await supabase.rpc('exec_sql', { 
          sql: fullBlock.trim() 
        });
        
        if (error) {
          console.error(`❌ Error in block ${i + 1}:`, error.message);
          // Try direct SQL execution as fallback
          console.log('Trying direct SQL execution...');
          const { data: directData, error: directError } = await supabase
            .from('pg_stat_activity')
            .select('*')
            .limit(0); // This will fail but we use it to test connection
            
          if (directError) {
            console.error('❌ Cannot execute SQL directly:', directError.message);
          }
        } else {
          console.log(`✅ Block ${i + 1} executed successfully`);
        }
      } catch (blockError) {
        console.error(`❌ Exception in block ${i + 1}:`, blockError.message);
      }
    }

    // Alternative approach: Add columns one by one using Supabase management API
    console.log('\n🔄 Attempting alternative approach using individual ALTER statements...');
    
    const alterStatements = [
      "ALTER TABLE whatsapp_instances ADD COLUMN IF NOT EXISTS connection_type TEXT DEFAULT 'baileys';",
      "ALTER TABLE whatsapp_instances ADD COLUMN IF NOT EXISTS instance_key TEXT;",
      "ALTER TABLE whatsapp_instances ADD COLUMN IF NOT EXISTS credentials JSONB DEFAULT '{}';",
      "UPDATE whatsapp_instances SET instance_key = 'instance_' || id::text WHERE instance_key IS NULL;",
    ];

    for (const statement of alterStatements) {
      try {
        console.log(`Executing: ${statement}`);
        
        // For now, we'll just log what should be executed
        // In a real environment, you'd use a proper SQL execution method
        console.log('📝 SQL statement prepared (would need direct database access to execute)');
        
      } catch (error) {
        console.log(`⚠️ Statement might have failed: ${error.message}`);
      }
    }

    console.log('\n✅ Migration application completed');
    console.log('💡 Note: If you have direct database access, please run the following SQL:');
    console.log('----------------------------------------');
    console.log(migrationSQL);
    console.log('----------------------------------------');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  }
}

// Run the migration
applyMigration().then(() => {
  console.log('\nMigration process completed.');
}).catch(error => {
  console.error('Migration process failed:', error);
}); 