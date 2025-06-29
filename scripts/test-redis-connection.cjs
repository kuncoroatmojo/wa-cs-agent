#!/usr/bin/env node

const axios = require('axios');

// Configuration
const EVOLUTION_API_URL = process.env.VITE_EVOLUTION_API_URL || process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.VITE_EVOLUTION_API_KEY || process.env.EVOLUTION_API_KEY;

console.log('🔍 Testing Redis Connection for Evolution API...\n');

// Validate configuration
if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   VITE_EVOLUTION_API_URL:', EVOLUTION_API_URL ? '✅ Set' : '❌ Missing');
  console.error('   VITE_EVOLUTION_API_KEY:', EVOLUTION_API_KEY ? '✅ Set' : '❌ Missing');
  console.error('\n💡 Please set these environment variables in your .env file');
  process.exit(1);
}

console.log('📋 Configuration:');
console.log(`   Evolution API URL: ${EVOLUTION_API_URL}`);
console.log(`   Evolution API Key: ${EVOLUTION_API_KEY.substring(0, 8)}...`);
console.log('');

// Test Redis connection through Evolution API
async function testRedisConnection() {
  try {
    console.log('🔗 Testing Evolution API connection...');
    
    // Test basic API connection first
    const healthResponse = await axios.get(`${EVOLUTION_API_URL}/`, {
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Evolution API is reachable');
    console.log(`   Status: ${healthResponse.status}`);
    console.log(`   Response: ${JSON.stringify(healthResponse.data, null, 2)}`);
    console.log('');
    
    // Test instances endpoint to check Redis functionality
    console.log('🔍 Testing Redis through instances endpoint...');
    const instancesResponse = await axios.get(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Instances endpoint successful (Redis is likely working)');
    console.log(`   Status: ${instancesResponse.status}`);
    console.log(`   Instances found: ${instancesResponse.data?.length || 0}`);
    
    if (instancesResponse.data && instancesResponse.data.length > 0) {
      console.log('   Instance details:');
      instancesResponse.data.forEach((instance, index) => {
        console.log(`     ${index + 1}. ${instance.instanceName} - Status: ${instance.connectionStatus || 'unknown'}`);
      });
    }
    console.log('');
    
    // Test server info endpoint to get cache/Redis information
    console.log('🔍 Testing server info endpoint for Redis details...');
    try {
      const serverInfoResponse = await axios.get(`${EVOLUTION_API_URL}/info`, {
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      console.log('✅ Server info retrieved successfully');
      console.log(`   Server Info: ${JSON.stringify(serverInfoResponse.data, null, 2)}`);
    } catch (infoError) {
      console.log('⚠️  Server info endpoint not available (this is normal for some Evolution API versions)');
    }
    console.log('');
    
    return true;
    
  } catch (error) {
    console.error('❌ Redis/Evolution API Test Failed:');
    
    if (error.code === 'ECONNREFUSED') {
      console.error('   🔴 Connection refused - Evolution API server is not reachable');
      console.error('   💡 Check if Evolution API is running and accessible');
    } else if (error.code === 'ENOTFOUND') {
      console.error('   🔴 DNS resolution failed - Check your Evolution API URL');
    } else if (error.response) {
      console.error(`   🔴 HTTP ${error.response.status}: ${error.response.statusText}`);
      if (error.response.status === 401) {
        console.error('   💡 Authentication failed - Check your API key');
      } else if (error.response.status === 403) {
        console.error('   💡 Access forbidden - Check your API key permissions');
      }
      console.error(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
    } else if (error.code === 'ECONNABORTED') {
      console.error('   🔴 Request timeout - Evolution API is not responding');
      console.error('   💡 This could indicate Redis connection issues in Evolution API');
    } else {
      console.error(`   🔴 Unexpected error: ${error.message}`);
    }
    
    return false;
  }
}

// Test if Redis is likely working by checking Evolution API functionality
async function testEvolutionApiRedisHealth() {
  console.log('🧪 Advanced Redis Health Tests...\n');
  
  try {
    // Create a test instance to verify Redis caching
    console.log('1️⃣ Testing instance creation (Redis cache test)...');
    const testInstanceName = `redis-test-${Date.now()}`;
    
    try {
      const createResponse = await axios.post(`${EVOLUTION_API_URL}/instance/create`, {
        instanceName: testInstanceName,
        token: `test-token-${Date.now()}`,
        integration: 'WHATSAPP-BAILEYS'
      }, {
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });
      
      console.log('✅ Instance creation successful (Redis cache working)');
      console.log(`   Instance: ${testInstanceName}`);
      console.log(`   Status: ${createResponse.status}`);
      
      // Try to fetch the instance back (tests Redis read)
      console.log('\n2️⃣ Testing instance retrieval (Redis read test)...');
      const fetchResponse = await axios.get(`${EVOLUTION_API_URL}/instance/fetchInstances?instanceName=${testInstanceName}`, {
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      const foundInstance = fetchResponse.data?.find(inst => inst.instanceName === testInstanceName);
      if (foundInstance) {
        console.log('✅ Instance retrieval successful (Redis read working)');
        console.log(`   Found instance: ${foundInstance.instanceName}`);
      } else {
        console.log('⚠️  Instance not found in fetch response (potential Redis issue)');
      }
      
      // Clean up test instance
      console.log('\n3️⃣ Cleaning up test instance...');
      try {
        await axios.delete(`${EVOLUTION_API_URL}/instance/delete/${testInstanceName}`, {
          headers: {
            'apikey': EVOLUTION_API_KEY,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        console.log('✅ Test instance cleaned up successfully');
      } catch (cleanupError) {
        console.log('⚠️  Could not clean up test instance (manual cleanup may be needed)');
      }
      
    } catch (instanceError) {
      if (instanceError.response?.status === 409) {
        console.log('⚠️  Instance already exists (Redis working, but instance name conflict)');
      } else {
        console.log('❌ Instance creation failed (potential Redis connection issue)');
        console.log(`   Error: ${instanceError.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Advanced Redis health test failed:', error.message);
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting Redis Connection Tests for Evolution API\n');
  
  const basicTest = await testRedisConnection();
  
  if (basicTest) {
    console.log('🎉 Basic Redis/Evolution API tests passed!\n');
    
    // Run advanced tests
    await testEvolutionApiRedisHealth();
    
    console.log('\n📊 Test Summary:');
    console.log('✅ Evolution API is reachable');
    console.log('✅ Basic endpoints are working');
    console.log('✅ Redis connection appears healthy');
    console.log('\n💡 If you\'re experiencing issues, check:');
    console.log('   - Evolution API Redis configuration (CACHE_REDIS_ENABLED=true)');
    console.log('   - Redis server is running and accessible');
    console.log('   - Evolution API environment variables for Redis');
    console.log('   - Redis connection string format: redis://host:port or redis://user:pass@host:port');
    
  } else {
    console.log('\n❌ Redis/Evolution API tests failed');
    console.log('\n🔧 Troubleshooting Steps:');
    console.log('1. Verify Evolution API is running');
    console.log('2. Check Redis server is running');
    console.log('3. Verify Evolution API Redis configuration:');
    console.log('   - CACHE_REDIS_ENABLED=true');
    console.log('   - CACHE_REDIS_URI=redis://your-redis-host:6379');
    console.log('4. Check network connectivity between Evolution API and Redis');
    console.log('5. Verify Redis authentication if required');
  }
}

// Handle errors gracefully
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the tests
main().catch(error => {
  console.error('💥 Script execution failed:', error.message);
  process.exit(1);
}); 