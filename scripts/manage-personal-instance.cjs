#!/usr/bin/env node

const axios = require('axios');

// Configuration for personal instance
const CONFIG = {
  API_URL: 'https://evo.istn.ac.id',
  API_KEY: 'YGyPcZ5tn8RfmaATbP5ou9bOP4Usc7Pk4G0k04p9G7iNMpWqbNhga2FOl6T7ud26',
  INSTANCE_NAME: 'personal',
  INSTANCE_TOKEN: 'C6DDF601982F-4854-BBAA-5C5269D80CC1'
};

console.log('📱 Personal WhatsApp Instance Manager');
console.log('====================================');
console.log(`Instance: ${CONFIG.INSTANCE_NAME}`);
console.log(`Token: ${CONFIG.INSTANCE_TOKEN}`);
console.log(`API: ${CONFIG.API_URL}`);
console.log('');

// Helper function for API calls
async function apiCall(endpoint, method = 'GET', data = null) {
  try {
    const config = {
      method,
      url: `${CONFIG.API_URL}${endpoint}`,
      headers: {
        'apikey': CONFIG.API_KEY,
        'Content-Type': 'application/json'
      }
    };
    
    if (data) config.data = data;
    
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

// Get instance status
async function getStatus() {
  console.log('🔍 Getting Instance Status...');
  const result = await apiCall(`/instance/connectionState/${CONFIG.INSTANCE_NAME}`);
  
  if (result.success) {
    console.log('✅ Status:', result.data.instance.state);
    return result.data.instance.state;
  } else {
    console.log('❌ Error:', result.error);
    return null;
  }
}

// Get instance details from the list
async function getInstanceDetails() {
  console.log('📋 Getting Instance Details...');
  const result = await apiCall('/instance/fetchInstances');
  
  if (result.success) {
    const personalInstance = result.data.find(inst => inst.name === CONFIG.INSTANCE_NAME);
    if (personalInstance) {
      console.log('✅ Instance Details:');
      console.log(`   Name: ${personalInstance.name}`);
      console.log(`   Status: ${personalInstance.connectionStatus}`);
      console.log(`   Number: ${personalInstance.number}`);
      console.log(`   Profile Name: ${personalInstance.profileName || 'Not set'}`);
      console.log(`   Owner JID: ${personalInstance.ownerJid || 'Not connected'}`);
      console.log(`   Integration: ${personalInstance.integration}`);
      console.log(`   Created: ${new Date(personalInstance.createdAt).toLocaleString()}`);
      console.log(`   Updated: ${new Date(personalInstance.updatedAt).toLocaleString()}`);
      
      if (personalInstance.disconnectionReasonCode) {
        console.log(`   Last Disconnect: ${personalInstance.disconnectionReasonCode} at ${new Date(personalInstance.disconnectionAt).toLocaleString()}`);
      }
      
      return personalInstance;
    } else {
      console.log('❌ Instance not found');
      return null;
    }
  } else {
    console.log('❌ Error:', result.error);
    return null;
  }
}

// Send a message (requires valid WhatsApp number)
async function sendMessage(number, text) {
  console.log(`📤 Sending message to ${number}...`);
  
  const messageData = {
    number: number.replace(/[^\d]/g, ''), // Clean number
    text: text
  };
  
  const result = await apiCall(`/message/sendText/${CONFIG.INSTANCE_NAME}`, 'POST', messageData);
  
  if (result.success) {
    console.log('✅ Message sent successfully');
    console.log(`   Message ID: ${result.data.key?.id || 'N/A'}`);
    console.log(`   To: ${result.data.key?.remoteJid || 'N/A'}`);
    return result.data;
  } else {
    console.log('❌ Failed to send message:', result.error);
    if (result.error?.response?.message) {
      console.log('   Details:', result.error.response.message);
    }
    return null;
  }
}

// Get QR code for connection
async function getQRCode() {
  console.log('📱 Getting QR Code...');
  const result = await apiCall(`/instance/connect/${CONFIG.INSTANCE_NAME}`);
  
  if (result.success) {
    if (result.data.qrcode) {
      console.log('✅ QR Code available');
      console.log('📱 Scan this QR code with WhatsApp');
      console.log('🌐 Or check the manager: http://evo.istn.ac.id/manager');
    } else {
      console.log('ℹ️  Instance already connected or no QR code needed');
    }
    return result.data;
  } else {
    console.log('❌ Error getting QR code:', result.error);
    return null;
  }
}

// Restart instance
async function restartInstance() {
  console.log('🔄 Restarting instance...');
  const result = await apiCall(`/instance/restart/${CONFIG.INSTANCE_NAME}`, 'PUT');
  
  if (result.success) {
    console.log('✅ Instance restart initiated');
    console.log('⏳ Waiting 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    await getStatus();
    return true;
  } else {
    console.log('❌ Failed to restart:', result.error);
    return false;
  }
}

// Main menu
async function showMenu() {
  console.log('\n🎯 Available Actions:');
  console.log('1. Check Status');
  console.log('2. Get Instance Details');
  console.log('3. Get QR Code');
  console.log('4. Restart Instance');
  console.log('5. Send Test Message (specify number)');
  console.log('6. Exit');
  console.log('');
}

// Run based on command line argument
async function main() {
  const action = process.argv[2];
  
  if (!action) {
    await showMenu();
    console.log('💡 Usage: node manage-personal-instance.cjs [action]');
    console.log('   Actions: status, details, qr, restart, send');
    console.log('   Example: node manage-personal-instance.cjs status');
    console.log('   Example: node manage-personal-instance.cjs send 6281234567890 "Hello World"');
    return;
  }
  
  switch (action.toLowerCase()) {
    case 'status':
      await getStatus();
      break;
    case 'details':
      await getInstanceDetails();
      break;
    case 'qr':
      await getQRCode();
      break;
    case 'restart':
      await restartInstance();
      break;
    case 'send':
      const number = process.argv[3];
      const text = process.argv[4];
      if (!number || !text) {
        console.log('❌ Usage: node manage-personal-instance.cjs send <number> <text>');
        console.log('   Example: node manage-personal-instance.cjs send 6281234567890 "Hello World"');
      } else {
        await sendMessage(number, text);
      }
      break;
    case 'full':
      console.log('🚀 Running full status check...\n');
      await getStatus();
      console.log('');
      await getInstanceDetails();
      break;
    default:
      console.log('❌ Unknown action. Available: status, details, qr, restart, send, full');
  }
}

// Export functions for use in other scripts
module.exports = {
  getStatus,
  getInstanceDetails,
  sendMessage,
  getQRCode,
  restartInstance,
  apiCall,
  CONFIG
};

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
} 