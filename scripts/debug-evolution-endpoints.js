#!/usr/bin/env node

/**
 * Debug script to find the correct Evolution API endpoints
 */

import fetch from 'node-fetch';

const EVOLUTION_API_URL = process.env.VITE_EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
  console.error('❌ EVOLUTION_API_URL and EVOLUTION_API_KEY environment variables are required');
  process.exit(1);
}

async function testEndpoints() {
  try {
    console.log('🔍 Testing Evolution API endpoints...');
    console.log('URL:', EVOLUTION_API_URL);
    
    const instanceName = 'personal';
    
    // Common endpoints to test
    const endpoints = [
      `/message/findMessages/${instanceName}`,
      `/chat/findMessages/${instanceName}`,
      `/message/find/${instanceName}`,
      `/chat/find/${instanceName}`,
      `/${instanceName}/message/find`,
      `/${instanceName}/chat/find`,
      `/${instanceName}/messages`,
      `/instance/${instanceName}/messages`,
      `/message/${instanceName}`,
      `/chat/${instanceName}`,
      `/message/fetchMessages/${instanceName}`,
      `/chat/fetchMessages/${instanceName}`,
      `/messages/${instanceName}`,
      `/messages/find/${instanceName}`,
      `/message/search/${instanceName}`,
      `/chat/search/${instanceName}`
    ];

    console.log(`\n🧪 Testing ${endpoints.length} potential message endpoints...`);

    for (const endpoint of endpoints) {
      try {
        console.log(`\n🔍 Testing: ${endpoint}`);
        const response = await fetch(`${EVOLUTION_API_URL}${endpoint}`, {
          method: 'GET',
          headers: {
            'apikey': EVOLUTION_API_KEY,
            'Content-Type': 'application/json'
          }
        });

        console.log(`  Status: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`  ✅ SUCCESS! Found data with ${Array.isArray(data) ? data.length : 'unknown'} items`);
          
          if (Array.isArray(data) && data.length > 0) {
            console.log('  📝 Sample data structure:');
            console.log('  ' + JSON.stringify(data[0], null, 4).split('\n').join('\n  '));
          } else if (data && typeof data === 'object') {
            console.log('  📝 Response structure:');
            console.log('  Keys:', Object.keys(data));
          }
          
          // If we found messages, no need to test more
          if (Array.isArray(data) && data.length > 0) {
            console.log('\n🎉 Found working endpoint!');
            return endpoint;
          }
        } else {
          const errorText = await response.text();
          console.log(`  ❌ Error: ${errorText.substring(0, 100)}...`);
        }
      } catch (error) {
        console.log(`  ❌ Exception: ${error.message}`);
      }
    }

    // Also try to get chat/conversation list
    console.log('\n📞 Testing chat/conversation list endpoints...');
    const chatEndpoints = [
      `/chat/findChats/${instanceName}`,
      `/chat/find/${instanceName}`,
      `/${instanceName}/chat/find`,
      `/${instanceName}/chats`,
      `/instance/${instanceName}/chats`,
      `/chats/${instanceName}`,
      `/chats/find/${instanceName}`
    ];

    for (const endpoint of chatEndpoints) {
      try {
        console.log(`\n🔍 Testing chat endpoint: ${endpoint}`);
        const response = await fetch(`${EVOLUTION_API_URL}${endpoint}`, {
          method: 'GET',
          headers: {
            'apikey': EVOLUTION_API_KEY,
            'Content-Type': 'application/json'
          }
        });

        console.log(`  Status: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`  ✅ SUCCESS! Found ${Array.isArray(data) ? data.length : 'unknown'} chats`);
          
          if (Array.isArray(data) && data.length > 0) {
            console.log('  📝 Sample chat structure:');
            console.log('  ' + JSON.stringify(data[0], null, 4).split('\n').join('\n  '));
            
            // Try to get messages for this specific chat
            const chatId = data[0].id || data[0].jid || data[0].remoteJid;
            if (chatId) {
              console.log(`\n💬 Trying to get messages for chat: ${chatId}`);
              const messageEndpoints = [
                `/message/findMessages/${instanceName}?remoteJid=${chatId}`,
                `/chat/findMessages/${instanceName}?chatId=${chatId}`,
                `/message/find/${instanceName}/${chatId}`,
                `/${instanceName}/message/find/${chatId}`
              ];
              
              for (const msgEndpoint of messageEndpoints) {
                try {
                  const msgResponse = await fetch(`${EVOLUTION_API_URL}${msgEndpoint}`, {
                    method: 'GET',
                    headers: {
                      'apikey': EVOLUTION_API_KEY,
                      'Content-Type': 'application/json'
                    }
                  });
                  
                  if (msgResponse.ok) {
                    const msgData = await msgResponse.json();
                    console.log(`    ✅ Messages found: ${Array.isArray(msgData) ? msgData.length : 'unknown'}`);
                    if (Array.isArray(msgData) && msgData.length > 0) {
                      console.log('    🎉 Found working message endpoint for specific chat!');
                      return msgEndpoint;
                    }
                  }
                } catch (e) {
                  // Silent fail for specific chat message tests
                }
              }
            }
          }
        } else {
          const errorText = await response.text();
          console.log(`  ❌ Error: ${errorText.substring(0, 100)}...`);
        }
      } catch (error) {
        console.log(`  ❌ Exception: ${error.message}`);
      }
    }

    console.log('\n❌ No working message endpoints found');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testEndpoints(); 