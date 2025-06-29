#!/usr/bin/env node

const axios = require('axios');

// Configuration
const EVOLUTION_API_URL = 'https://evo.istn.ac.id';
const EVOLUTION_API_KEY = 'YGyPcZ5tn8RfmaATbP5ou9bOP4Usc7Pk4G0k04p9G7iNMpWqbNhga2FOl6T7ud26';
const INSTANCE_NAME = 'personal';

// Test phone number (Irdra's number)
const TEST_PHONE = '628112224272';

async function makeApiCall(endpoint, method = 'GET', data = null) {
  try {
    console.log(`Making ${method} request to ${endpoint}`);
    if (data) {
      console.log('Request data:', JSON.stringify(data, null, 2));
    }

    const config = {
      method,
      url: `${EVOLUTION_API_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      timeout: 60000 // 60 seconds
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

async function main() {
  try {
    // 1. Connect/Reconnect instance (this will generate QR if needed)
    console.log('\n1. Connecting instance...');
    await makeApiCall(`/instance/connect/${INSTANCE_NAME}`, 'GET');

    // Wait for connection
    console.log('\nWaiting 5 seconds for connection...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 2. Send a text message
    console.log('\n2. Sending text message...');
    const textMessageData = {
      number: TEST_PHONE,
      text: "Test message from ISIF 2025 system",
      delay: 1000,
      linkPreview: false
    };
    
    await makeApiCall(`/message/sendText/${INSTANCE_NAME}`, 'POST', textMessageData);

    // Wait between messages
    console.log('\nWaiting 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 3. Send a document message
    console.log('\n3. Sending document message...');
    const documentMessageData = {
      number: TEST_PHONE,
      mediatype: "document",
      mimetype: "application/pdf",
      caption: "Test PDF message",
      media: "https://backend.trak.codes/api/v0/pdf/single-case?code=ISIF2025-001",
      fileName: "ISIF2025-ticket.pdf",
      delay: 1000
    };
    
    await makeApiCall(`/message/sendMedia/${INSTANCE_NAME}`, 'POST', documentMessageData);

    console.log('\n✅ All tests completed successfully');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();
