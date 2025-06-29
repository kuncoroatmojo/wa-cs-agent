#!/usr/bin/env node

/**
 * Test Evolution API Connection
 * Quick script to verify your Evolution API credentials and instance
 */

const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

// Configuration (same pattern as bulk sender)
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || process.env.VITE_EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || process.env.VITE_EVOLUTION_API_KEY;
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'personal';

console.log('🔍 Testing Evolution API Connection...');
console.log(`  - URL: ${EVOLUTION_API_URL || 'NOT SET'}`);
console.log(`  - API Key: ${EVOLUTION_API_KEY ? EVOLUTION_API_KEY.substring(0, 8) + '...' : 'NOT SET'}`);
console.log(`  - Instance: ${INSTANCE_NAME}`);

if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
  console.error('\n❌ Missing required environment variables:');
  console.error('  - EVOLUTION_API_URL or VITE_EVOLUTION_API_URL');
  console.error('  - EVOLUTION_API_KEY or VITE_EVOLUTION_API_KEY');
  console.error('\n💡 Create a .env.local file with:');
  console.error('VITE_EVOLUTION_API_URL=https://your-evolution-api-url.com');
  console.error('VITE_EVOLUTION_API_KEY=your-api-key');
  console.error('EVOLUTION_INSTANCE_NAME=your-instance-name');
  process.exit(1);
}

async function testConnection() {
  try {
    console.log('\n🌐 Testing API connection...');
    
    // Test 1: Check if Evolution API is responding
    const healthUrl = `${EVOLUTION_API_URL}/`;
    console.log(`📡 GET ${healthUrl}`);
    
    const healthResponse = await axios.get(healthUrl, {
      headers: {
        'apikey': EVOLUTION_API_KEY,
      },
      timeout: 10000
    });
    
    console.log(`✅ API is responding: ${healthResponse.status}`);
    console.log(`📋 API Info:`, JSON.stringify(healthResponse.data, null, 2));
    
    // Test 2: Check instances
    console.log('\n📱 Fetching instances...');
    const instancesUrl = `${EVOLUTION_API_URL}/instance/fetchInstances`;
    console.log(`📡 GET ${instancesUrl}`);
    
    const instancesResponse = await axios.get(instancesUrl, {
      headers: {
        'apikey': EVOLUTION_API_KEY,
      },
      timeout: 10000
    });
    
    console.log(`✅ Instances fetched: ${instancesResponse.status}`);
    console.log(`📋 Instances:`, JSON.stringify(instancesResponse.data, null, 2));
    
    // Test 3: Check specific instance status
    if (instancesResponse.data && instancesResponse.data.length > 0) {
      const targetInstance = instancesResponse.data.find(i => i.instanceName === INSTANCE_NAME) || instancesResponse.data[0];
      
      console.log(`\n🎯 Checking instance: ${targetInstance.instanceName}`);
      console.log(`📋 Instance Status:`, JSON.stringify(targetInstance, null, 2));
      
      if (targetInstance.state !== 'open') {
        console.warn(`⚠️  Instance '${targetInstance.instanceName}' is not connected (state: ${targetInstance.state})`);
        console.warn('   You may need to connect your instance first.');
      } else {
        console.log(`✅ Instance '${targetInstance.instanceName}' is connected and ready!`);
      }
    } else {
      console.warn('⚠️  No instances found. You may need to create an instance first.');
    }
    
    console.log('\n🎉 Connection test completed successfully!');
    console.log('💬 You can now run the bulk WhatsApp sender script.');
    
  } catch (error) {
    console.error('\n❌ Connection test failed:');
    console.error(`   Status: ${error.response?.status || 'Network Error'}`);
    console.error(`   Message: ${error.response?.data?.message || error.message}`);
    console.error(`   Data:`, error.response?.data || 'No additional data');
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Possible issues:');
      console.error('   - Evolution API server is not running');
      console.error('   - Wrong URL in VITE_EVOLUTION_API_URL');
    } else if (error.response?.status === 401) {
      console.error('\n💡 Possible issues:');
      console.error('   - Wrong API key in VITE_EVOLUTION_API_KEY');
      console.error('   - API key expired or invalid');
    }
    
    process.exit(1);
  }
}

testConnection(); 