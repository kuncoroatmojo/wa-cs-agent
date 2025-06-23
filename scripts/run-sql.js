#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

if (process.argv.length < 3) {
  console.error('❌ Usage: node run-sql.js <sql-file>');
  process.exit(1);
}

const sqlFile = process.argv[2];

if (!fs.existsSync(sqlFile)) {
  console.error(`❌ SQL file not found: ${sqlFile}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runSQL() {
  try {
    const sql = fs.readFileSync(sqlFile, 'utf8');
    console.log(`🔧 Running SQL from ${sqlFile}...`);
    console.log('SQL Content:');
    console.log(sql);
    console.log('---');

    // Split SQL into individual statements and run them
    const statements = sql.split(';').filter(stmt => stmt.trim());
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement) {
        console.log(`Executing statement ${i + 1}...`);
        const { data, error } = await supabase.rpc('exec_sql', { query: statement });
        
        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error);
          throw error;
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      }
    }

    console.log('✅ All SQL statements executed successfully!');
  } catch (error) {
    console.error('❌ Error running SQL:', error);
    process.exit(1);
  }
}

runSQL(); 