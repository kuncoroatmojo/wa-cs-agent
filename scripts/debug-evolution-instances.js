#!/usr/bin/env node

/**
 * Debug script to see Evolution API instance structure
 */

import fetch from 'node-fetch';

const EVOLUTION_API_URL = process.env.VITE_EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.VITE_EVOLUTION_API_KEY;

if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
  console.error('❌ EVOLUTION_API_URL and EVOLUTION_API_KEY environment variables are required');
  process.exit(1);
}

async function debugInstances() {
  try {
    console.log('🔍 Debugging Evolution API instances...');
    console.log('URL:', EVOLUTION_API_URL);
    
    // Test instance fetching
    const response = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Evolution API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('📦 Raw response:', JSON.stringify(data, null, 2));

    // Check if it's an array or object
    if (Array.isArray(data)) {
      console.log(`✅ Found ${data.length} instances (array format)`);
      data.forEach((instance, idx) => {
        console.log(`Instance ${idx + 1}:`, JSON.stringify(instance, null, 2));
      });
    } else if (data && typeof data === 'object') {
      console.log('✅ Response is object format');
      console.log('Keys:', Object.keys(data));
      
      // Check common possible keys
      if (data.instances) {
        console.log(`Found instances array with ${data.instances.length} items`);
        data.instances.forEach((instance, idx) => {
          console.log(`Instance ${idx + 1}:`, JSON.stringify(instance, null, 2));
        });
      } else if (data.data) {
        console.log('Found data property:', JSON.stringify(data.data, null, 2));
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  }
}

debugInstances(); 