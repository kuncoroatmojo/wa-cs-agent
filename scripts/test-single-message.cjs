#!/usr/bin/env node

const axios = require('axios');

// Evolution API Configuration
const EVOLUTION_API_URL = 'https://evo.istn.ac.id';
const EVOLUTION_API_KEY = 'YGyPcZ5tn8RfmaATbP5ou9bOP4Usc7Pk4G0k04p9G7iNMpWqbNhga2FOl6T7ud26';
const INSTANCE_NAME = 'whatsapp_6281321249433';

async function testSingleMessage() {
  console.log('Testing single WhatsApp message...');
  
  try {
    // Test PDF download first
    console.log('1. Testing PDF download...');
    const pdfUrl = 'https://backend.trak.codes/api/v0/pdf/single-case?source=GSheets&filename=pass.pdf&cextid=62da502c-56ac-4f6d-bc94-afe7011d82bc&inline=true';
    const pdfResponse = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const pdfBase64 = Buffer.from(pdfResponse.data).toString('base64');
    console.log(`✅ PDF downloaded successfully, size: ${pdfResponse.data.length} bytes`);
    
    // Test message sending
    console.log('2. Testing message send...');
    const testPhone = '6281321249433'; // Your own number for testing
    const message = `Thank you for registering for the International Symposium & Innovation Forum 2025.
Your ticket is attached below. Please bring it with you and present it at the reception desk on the event day.
We look forward to welcoming you at ISTN Jakarta on June 26. See you soon.`;

    const url = `${EVOLUTION_API_URL}/message/sendMedia/${INSTANCE_NAME}`;
    
    const payload = {
      number: testPhone,
      options: {
        delay: 1200,
        presence: 'composing'
      },
      mediaMessage: {
        mediatype: 'document',
        caption: message,
        media: `data:application/pdf;base64,${pdfBase64}`,
        fileName: 'ISIF_2025_Test_Ticket.pdf'
      }
    };

    console.log(`Sending test message to ${testPhone}...`);
    
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      timeout: 60000
    });

    console.log('✅ Test message sent successfully!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

testSingleMessage();
