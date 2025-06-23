#!/usr/bin/env node

/**
 * Test the evolutionMessageSync import to debug the module error
 */

console.log('🧪 Testing evolutionMessageSync import...');

try {
  // Test the import in Node.js environment
  const { evolutionMessageSync } = require('../src/services/evolutionMessageSync.ts');
  console.log('✅ Successfully imported evolutionMessageSync');
  console.log('Service type:', typeof evolutionMessageSync);
  console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(evolutionMessageSync)));
} catch (error) {
  console.error('❌ Import failed:', error.message);
  
  // Try importing the class directly
  try {
    const { EvolutionMessageSyncService } = require('../src/services/evolutionMessageSync.ts');
    console.log('✅ Successfully imported EvolutionMessageSyncService class');
    console.log('Class type:', typeof EvolutionMessageSyncService);
  } catch (classError) {
    console.error('❌ Class import also failed:', classError.message);
  }
}

console.log('\n🔍 Checking file structure...');
const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '../src/services/evolutionMessageSync.ts');

if (fs.existsSync(filePath)) {
  console.log('✅ File exists at:', filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Check for exports
  const exports = content.match(/export\s+.*evolutionMessageSync/g);
  if (exports) {
    console.log('✅ Found exports:', exports);
  } else {
    console.log('❌ No evolutionMessageSync exports found');
  }
  
  // Check for class export
  const classExports = content.match(/export\s+class\s+EvolutionMessageSyncService/g);
  if (classExports) {
    console.log('✅ Found class export:', classExports);
  }
} else {
  console.log('❌ File does not exist');
} 