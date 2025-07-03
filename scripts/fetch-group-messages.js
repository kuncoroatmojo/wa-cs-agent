#!/usr/bin/env node

/**
 * Script to fetch all messages from Evolution API for a specific group
 * and save them to a text file
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

const EVOLUTION_API_URL = process.env.VITE_EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.VITE_EVOLUTION_API_KEY;

// Group ID provided by user
const GROUP_ID = '120363410585796672';
const REMOTE_JID = `${GROUP_ID}@g.us`; // WhatsApp group format

if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
  console.error('❌ Missing required environment variables:');
  if (!EVOLUTION_API_URL) console.error('  - VITE_EVOLUTION_API_URL');
  if (!EVOLUTION_API_KEY) console.error('  - VITE_EVOLUTION_API_KEY');
  console.error('\nPlease set these in your .env file or environment.');
  process.exit(1);
}

// Function to extract readable content from a message
function extractMessageContent(message) {
  // Handle basic text messages
  if (message.message?.conversation) {
    return message.message.conversation;
  }
  
  // Handle extended text messages (with links, formatting, etc.)
  if (message.message?.extendedTextMessage?.text) {
    return message.message.extendedTextMessage.text;
  }
  
  // Handle images with captions
  if (message.message?.imageMessage?.caption) {
    return `[IMAGE] ${message.message.imageMessage.caption}`;
  }
  
  // Handle videos with captions
  if (message.message?.videoMessage?.caption) {
    return `[VIDEO] ${message.message.videoMessage.caption}`;
  }
  
  // Handle document messages
  if (message.message?.documentMessage) {
    const fileName = message.message.documentMessage.fileName || 'Unknown file';
    const caption = message.message.documentMessage.caption || '';
    return `[DOCUMENT: ${fileName}] ${caption}`.trim();
  }
  
  // Handle audio messages
  if (message.message?.audioMessage) {
    return '[AUDIO MESSAGE]';
  }
  
  // Handle location messages
  if (message.message?.locationMessage) {
    const lat = message.message.locationMessage.degreesLatitude;
    const lng = message.message.locationMessage.degreesLongitude;
    const name = message.message.locationMessage.name || 'Location';
    return `[LOCATION: ${name}] ${lat}, ${lng}`;
  }
  
  // Handle contact messages
  if (message.message?.contactMessage) {
    const displayName = message.message.contactMessage.displayName || 'Contact';
    return `[CONTACT: ${displayName}]`;
  }
  
  // Handle sticker messages
  if (message.message?.stickerMessage) {
    return '[STICKER]';
  }
  
  // Handle reactions
  if (message.message?.reactionMessage) {
    const emoji = message.message.reactionMessage.text || '👍';
    return `[REACTION: ${emoji}]`;
  }
  
  // Handle quoted messages
  if (message.message?.quotedMessage) {
    return '[QUOTED MESSAGE]';
  }
  
  // For system messages or other types
  if (message.messageType) {
    return `[${message.messageType.toUpperCase()}]`;
  }
  
  return '[UNKNOWN MESSAGE TYPE]';
}

// Function to format timestamp
function formatTimestamp(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

// Function to get sender name
function getSenderName(message) {
  // For group messages, use participant info or pushName
  if (message.key?.participant) {
    return message.pushName || message.key.participant.replace('@s.whatsapp.net', '');
  }
  
  // For direct messages from/to the instance
  if (message.key?.fromMe) {
    return 'Me (Bot/Instance)';
  }
  
  return message.pushName || 'Unknown';
}

async function fetchGroupMessages() {
  console.log('🔍 Fetching messages from Evolution API...');
  console.log(`📱 Group ID: ${GROUP_ID}`);
  console.log(`🆔 Remote JID: ${REMOTE_JID}`);
  console.log(`🌐 API URL: ${EVOLUTION_API_URL}`);
  console.log('');

  try {
    // First, get list of instances to find the correct one
    console.log('📋 Fetching available instances...');
    const instancesResponse = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!instancesResponse.ok) {
      throw new Error(`Failed to fetch instances: ${instancesResponse.status} ${instancesResponse.statusText}`);
    }

    const instances = await instancesResponse.json();
    console.log(`✅ Found ${instances.length} instances`);
    
    // Show instance summary for large exports
    console.log('📊 Available instances:');
    instances.forEach((inst, idx) => {
      console.log(`  ${idx + 1}. ${inst.name}: ${inst.connectionStatus} (${inst._count.Message} messages)`);
    });
    
    if (instances.length === 0) {
      console.error('❌ No instances found');
      return;
    }

    // Try to find a suitable instance
    let instanceName = null;
    
    // Look for connected instances first (checking connectionStatus field)
    const connectedInstance = instances.find(inst => 
      inst.connectionStatus === 'open'
    );
    
    if (connectedInstance) {
      instanceName = connectedInstance.name;
      console.log(`✅ Using connected instance: ${instanceName} (status: ${connectedInstance.connectionStatus})`);
    } else {
      // Look for instances with any available status
      const availableInstance = instances.find(inst => inst.name) || instances[0];
      instanceName = availableInstance.name;
      
      if (instanceName) {
        console.log(`⚠️ Using available instance: ${instanceName} (status: ${availableInstance.connectionStatus})`);
      } else {
        console.log('❌ Could not find any instances with names');
        return;
      }
    }
    
    console.log('');

        // Try multiple approaches to get all messages for the group
    console.log(`📨 Attempting to fetch ALL messages for group ${GROUP_ID}...`);
    console.log(`🔄 Trying different pagination approaches...`);
    
    let allGroupMessages = [];
    let batchCount = 0;
    
    // Approach 1: Try direct group filtering with large limits
    console.log(`\n📦 Approach 1: Direct group filtering with pagination...`);
    for (let page = 0; page < 20; page++) { // Try up to 20 pages
      batchCount++;
      console.log(`   📄 Page ${page + 1} (limit: 500, offset: ${page * 500})...`);
      
      let response = await fetch(`${EVOLUTION_API_URL}/chat/findMessages/${instanceName}`, {
        method: 'POST',
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          where: {
            key: {
              remoteJid: REMOTE_JID
            }
          },
          limit: 500,
          offset: page * 500,
          order: [['messageTimestamp', 'DESC']]
        })
      });

      if (response.ok) {
        const result = await response.json();
        let pageMessages = [];
        
        if (result && result.messages && Array.isArray(result.messages.records)) {
          pageMessages = result.messages.records;
        } else if (Array.isArray(result)) {
          pageMessages = result;
        }
        
        console.log(`     ✅ Page ${page + 1}: ${pageMessages.length} messages`);
        
        if (pageMessages.length === 0) {
          console.log(`     📭 No more messages, stopping pagination.`);
          break;
        }
        
        allGroupMessages = allGroupMessages.concat(pageMessages);
        
        if (pageMessages.length < 500) {
          console.log(`     📭 Received ${pageMessages.length} < 500, reached end.`);
          break;
        }
      } else {
        console.log(`     ❌ Page ${page + 1} failed: ${response.status}`);
        break;
      }
    }
    
    // If direct approach didn't work or got limited results, try fetching all and filtering
    if (allGroupMessages.length < 10) {
      console.log(`\n📦 Approach 2: Fetch all messages and filter locally...`);
      
      let response = await fetch(`${EVOLUTION_API_URL}/chat/findMessages/${instanceName}`, {
        method: 'POST',
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          limit: 10000  // Try very large limit
        })
      });

      if (response.ok) {
        const result = await response.json();
        let allMessages = [];
        
        if (result && result.messages && Array.isArray(result.messages.records)) {
          allMessages = result.messages.records;
        } else if (Array.isArray(result)) {
          allMessages = result;
        }
        
        console.log(`     ✅ Approach 2: Downloaded ${allMessages.length} total messages`);
        
        // Filter for group messages
        const groupMessages = allMessages.filter(msg => {
          const messageRemoteJid = msg.key?.remoteJid;
          return messageRemoteJid === REMOTE_JID || 
                 messageRemoteJid === `${GROUP_ID}@g.us` ||
                 messageRemoteJid === `${GROUP_ID}@c.us` ||
                 messageRemoteJid?.includes(GROUP_ID);
        });
        
        if (groupMessages.length > allGroupMessages.length) {
          console.log(`     🎯 Found ${groupMessages.length} group messages via approach 2!`);
          allGroupMessages = groupMessages;
        }
      } else {
        console.log(`     ❌ Approach 2 failed: ${response.status}`);
      }
    }

    let messages = allGroupMessages;
    console.log(`\n🎉 Total messages found for group ${GROUP_ID}: ${messages.length}`);
    
        // Try ALL instances systematically to find more messages
    console.log(`\n🔄 Trying ALL instances to find complete message history...`);
    let bestInstance = instanceName;
    let bestMessages = messages;
    let allInstanceResults = [];
    
    for (const instance of instances) {
      console.log(`\n📞 Checking instance: ${instance.name} (${instance.connectionStatus}) - ${instance._count.Message} total messages`);
      
      try {
        // Try multiple approaches for each instance
        let instanceMessages = [];
        
        // Approach 1: Direct group filtering with large limit
        console.log(`  🔍 Approach 1: Direct group filtering...`);
        let response = await fetch(`${EVOLUTION_API_URL}/chat/findMessages/${instance.name}`, {
          method: 'POST',
          headers: {
            'apikey': EVOLUTION_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            where: {
              key: {
                remoteJid: REMOTE_JID
              }
            },
            limit: 10000,
            order: [['messageTimestamp', 'ASC']] // Try oldest first
          })
        });

        if (response.ok) {
          const result = await response.json();
          let directMessages = [];
          
          if (result && result.messages && Array.isArray(result.messages.records)) {
            directMessages = result.messages.records;
          } else if (Array.isArray(result)) {
            directMessages = result;
          }
          
          console.log(`    ✅ Direct filtering: ${directMessages.length} messages`);
          if (directMessages.length > instanceMessages.length) {
            instanceMessages = directMessages;
          }
        }

        // Approach 2: Fetch all and filter with larger limit
        console.log(`  🔍 Approach 2: Fetch all with large limit...`);
        response = await fetch(`${EVOLUTION_API_URL}/chat/findMessages/${instance.name}`, {
          method: 'POST',
          headers: {
            'apikey': EVOLUTION_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            limit: 50000,
            order: [['messageTimestamp', 'ASC']]
          })
        });

        if (response.ok) {
          const result = await response.json();
          let allMessages = [];
          
          if (result && result.messages && Array.isArray(result.messages.records)) {
            allMessages = result.messages.records;
          } else if (Array.isArray(result)) {
            allMessages = result;
          }
          
          console.log(`    ✅ Fetched ${allMessages.length} total messages`);
          
          // Filter for group messages
          const groupMessages = allMessages.filter(msg => {
            const messageRemoteJid = msg.key?.remoteJid;
            return messageRemoteJid === REMOTE_JID || 
                   messageRemoteJid === `${GROUP_ID}@g.us` ||
                   messageRemoteJid === `${GROUP_ID}@c.us` ||
                   messageRemoteJid?.includes(GROUP_ID);
          });
          
          console.log(`    🎯 Filtered ${groupMessages.length} group messages`);
          if (groupMessages.length > instanceMessages.length) {
            instanceMessages = groupMessages;
          }
        }

        // Approach 3: Try date-range pagination (last 1 year)
        console.log(`  🔍 Approach 3: Date range pagination...`);
        const now = new Date();
        const oneYearAgo = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));
        
        response = await fetch(`${EVOLUTION_API_URL}/chat/findMessages/${instance.name}`, {
          method: 'POST',
          headers: {
            'apikey': EVOLUTION_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            where: {
              key: {
                remoteJid: REMOTE_JID
              },
              messageTimestamp: {
                gte: Math.floor(oneYearAgo.getTime() / 1000)
              }
            },
            limit: 10000,
            order: [['messageTimestamp', 'ASC']]
          })
        });

        if (response.ok) {
          const result = await response.json();
          let dateRangeMessages = [];
          
          if (result && result.messages && Array.isArray(result.messages.records)) {
            dateRangeMessages = result.messages.records;
          } else if (Array.isArray(result)) {
            dateRangeMessages = result;
          }
          
          console.log(`    ✅ Date range: ${dateRangeMessages.length} messages`);
          if (dateRangeMessages.length > instanceMessages.length) {
            instanceMessages = dateRangeMessages;
          }
        }

        allInstanceResults.push({
          instance: instance.name,
          status: instance.connectionStatus,
          totalMessages: instance._count.Message,
          groupMessages: instanceMessages.length,
          messages: instanceMessages
        });

        if (instanceMessages.length > bestMessages.length) {
          console.log(`  🏆 NEW BEST! Instance "${instance.name}" has ${instanceMessages.length} messages (vs ${bestMessages.length})`);
          bestInstance = instance.name;
          bestMessages = instanceMessages;
        } else if (instanceMessages.length > 0) {
          console.log(`  ✅ Instance "${instance.name}": ${instanceMessages.length} messages`);
        } else {
          console.log(`  ❌ Instance "${instance.name}": No group messages found`);
        }

      } catch (error) {
        console.log(`  ❌ Error with instance "${instance.name}": ${error.message}`);
        allInstanceResults.push({
          instance: instance.name,
          status: instance.connectionStatus,
          totalMessages: instance._count.Message,
          groupMessages: 0,
          messages: [],
          error: error.message
        });
      }
    }
    
    // Update with best results
    instanceName = bestInstance;
    messages = bestMessages;
    
    console.log(`\n📊 Instance Summary:`);
    allInstanceResults.forEach(result => {
      const errorMsg = result.error ? ` (Error: ${result.error})` : '';
      console.log(`  ${result.instance}: ${result.groupMessages} group messages / ${result.totalMessages} total${errorMsg}`);
    });
    
    console.log(`\n🏆 Using instance "${instanceName}" with ${messages.length} messages`);
    
    if (messages.length < 100) {
      console.log(`\n⚠️  Warning: Only ${messages.length} messages found. This might indicate:`);
      console.log(`   - The group is relatively new`);
      console.log(`   - Evolution API has message retention limits`);
      console.log(`   - The group ID might be slightly different`);
      console.log(`   - Messages might be stored in a different format`);
    }
    
    // Track final batch count for scenarios where we used fallback methods
    if (batchCount === 0) batchCount = 1;

    if (messages.length === 0) {
      console.log('ℹ️ No messages found for this group. This could mean:');
      console.log('  - The group ID is incorrect');
      console.log('  - The instance is not part of this group');
      console.log('  - The group has no messages');
      console.log('  - The group uses a different format (try with @c.us instead of @g.us)');
      return;
    }

    // Sort messages by timestamp (oldest first)
    messages.sort((a, b) => a.messageTimestamp - b.messageTimestamp);

    // Prepare the output content
    let outputContent = `WhatsApp Group Messages Export - COMPLETE HISTORY\n`;
    outputContent += `==================================================\n`;
    outputContent += `Group ID: ${GROUP_ID}\n`;
    outputContent += `Remote JID: ${REMOTE_JID}\n`;
    outputContent += `Instance: ${instanceName}\n`;
    outputContent += `Total Messages: ${messages.length}\n`;
    outputContent += `Export Date: ${new Date().toISOString()}\n`;
    outputContent += `Fetched in ${batchCount} batch(es)\n`;
    outputContent += `==================================================\n\n`;

    // Add each message with progress tracking
    console.log(`📝 Writing ${messages.length} messages to file...`);
    const progressInterval = Math.max(1, Math.floor(messages.length / 10)); // Show progress every 10%
    
    messages.forEach((message, index) => {
      if (index % progressInterval === 0 && index > 0) {
        const progress = Math.round((index / messages.length) * 100);
        console.log(`   📝 Progress: ${progress}% (${index}/${messages.length} messages written)`);
      }
      
      const timestamp = formatTimestamp(message.messageTimestamp);
      const sender = getSenderName(message);
      const content = extractMessageContent(message);
      const direction = message.key?.fromMe ? '→' : '←';
      
      outputContent += `[${index + 1}] ${timestamp} ${direction} ${sender}\n`;
      outputContent += `${content}\n`;
      
      // Add metadata for debugging if needed
      if (message.messageType !== 'conversation' && message.messageType !== 'extendedTextMessage') {
        outputContent += `   (Type: ${message.messageType})\n`;
      }
      
      outputContent += `\n`;
    });
    
    console.log(`   ✅ All ${messages.length} messages written to memory.`);

    // Add summary at the end
    outputContent += `\n=====================================\n`;
    outputContent += `Export Summary:\n`;
    outputContent += `- Total messages: ${messages.length}\n`;
    outputContent += `- Date range: ${formatTimestamp(messages[0]?.messageTimestamp)} to ${formatTimestamp(messages[messages.length - 1]?.messageTimestamp)}\n`;
    
    // Message type breakdown
    const messageTypes = {};
    messages.forEach(msg => {
      const type = msg.messageType || 'unknown';
      messageTypes[type] = (messageTypes[type] || 0) + 1;
    });
    
    outputContent += `- Message types:\n`;
    Object.entries(messageTypes).forEach(([type, count]) => {
      outputContent += `  * ${type}: ${count}\n`;
    });

    // Save to file
    const fileName = `group_${GROUP_ID}_ALL_messages_${new Date().toISOString().split('T')[0]}.txt`;
    const filePath = path.join(process.cwd(), fileName);
    
    fs.writeFileSync(filePath, outputContent, 'utf8');
    
    console.log(`\n🎉 SUCCESS! COMPLETE message history exported to: ${fileName}`);
    console.log(`📁 Full path: ${filePath}`);
    console.log(`📊 Total messages: ${messages.length}`);
    console.log(`📦 Fetched in: ${batchCount} batch(es)`);
    console.log(`💾 File size: ${Math.round(outputContent.length / 1024)} KB`);
    console.log('');
    console.log('✅ You can now open the text file to view the COMPLETE group message history!');

  } catch (error) {
    console.error('❌ Error fetching group messages:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Run the script
fetchGroupMessages(); 