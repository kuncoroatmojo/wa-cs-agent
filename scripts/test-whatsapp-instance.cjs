#!/usr/bin/env node

const axios = require('axios');

// Configuration
const EVOLUTION_API_URL = 'https://evo.istn.ac.id';
const EVOLUTION_API_KEY = 'YGyPcZ5tn8RfmaATbP5ou9bOP4Usc7Pk4G0k04p9G7iNMpWqbNhga2FOl6T7ud26';
const INSTANCE_NAME = 'personal';
const INSTANCE_TOKEN = 'C6DDF601982F-4854-BBAA-5C5269D80CC1';

console.log('📱 WhatsApp Instance Manager - Personal Instance');
console.log('=================================================');
console.log(`Instance: ${INSTANCE_NAME}`);
console.log(`Token: ${INSTANCE_TOKEN}`);
console.log('');

// Helper function to make API calls
async function apiCall(endpoint, method = 'GET', data = null) {
  try {
    const config = {
      method,
      url: `${EVOLUTION_API_URL}${endpoint}`,
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message,
      status: error.response?.status || 500
    };
  }
}

// Function to check instance status
async function checkInstanceStatus() {
  console.log('🔍 Checking Instance Status...');
  
  const result = await apiCall(`/instance/connectionState/${INSTANCE_NAME}`);
  
  if (result.success) {
    console.log('✅ Instance Status Retrieved:');
    console.log(`   Name: ${result.data.instance.instanceName}`);
    console.log(`   State: ${result.data.instance.state}`);
    return result.data.instance.state;
  } else {
    console.log('❌ Failed to get instance status:', result.error);
    return null;
  }
}

// Function to get instance profile
async function getInstanceProfile() {
  console.log('👤 Getting Instance Profile...');
  
  // Try different profile endpoints
  let result = await apiCall(`/chat/profile/${INSTANCE_NAME}`);
  
  if (!result.success) {
    // Try alternative endpoint
    result = await apiCall(`/instance/profile/${INSTANCE_NAME}`);
  }
  
  if (result.success) {
    console.log('✅ Profile Retrieved:');
    console.log(`   Name: ${result.data.name || result.data.profileName || 'Not set'}`);
    console.log(`   Number: ${result.data.wid || result.data.number || 'Not available'}`);
    console.log(`   Status: ${result.data.status || 'Not set'}`);
    return result.data;
  } else {
    console.log('❌ Failed to get profile:', result.error);
    return null;
  }
}

// Function to test message sending
async function testMessageSending() {
  console.log('💬 Testing Message Sending Capability...');
  
  // Use a safe test number - the instance's own number from the instances list
  const testMessage = {
    number: "628321249433", // The number from the instance
    text: `🤖 Test message from Evolution API\nTime: ${new Date().toISOString()}\nInstance: ${INSTANCE_NAME}\nPhone version: 2.3000.1023204200`
  };
  
  const result = await apiCall(`/message/sendText/${INSTANCE_NAME}`, 'POST', testMessage);
  
  if (result.success) {
    console.log('✅ Test message sent successfully');
    console.log(`   Message ID: ${result.data.key?.id || 'N/A'}`);
    return true;
  } else {
    console.log('❌ Failed to send test message:', result.error);
    return false;
  }
}

// Function to get recent chats
async function getRecentChats() {
  console.log('💬 Getting Recent Chats...');
  
  const result = await apiCall(`/chat/findChats/${INSTANCE_NAME}`);
  
  if (result.success && result.data.length > 0) {
    console.log(`✅ Found ${result.data.length} recent chats:`);
    result.data.slice(0, 5).forEach((chat, index) => {
      console.log(`   ${index + 1}. ${chat.name || chat.id} - Last: ${new Date(chat.lastMessageTimestamp || 0).toLocaleString()}`);
    });
    return result.data;
  } else {
    console.log('ℹ️  No recent chats found or failed to retrieve');
    return [];
  }
}

// Function to restart instance if needed
async function restartInstance() {
  console.log('🔄 Restarting Instance...');
  
  const result = await apiCall(`/instance/restart/${INSTANCE_NAME}`, 'PUT');
  
  if (result.success) {
    console.log('✅ Instance restart initiated');
    console.log('⏳ Waiting for restart to complete...');
    
    // Wait a bit for restart
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check status after restart
    await checkInstanceStatus();
    return true;
  } else {
    console.log('❌ Failed to restart instance:', result.error);
    return false;
  }
}

// Function to get QR code if needed
async function getQRCode() {
  console.log('📱 Getting QR Code for Connection...');
  
  const result = await apiCall(`/instance/connect/${INSTANCE_NAME}`);
  
  if (result.success) {
    console.log('✅ QR Code retrieved:');
    if (result.data.qrcode) {
      console.log('📱 QR Code available - check your Evolution API manager or logs');
      console.log(`🌐 Manager URL: http://evo.istn.ac.id/manager`);
    } else {
      console.log('ℹ️  No QR code needed - instance may already be connected');
    }
    return result.data;
  } else {
    console.log('❌ Failed to get QR code:', result.error);
    return null;
  }
}

// Function to check webhook settings
async function checkWebhookSettings() {
  console.log('🔗 Checking Webhook Settings...');
  
  const result = await apiCall(`/webhook/find/${INSTANCE_NAME}`);
  
  if (result.success && result.data) {
    console.log('✅ Webhook settings:');
    console.log(`   URL: ${result.data.url || 'Not set'}`);
    console.log(`   Events: ${result.data.events?.join(', ') || 'None'}`);
    console.log(`   Enabled: ${result.data.enabled || false}`);
    return result.data;
  } else {
    console.log('ℹ️  No webhook configured or failed to retrieve');
    return null;
  }
}

// Main test function
async function runInstanceTests() {
  console.log('🚀 Starting Comprehensive Instance Tests...\n');
  
  try {
    // 1. Check instance status
    const status = await checkInstanceStatus();
    console.log('');
    
    // 2. Get profile information
    await getInstanceProfile();
    console.log('');
    
    // 3. Check webhook settings
    await checkWebhookSettings();
    console.log('');
    
    // 4. Get recent chats
    await getRecentChats();
    console.log('');
    
    // 5. Test messaging if connected
    if (status === 'open') {
      await testMessageSending();
      console.log('');
    } else {
      console.log('⚠️  Instance not fully connected - skipping message test');
      console.log('');
      
      // Try to get QR code for reconnection
      await getQRCode();
      console.log('');
    }
    
    console.log('🎉 Instance tests completed!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`   Instance: ${INSTANCE_NAME}`);
    console.log(`   Status: ${status || 'Unknown'}`);
    console.log(`   API: ${EVOLUTION_API_URL}`);
    console.log(`   Manager: http://evo.istn.ac.id/manager`);
    
  } catch (error) {
    console.error('❌ Unexpected error during tests:', error.message);
  }
}

// Helper functions for specific actions
async function sendMessage(number, text) {
  console.log(`📤 Sending message to ${number}...`);
  
  const messageData = {
    number: number.replace(/[^\d]/g, ''), // Clean number
    text: text
  };
  
  const result = await apiCall(`/message/sendText/${INSTANCE_NAME}`, 'POST', messageData);
  
  if (result.success) {
    console.log('✅ Message sent successfully');
    console.log(`   Message ID: ${result.data.key?.id || 'N/A'}`);
    return result.data;
  } else {
    console.log('❌ Failed to send message:', result.error);
    return null;
  }
}

// Export functions for use in other scripts
module.exports = {
  checkInstanceStatus,
  getInstanceProfile,
  testMessageSending,
  getRecentChats,
  restartInstance,
  getQRCode,
  checkWebhookSettings,
  sendMessage,
  apiCall,
  INSTANCE_NAME,
  INSTANCE_TOKEN
};

// Run tests if this script is executed directly
if (require.main === module) {
  runInstanceTests().catch(console.error);
} 