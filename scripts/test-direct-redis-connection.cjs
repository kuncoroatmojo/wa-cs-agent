#!/usr/bin/env node

// Direct Redis Connection Test
// This script tests Redis connection directly (if you have Redis credentials)

const redis = require('redis');

// Redis Configuration
const REDIS_URI = process.env.REDIS_URI || process.env.CACHE_REDIS_URI || 'redis://localhost:6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';

console.log('🔍 Testing Direct Redis Connection...\n');

console.log('📋 Redis Configuration:');
console.log(`   Redis URI: ${REDIS_URI}`);
console.log(`   Redis Password: ${REDIS_PASSWORD ? '✅ Set' : '❌ Not set'}`);
console.log('');

async function testDirectRedisConnection() {
  let client = null;
  
  try {
    console.log('🔗 Connecting to Redis...');
    
    // Create Redis client
    const redisConfig = {
      url: REDIS_URI
    };
    
    if (REDIS_PASSWORD) {
      redisConfig.password = REDIS_PASSWORD;
    }
    
    client = redis.createClient(redisConfig);
    
    // Handle connection events
    client.on('error', (err) => {
      console.error('❌ Redis Client Error:', err.message);
    });
    
    client.on('connect', () => {
      console.log('✅ Redis client connecting...');
    });
    
    client.on('ready', () => {
      console.log('✅ Redis client ready!');
    });
    
    client.on('end', () => {
      console.log('📡 Redis connection ended');
    });
    
    // Connect to Redis
    await client.connect();
    
    console.log('✅ Successfully connected to Redis!');
    console.log('');
    
    // Test basic Redis operations
    console.log('🧪 Testing Redis Operations...\n');
    
    // Test 1: PING
    console.log('1️⃣ Testing PING command...');
    const pingResult = await client.ping();
    console.log(`   PING result: ${pingResult}`);
    
    // Test 2: SET and GET
    console.log('\n2️⃣ Testing SET and GET commands...');
    const testKey = `evolution-redis-test-${Date.now()}`;
    const testValue = JSON.stringify({ 
      message: 'Redis test from Evolution API', 
      timestamp: new Date().toISOString(),
      test: true 
    });
    
    await client.set(testKey, testValue);
    console.log(`   SET ${testKey}: Success`);
    
    const retrievedValue = await client.get(testKey);
    console.log(`   GET ${testKey}: ${retrievedValue}`);
    
    if (retrievedValue === testValue) {
      console.log('   ✅ SET/GET test passed');
    } else {
      console.log('   ❌ SET/GET test failed - values don\'t match');
    }
    
    // Test 3: SET with expiration
    console.log('\n3️⃣ Testing SET with expiration...');
    const expireKey = `evolution-redis-expire-test-${Date.now()}`;
    await client.setEx(expireKey, 60, 'This will expire in 60 seconds');
    const ttl = await client.ttl(expireKey);
    console.log(`   SET with 60s expiration: Success (TTL: ${ttl}s)`);
    
    // Test 4: Redis INFO
    console.log('\n4️⃣ Testing Redis INFO command...');
    try {
      const info = await client.info();
      const infoLines = info.split('\r\n').filter(line => 
        line.includes('redis_version') || 
        line.includes('connected_clients') || 
        line.includes('used_memory_human') ||
        line.includes('role') ||
        line.includes('tcp_port')
      );
      
      console.log('   Redis Server Info:');
      infoLines.forEach(line => {
        if (line.trim()) {
          console.log(`     ${line}`);
        }
      });
    } catch (infoError) {
      console.log('   ⚠️  INFO command failed (may be restricted)');
    }
    
    // Test 5: Check Evolution API keys
    console.log('\n5️⃣ Checking for Evolution API cache keys...');
    try {
      const keys = await client.keys('evolution*');
      console.log(`   Found ${keys.length} Evolution API related keys:`);
      
      if (keys.length > 0) {
        keys.slice(0, 10).forEach((key, index) => {
          console.log(`     ${index + 1}. ${key}`);
        });
        
        if (keys.length > 10) {
          console.log(`     ... and ${keys.length - 10} more keys`);
        }
      } else {
        console.log('     No Evolution API cache keys found');
      }
    } catch (keysError) {
      console.log('   ⚠️  KEYS command failed (may be restricted for security)');
    }
    
    // Clean up test keys
    console.log('\n6️⃣ Cleaning up test keys...');
    await client.del(testKey);
    await client.del(expireKey);
    console.log('   Test keys cleaned up');
    
    console.log('\n🎉 All Redis tests completed successfully!');
    return true;
    
  } catch (error) {
    console.error('\n❌ Redis Connection Test Failed:');
    
    if (error.code === 'ECONNREFUSED') {
      console.error('   🔴 Connection refused - Redis server is not reachable');
      console.error('   💡 Check if Redis server is running on the specified host/port');
    } else if (error.code === 'ENOTFOUND') {
      console.error('   🔴 DNS resolution failed - Check your Redis host');
    } else if (error.message?.includes('WRONGPASS')) {
      console.error('   🔴 Authentication failed - Check your Redis password');
    } else if (error.message?.includes('NOAUTH')) {
      console.error('   🔴 Authentication required - Redis requires a password');
    } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      console.error('   🔴 Connection timeout - Redis server is not responding');
    } else {
      console.error(`   🔴 Unexpected error: ${error.message}`);
    }
    
    return false;
    
  } finally {
    if (client && client.isOpen) {
      await client.quit();
      console.log('\n📡 Redis connection closed');
    }
  }
}

// Redis configuration checker
function checkRedisConfiguration() {
  console.log('🔧 Redis Configuration Analysis:\n');
  
  // Parse Redis URI
  try {
    const url = new URL(REDIS_URI);
    console.log('   Protocol:', url.protocol);
    console.log('   Host:', url.hostname);
    console.log('   Port:', url.port || '6379');
    console.log('   Database:', url.pathname.substring(1) || '0');
    
    if (url.username) {
      console.log('   Username:', url.username);
    }
    
    if (url.password) {
      console.log('   Password in URI: ✅ Present');
    } else if (REDIS_PASSWORD) {
      console.log('   Password via env: ✅ Present');
    } else {
      console.log('   Password: ❌ Not provided');
    }
    
  } catch (parseError) {
    console.log('   ⚠️  Could not parse Redis URI:', parseError.message);
  }
  
  console.log('');
}

// Main execution
async function main() {
  console.log('🚀 Starting Direct Redis Connection Test\n');
  
  // Check configuration
  checkRedisConfiguration();
  
  // Test connection
  const success = await testDirectRedisConnection();
  
  if (success) {
    console.log('\n📊 Test Summary:');
    console.log('✅ Redis server is reachable');
    console.log('✅ Authentication successful');
    console.log('✅ Basic Redis operations working');
    console.log('✅ Redis is ready for Evolution API use');
    
  } else {
    console.log('\n❌ Redis connection test failed');
    console.log('\n🔧 Troubleshooting Steps:');
    console.log('1. Verify Redis server is running:');
    console.log('   sudo systemctl status redis-server');
    console.log('2. Check Redis configuration file (/etc/redis/redis.conf)');
    console.log('3. Verify network connectivity:');
    console.log('   telnet <redis-host> <redis-port>');
    console.log('4. Check Redis logs for errors');
    console.log('5. Verify Redis authentication settings');
    console.log('6. Test with Redis CLI:');
    console.log('   redis-cli -h <host> -p <port> -a <password> ping');
  }
  
  console.log('\n💡 Evolution API Redis Environment Variables:');
  console.log('   CACHE_REDIS_ENABLED=true');
  console.log('   CACHE_REDIS_URI=your-redis-connection-string');
  console.log('   CACHE_REDIS_PREFIX_KEY=evolution-cache');
  console.log('   CACHE_REDIS_TTL=604800');
  console.log('   CACHE_REDIS_SAVE_INSTANCES=false');
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

// Check if redis package is available
try {
  require.resolve('redis');
} catch (e) {
  console.error('❌ Redis package not found!');
  console.error('💡 Install it with: npm install redis');
  process.exit(1);
}

// Run the tests
main().catch(error => {
  console.error('💥 Script execution failed:', error.message);
  process.exit(1);
}); 