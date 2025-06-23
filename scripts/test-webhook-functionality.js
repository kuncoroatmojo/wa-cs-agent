#!/usr/bin/env node

/**
 * Test webhook functionality for Evolution API integration
 */

import fetch from 'node-fetch';

const WEBHOOK_URL = 'https://pfirjlhuulkchogjbvsv.supabase.co/functions/v1/whatsapp-webhook';

async function testWebhookFunctionality() {
  try {
    console.log('🚀 Testing Webhook Functionality...');
    console.log('Webhook URL:', WEBHOOK_URL);

    // 1. Test with a sample Evolution API message event
    const sampleMessageEvent = {
      event: 'messages.upsert',
      instance: 'personal',
      data: {
        key: {
          remoteJid: '6281234567890@s.whatsapp.net',
          fromMe: false,
          id: '3A2B1C4D5E6F7890',
          participant: undefined
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: 'Test User',
        message: {
          conversation: 'Hello, this is a test message from Evolution API!'
        },
        messageType: 'conversation',
        owner: 'personal'
      }
    };

    console.log('\n📨 Testing message webhook...');
    console.log('Sample event:', JSON.stringify(sampleMessageEvent, null, 2));

    const messageResponse = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Evolution-API-Webhook/1.0'
      },
      body: JSON.stringify(sampleMessageEvent)
    });

    console.log(`Status: ${messageResponse.status} ${messageResponse.statusText}`);
    
    if (messageResponse.ok) {
      const result = await messageResponse.text();
      console.log('✅ Message webhook working!');
      console.log('Response:', result);
    } else {
      const error = await messageResponse.text();
      console.log('❌ Message webhook failed:', error);
    }

    // 2. Test with a connection update event
    const connectionEvent = {
      event: 'connection.update',
      instance: 'personal',
      data: {
        state: 'open',
        connection: 'open',
        lastDisconnect: null,
        qr: null
      }
    };

    console.log('\n🔗 Testing connection webhook...');
    const connectionResponse = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Evolution-API-Webhook/1.0'
      },
      body: JSON.stringify(connectionEvent)
    });

    console.log(`Status: ${connectionResponse.status} ${connectionResponse.statusText}`);
    
    if (connectionResponse.ok) {
      const result = await connectionResponse.text();
      console.log('✅ Connection webhook working!');
      console.log('Response:', result);
    } else {
      const error = await connectionResponse.text();
      console.log('❌ Connection webhook failed:', error);
    }

    // 3. Test with a contact update event
    const contactEvent = {
      event: 'contacts.upsert',
      instance: 'personal',
      data: [
        {
          id: '6281234567890@s.whatsapp.net',
          name: 'Test User',
          notify: 'Test User',
          verifiedName: undefined,
          imgUrl: undefined,
          status: undefined
        }
      ]
    };

    console.log('\n👤 Testing contact webhook...');
    const contactResponse = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Evolution-API-Webhook/1.0'
      },
      body: JSON.stringify(contactEvent)
    });

    console.log(`Status: ${contactResponse.status} ${contactResponse.statusText}`);
    
    if (contactResponse.ok) {
      const result = await contactResponse.text();
      console.log('✅ Contact webhook working!');
      console.log('Response:', result);
    } else {
      const error = await contactResponse.text();
      console.log('❌ Contact webhook failed:', error);
    }

    console.log('\n📊 Webhook Test Summary:');
    console.log(`📨 Message Events: ${messageResponse.ok ? '✅ Working' : '❌ Failed'}`);
    console.log(`🔗 Connection Events: ${connectionResponse.ok ? '✅ Working' : '❌ Failed'}`);
    console.log(`👤 Contact Events: ${contactResponse.ok ? '✅ Working' : '❌ Failed'}`);
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Configure this webhook URL in your Evolution API:');
    console.log(`   ${WEBHOOK_URL}`);
    console.log('2. All message events will be automatically processed');
    console.log('3. Messages will be stored and available for RAG filtering');
    console.log('4. Real-time message synchronization is ready!');

  } catch (error) {
    console.error('❌ Webhook test failed:', error.message);
    console.error('Full error:', error);
  }
}

testWebhookFunctionality(); 