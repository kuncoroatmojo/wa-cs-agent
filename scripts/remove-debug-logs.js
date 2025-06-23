#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEBUG_PATTERNS = [
  /console\.log\([^)]*\);?\s*$/gm,
  /console\.debug\([^)]*\);?\s*$/gm,
  /console\.warn\([^)]*\);?\s*$/gm,
  /console\.info\([^)]*\);?\s*$/gm,
  // Keep console.error for production error handling
];

const PRESERVE_PATTERNS = [
  /console\.error/,
  /console\.assert/,
  // Preserve comments about console statements
  /\/\/.*console\./,
  /\/\*.*console\..*\*\//
];

async function removeDebugLogs() {
  console.log('🧹 Removing debug logs for production build...');
  
  try {
    // Use a simple approach to find files
    const { execSync } = await import('child_process');
    const files = execSync('find src -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx"', { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);

    let totalRemoved = 0;
    let filesModified = 0;

    for (const file of files) {
      const filePath = join(process.cwd(), file);
      const originalContent = readFileSync(filePath, 'utf8');
      let fileLogsRemoved = 0;

      // Process each line to preserve important context
      const lines = originalContent.split('\n');
      const newLines = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let shouldRemove = false;

        // Check if line should be preserved
        const shouldPreserve = PRESERVE_PATTERNS.some(pattern => pattern.test(line));
        
        if (!shouldPreserve) {
          // Check if line matches debug patterns
          for (const pattern of DEBUG_PATTERNS) {
            if (pattern.test(line)) {
              shouldRemove = true;
              fileLogsRemoved++;
              break;
            }
          }
        }

        if (!shouldRemove) {
          newLines.push(line);
        } else {
          console.log(`  ❌ Removed from ${file}:${i + 1}: ${line.trim()}`);
        }
      }

      if (fileLogsRemoved > 0) {
        const modifiedContent = newLines.join('\n');
        writeFileSync(filePath, modifiedContent, 'utf8');
        filesModified++;
        totalRemoved += fileLogsRemoved;
        console.log(`  ✅ ${file}: Removed ${fileLogsRemoved} debug statements`);
      }
    }

    console.log(`\n🎉 Debug log cleanup completed:`);
    console.log(`  📁 Files processed: ${files.length}`);
    console.log(`  📝 Files modified: ${filesModified}`);
    console.log(`  🗑️  Total debug statements removed: ${totalRemoved}`);

    if (totalRemoved === 0) {
      console.log(`  ✨ No debug logs found - code is production ready!`);
    }

  } catch (error) {
    console.error('❌ Error removing debug logs:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  removeDebugLogs();
}

export { removeDebugLogs }; 