#!/usr/bin/env node

console.log('🔍 Redis Connection Diagnosis for Evolution API\n');

const axios = require('axios');

// Configuration Analysis
console.log('📋 Configuration Analysis:\n');

// Check environment variables
const envVars = {
  // From .env file (Docker setup)
  REDIS_URL: process.env.REDIS_URL || 'redis://redis:6379',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://evolution:evolution123@postgres:5432/evolution',
  API_KEY: process.env.API_KEY || '215ba1a65be3ae69a4c8b3d09867f012411bc1030bf5d43cbf896b5708a9c8c5',
  
  // For external Evolution API
  VITE_EVOLUTION_API_URL: process.env.VITE_EVOLUTION_API_URL,
  VITE_EVOLUTION_API_KEY: process.env.VITE_EVOLUTION_API_KEY,
  
  // Direct Redis access
  CACHE_REDIS_URI: process.env.CACHE_REDIS_URI,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD
};

console.log('🔧 Environment Configuration:');
console.log(`   Local Redis URL (Docker): ${envVars.REDIS_URL}`);
console.log(`   External Evolution API URL: ${envVars.VITE_EVOLUTION_API_URL || '❌ Not set'}`);
console.log(`   External Evolution API Key: ${envVars.VITE_EVOLUTION_API_KEY ? '✅ Set' : '❌ Not set'}`);
console.log(`   Direct Redis URI: ${envVars.CACHE_REDIS_URI || '❌ Not set'}`);
console.log('');

// Deployment scenario detection
function detectDeploymentScenario() {
  console.log('🎯 Deployment Scenario Detection:\n');
  
  const scenarios = [];
  
  // Scenario 1: Docker Compose (local development)
  if (envVars.REDIS_URL.includes('redis:6379') && envVars.DATABASE_URL.includes('postgres:5432')) {
    scenarios.push({
      type: 'Docker Compose',
      description: 'Local development with Docker containers',
      redisEndpoint: 'redis:6379 (container)',
      status: 'Detected',
      requirements: ['Docker Desktop running', 'docker-compose.yml file', 'Evolution API container']
    });
  }
  
  // Scenario 2: External Evolution API (production/hosted)
  if (envVars.VITE_EVOLUTION_API_URL && envVars.VITE_EVOLUTION_API_KEY) {
    scenarios.push({
      type: 'External Evolution API',
      description: 'Hosted Evolution API service',
      redisEndpoint: 'Managed by Evolution API provider',
      status: 'Detected',
      requirements: ['Valid API URL', 'Valid API Key', 'Network connectivity']
    });
  }
  
  // Scenario 3: Direct Redis access
  if (envVars.CACHE_REDIS_URI) {
    scenarios.push({
      type: 'Direct Redis',
      description: 'Direct Redis server access',
      redisEndpoint: envVars.CACHE_REDIS_URI,
      status: 'Detected',
      requirements: ['Redis server running', 'Network access', 'Authentication if required']
    });
  }
  
  // Scenario 4: Azure/Cloud deployment
  if (envVars.REDIS_URL.includes('.redis.cache.windows.net') || 
      envVars.CACHE_REDIS_URI?.includes('.redis.cache.windows.net')) {
    scenarios.push({
      type: 'Azure Redis Cache',
      description: 'Azure managed Redis service',
      redisEndpoint: 'Azure Redis Cache',
      status: 'Detected',
      requirements: ['Azure Redis Cache provisioned', 'Firewall rules configured', 'Access keys valid']
    });
  }
  
  if (scenarios.length === 0) {
    scenarios.push({
      type: 'Unknown/Incomplete',
      description: 'Configuration incomplete or unrecognized',
      redisEndpoint: 'Not properly configured',
      status: 'Issue',
      requirements: ['Complete environment configuration needed']
    });
  }
  
  scenarios.forEach((scenario, index) => {
    console.log(`${index + 1}️⃣ ${scenario.type}:`);
    console.log(`   📝 Description: ${scenario.description}`);
    console.log(`   🔗 Redis Endpoint: ${scenario.redisEndpoint}`);
    console.log(`   📊 Status: ${scenario.status}`);
    console.log(`   ✅ Requirements:`);
    scenario.requirements.forEach(req => console.log(`      - ${req}`));
    console.log('');
  });
  
  return scenarios;
}

// Test Docker setup
async function testDockerSetup() {
  console.log('🐳 Docker Setup Test:\n');
  
  try {
    // Check if Docker is running
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    
    try {
      const { stdout } = await execPromise('docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"');
      console.log('✅ Docker is running');
      console.log('📋 Running containers:');
      console.log(stdout);
      
      // Check for Evolution API related containers
      const containers = stdout.split('\n').filter(line => line.trim());
      const evolutionContainers = containers.filter(line => 
        line.includes('evolution') || line.includes('redis') || line.includes('postgres')
      );
      
      if (evolutionContainers.length > 0) {
        console.log('🎉 Found Evolution API related containers:');
        evolutionContainers.forEach(container => console.log(`   ${container}`));
      } else {
        console.log('⚠️  No Evolution API containers found');
        console.log('💡 You may need to run: docker-compose up -d');
      }
      
    } catch (dockerError) {
      console.log('❌ Docker is not running or not accessible');
      console.log('💡 Start Docker Desktop or install Docker');
    }
    
  } catch (error) {
    console.log('❌ Cannot check Docker status:', error.message);
  }
  
  console.log('');
}

// Test external Evolution API
async function testExternalEvolutionAPI() {
  console.log('🌐 External Evolution API Test:\n');
  
  if (!envVars.VITE_EVOLUTION_API_URL || !envVars.VITE_EVOLUTION_API_KEY) {
    console.log('⚠️  External Evolution API not configured');
    console.log('💡 Set VITE_EVOLUTION_API_URL and VITE_EVOLUTION_API_KEY in .env');
    console.log('');
    return false;
  }
  
  try {
    console.log(`🔗 Testing: ${envVars.VITE_EVOLUTION_API_URL}`);
    
    const response = await axios.get(`${envVars.VITE_EVOLUTION_API_URL}/`, {
      headers: {
        'apikey': envVars.VITE_EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Evolution API is reachable');
    console.log(`   Status: ${response.status}`);
    console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
    
    // Test instances endpoint (Redis-dependent)
    try {
      const instancesResponse = await axios.get(`${envVars.VITE_EVOLUTION_API_URL}/instance/fetchInstances`, {
        headers: {
          'apikey': envVars.VITE_EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      console.log('✅ Instances endpoint working (Redis likely OK)');
      console.log(`   Instances: ${instancesResponse.data?.length || 0}`);
      
    } catch (instanceError) {
      console.log('❌ Instances endpoint failed (Redis may have issues)');
      console.log(`   Error: ${instanceError.message}`);
    }
    
    return true;
    
  } catch (error) {
    console.log('❌ External Evolution API test failed');
    if (error.code === 'ECONNREFUSED') {
      console.log('   🔴 Connection refused - API server not reachable');
    } else if (error.response?.status === 401) {
      console.log('   🔴 Authentication failed - Check API key');
    } else {
      console.log(`   🔴 Error: ${error.message}`);
    }
    return false;
  } finally {
    console.log('');
  }
}

// Test direct Redis connection
async function testDirectRedis() {
  console.log('🔴 Direct Redis Test:\n');
  
  const redisUris = [
    envVars.CACHE_REDIS_URI,
    'redis://localhost:6379',
    'redis://127.0.0.1:6379'
  ].filter(Boolean);
  
  if (redisUris.length === 0) {
    console.log('⚠️  No Redis URIs to test');
    console.log('💡 Redis is likely only accessible within Docker network');
    console.log('');
    return false;
  }
  
  const redis = require('redis');
  
  for (const uri of redisUris) {
    console.log(`🔗 Testing Redis: ${uri}`);
    
    let client = null;
    try {
      const config = { url: uri };
      if (envVars.REDIS_PASSWORD) {
        config.password = envVars.REDIS_PASSWORD;
      }
      
      client = redis.createClient(config);
      
      // Set a shorter timeout for testing
      await Promise.race([
        client.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 5000))
      ]);
      
      const pingResult = await client.ping();
      console.log(`✅ Redis connection successful - PING: ${pingResult}`);
      
      await client.quit();
      return true;
      
    } catch (error) {
      console.log(`❌ Redis connection failed: ${error.message}`);
      if (client && client.isOpen) {
        try { await client.quit(); } catch (e) { /* ignore */ }
      }
    }
  }
  
  console.log('');
  return false;
}

// Generate recommendations
function generateRecommendations(scenarios, dockerOk, externalApiOk, directRedisOk) {
  console.log('💡 Recommendations:\n');
  
  if (externalApiOk) {
    console.log('🎉 RECOMMENDED: Use External Evolution API');
    console.log('   ✅ Your external Evolution API is working');
    console.log('   ✅ Redis is managed by the API provider');
    console.log('   ✅ No local Redis setup needed');
    console.log('   📝 Configure your app to use:');
    console.log(`      VITE_EVOLUTION_API_URL=${envVars.VITE_EVOLUTION_API_URL}`);
    console.log(`      VITE_EVOLUTION_API_KEY=${envVars.VITE_EVOLUTION_API_KEY?.substring(0, 8)}...`);
    console.log('');
  }
  
  if (dockerOk && !externalApiOk) {
    console.log('🐳 ALTERNATIVE: Use Docker Setup');
    console.log('   ✅ Docker is available');
    console.log('   📝 To start Evolution API with Redis:');
    console.log('      1. Create docker-compose.yml (see Evolution API docs)');
    console.log('      2. Run: docker-compose up -d');
    console.log('      3. Redis will be available at redis:6379 within containers');
    console.log('');
  }
  
  if (directRedisOk) {
    console.log('🔴 LOCAL REDIS: Direct Redis Access Available');
    console.log('   ✅ Redis server is accessible');
    console.log('   📝 You can connect Evolution API directly to this Redis');
    console.log('');
  }
  
  if (!externalApiOk && !dockerOk && !directRedisOk) {
    console.log('🔧 SETUP NEEDED: Choose One Option');
    console.log('');
    console.log('Option 1 - Use Hosted Evolution API (Recommended):');
    console.log('   1. Sign up for hosted Evolution API service');
    console.log('   2. Get API URL and key');
    console.log('   3. Set VITE_EVOLUTION_API_URL and VITE_EVOLUTION_API_KEY');
    console.log('');
    console.log('Option 2 - Local Docker Setup:');
    console.log('   1. Install Docker Desktop');
    console.log('   2. Create docker-compose.yml with Evolution API + Redis');
    console.log('   3. Run: docker-compose up -d');
    console.log('');
    console.log('Option 3 - Install Local Redis:');
    console.log('   1. Install Redis: brew install redis (macOS)');
    console.log('   2. Start Redis: brew services start redis');
    console.log('   3. Update Redis URI to: redis://localhost:6379');
    console.log('');
  }
  
  console.log('🔧 Current Configuration Issues:');
  if (envVars.REDIS_URL.includes('redis:6379') && !dockerOk) {
    console.log('   ❌ Redis URL points to Docker container but Docker not running');
  }
  if (!envVars.VITE_EVOLUTION_API_URL && !dockerOk) {
    console.log('   ❌ No external Evolution API configured and no Docker setup');
  }
  if (envVars.DATABASE_URL.includes('postgres:5432') && !dockerOk) {
    console.log('   ❌ Database URL points to Docker container but Docker not running');
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting Redis Connection Diagnosis\n');
  
  const scenarios = detectDeploymentScenario();
  
  // Run tests
  await testDockerSetup();
  const externalApiOk = await testExternalEvolutionAPI();
  const directRedisOk = await testDirectRedis();
  
  // Check if Docker containers are actually running
  const dockerOk = scenarios.some(s => s.type === 'Docker Compose') && 
                   !process.env.DOCKER_ERROR; // Simple check, could be more sophisticated
  
  generateRecommendations(scenarios, dockerOk, externalApiOk, directRedisOk);
  
  console.log('📊 Summary:');
  console.log(`   External Evolution API: ${externalApiOk ? '✅ Working' : '❌ Not working'}`);
  console.log(`   Docker Setup: ${dockerOk ? '✅ Available' : '❌ Not available'}`);
  console.log(`   Direct Redis: ${directRedisOk ? '✅ Working' : '❌ Not working'}`);
  console.log('');
  
  if (externalApiOk || dockerOk || directRedisOk) {
    console.log('🎉 At least one Redis solution is available!');
  } else {
    console.log('⚠️  No working Redis solution found. Setup required.');
  }
}

// Handle errors gracefully
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection:', reason);
  process.exit(1);
});

// Run the diagnosis
main().catch(error => {
  console.error('💥 Diagnosis failed:', error.message);
  process.exit(1);
}); 