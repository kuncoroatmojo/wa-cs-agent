#!/usr/bin/env node

const axios = require('axios');

// Evolution API Configuration
const EVOLUTION_API_URL = 'https://evo.istn.ac.id';
const EVOLUTION_API_KEY = 'YGyPcZ5tn8RfmaATbP5ou9bOP4Usc7Pk4G0k04p9G7iNMpWqbNhga2FOl6T7ud26';

async function testEvolutionAPI() {
  console.log('Testing Evolution API connection...');
  console.log(`API URL: ${EVOLUTION_API_URL}`);
  
  try {
    // Test basic connection
    console.log('\n1. Testing basic API connection...');
    const healthResponse = await axios.get(`${EVOLUTION_API_URL}/`, {
      headers: {
        'apikey': EVOLUTION_API_KEY
      },
      timeout: 10000
    });
    console.log('✅ API connection successful');
    console.log('Response status:', healthResponse.status);
    
    // List instances
    console.log('\n2. Listing WhatsApp instances...');
    const instancesResponse = await axios.get(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
      headers: {
        'apikey': EVOLUTION_API_KEY
      },
      timeout: 10000
    });
    
    console.log('✅ Instances retrieved successfully');
    console.log('Available instances:', JSON.stringify(instancesResponse.data, null, 2));
    
    // Test with each instance
    if (instancesResponse.data && Array.isArray(instancesResponse.data)) {
      for (const instance of instancesResponse.data) {
        console.log(`\n3. Testing instance: ${instance.instanceName || instance.name || 'unknown'}`);
        
        try {
          const instanceName = instance.instanceName || instance.name;
          const statusResponse = await axios.get(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
            headers: {
              'apikey': EVOLUTION_API_KEY
            },
            timeout: 5000
          });
          
          console.log(`   Status: ${JSON.stringify(statusResponse.data)}`);
        } catch (instanceError) {
          console.log(`   Error checking instance ${instance.instanceName || instance.name}:`, instanceError.response?.data || instanceError.message);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ API test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testEvolutionAPI();
