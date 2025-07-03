#!/usr/bin/env node

/**
 * Enhanced script to fetch ALL messages from Evolution API for a specific group
 * using proper pagination to overcome the 50-message limit
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
  console.error('\nPlease check your .env file.');
  process.exit(1);
}

// Utility functions
function formatTimestamp(timestamp) {
  if (!timestamp) return 'Unknown time';
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

function getSenderName(message) {
  if (message.key?.fromMe) {
    return 'Me (Bot/Instance)';
  }
  
  if (message.pushName) {
    return message.pushName;
  }
  
  if (message.key?.participant) {
    return message.key.participant.replace('@s.whatsapp.net', '');
  }
  
  if (message.key?.remoteJid) {
    return message.key.remoteJid.replace('@s.whatsapp.net', '');
  }
  
  return 'Unknown';
}

function extractMessageContent(message) {
  // Handle different message types
  if (message.message?.conversation) {
    return message.message.conversation;
  }
  
  if (message.message?.extendedTextMessage?.text) {
    return message.message.extendedTextMessage.text;
  }
  
  if (message.message?.imageMessage) {
    const caption = message.message.imageMessage.caption || '';
    return caption ? `[IMAGE] ${caption}` : '[IMAGEMESSAGE]';
  }
  
  if (message.message?.videoMessage) {
    const caption = message.message.videoMessage.caption || '';
    return caption ? `[VIDEO] ${caption}` : '[VIDEOMESSAGE]';
  }
  
  if (message.message?.documentMessage) {
    const fileName = message.message.documentMessage.fileName || 'Unknown file';
    const caption = message.message.documentMessage.caption || '';
    return caption ? `[DOCUMENT: ${fileName}] ${caption}` : `[DOCUMENT: ${fileName}]`;
  }
  
  if (message.message?.documentWithCaptionMessage) {
    return '[DOCUMENTWITHCAPTIONMESSAGE]';
  }
  
  if (message.message?.audioMessage) {
    return '[AUDIOMESSAGE]';
  }
  
  if (message.message?.stickerMessage) {
    return '[STICKER]';
  }
  
  if (message.message?.locationMessage) {
    return '[LOCATION]';
  }
  
  if (message.message?.contactMessage) {
    return '[CONTACT]';
  }
  
  // For any unhandled message types, try to extract text content
  const messageText = JSON.stringify(message.message);
  if (messageText.length > 100) {
    return '[COMPLEX_MESSAGE]';
  }
  
  return '[UNKNOWN_MESSAGE_TYPE]';
}

/**
 * Fetch ALL messages using proper pagination
 */
async function fetchAllGroupMessagesWithPagination(instanceName) {
  console.log(`📨 Fetching ALL messages for group ${GROUP_ID} using pagination...`);
  console.log(`🔄 This may take several minutes for groups with thousands of messages...`);
  
  let allMessages = [];
  let page = 0;
  const limit = 50; // Use the API's maximum limit
  let hasMoreMessages = true;
  let totalRequests = 0;
  const maxRequests = 200; // Safety limit to prevent infinite loops
  
  while (hasMoreMessages && totalRequests < maxRequests) {
    totalRequests++;
    const offset = page * limit;
    
    console.log(`📦 Request ${totalRequests}: Page ${page + 1} (offset: ${offset}, limit: ${limit})`);
    
    try {
      const response = await fetch(`${EVOLUTION_API_URL}/chat/findMessages/${instanceName}`, {
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
          limit: limit,
          offset: offset,
          order: [['messageTimestamp', 'DESC']] // Most recent first
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Request ${totalRequests} failed: ${response.status} ${response.statusText}`);
        console.error(`Error details: ${errorText}`);
        
        // If it's the first request, this is a real error
        if (totalRequests === 1) {
          throw new Error(`Failed to fetch messages: ${response.status} ${response.statusText}`);
        } else {
          // If subsequent requests fail, we might have reached the end
          console.log(`⚠️ Stopping pagination at request ${totalRequests} due to error.`);
          hasMoreMessages = false;
          break;
        }
      }

      const result = await response.json();
      let pageMessages = [];
      
      // Handle different response formats
      if (result && result.messages && Array.isArray(result.messages.records)) {
        pageMessages = result.messages.records;
      } else if (Array.isArray(result)) {
        pageMessages = result;
      } else {
        console.log(`📊 Unexpected response structure at request ${totalRequests}:`, JSON.stringify(result, null, 2));
        hasMoreMessages = false;
        break;
      }

      console.log(`   ✅ Request ${totalRequests}: ${pageMessages.length} messages (total so far: ${allMessages.length + pageMessages.length})`);

      if (pageMessages.length === 0) {
        console.log(`📭 No messages returned at offset ${offset}. Reached end of data.`);
        hasMoreMessages = false;
      } else {
        // Check for duplicates (sometimes pagination can overlap)
        const newMessages = pageMessages.filter(msg => {
          const msgId = msg.key?.id;
          return !allMessages.some(existing => existing.key?.id === msgId);
        });
        
        if (newMessages.length === 0) {
          console.log(`📭 No new messages found (all duplicates). Reached end of unique data.`);
          hasMoreMessages = false;
        } else {
          allMessages = allMessages.concat(newMessages);
          console.log(`   📈 Added ${newMessages.length} new messages (${pageMessages.length - newMessages.length} duplicates)`);
          
          // If we got less than the limit, we've reached the end
          if (pageMessages.length < limit) {
            console.log(`📭 Received ${pageMessages.length} < ${limit}, reached end of pagination.`);
            hasMoreMessages = false;
          }
        }
      }
      
      page++;
      
      // Add a small delay between requests to be respectful to the API
      if (hasMoreMessages) {
        await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
      }
      
    } catch (error) {
      console.error(`❌ Error during request ${totalRequests}:`, error.message);
      if (totalRequests === 1) {
        throw error; // Fail if the first request fails
      } else {
        console.log(`⚠️ Continuing with ${allMessages.length} messages collected so far.`);
        hasMoreMessages = false;
      }
    }
  }
  
  if (totalRequests >= maxRequests) {
    console.log(`⚠️ Reached maximum request limit (${maxRequests}). Consider increasing if needed.`);
  }
  
  console.log(`\n🎉 Pagination complete!`);
  console.log(`📊 Total API requests made: ${totalRequests}`);
  console.log(`📊 Total unique messages collected: ${allMessages.length}`);
  
  return allMessages;
}

async function fetchGroupMessages() {
  try {
    console.log('🔍 Starting comprehensive group message extraction...');
    console.log(`📱 Group ID: ${GROUP_ID}`);
    console.log(`🆔 Remote JID: ${REMOTE_JID}`);
    console.log(`🌐 API URL: ${EVOLUTION_API_URL}`);
    console.log('');
    
    // Get available instances
    const instancesResponse = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!instancesResponse.ok) {
      throw new Error(`Failed to fetch instances: ${instancesResponse.status}`);
    }

    const instances = await instancesResponse.json();
    console.log(`✅ Found ${instances.length} instances`);
    
    // Find best instance (prefer open/connected ones)
    const connectedInstance = instances.find(inst => 
      inst.connectionStatus === 'open' || inst.connectionStatus === 'CONNECTED'
    );
    
    const instanceName = connectedInstance ? connectedInstance.name : instances[0].name;
    console.log(`🏆 Using instance: ${instanceName} (${connectedInstance ? connectedInstance.connectionStatus : instances[0].connectionStatus})`);
    
    // Fetch ALL messages using pagination
    const messages = await fetchAllGroupMessagesWithPagination(instanceName);
    
    if (messages.length === 0) {
      console.log('ℹ️ No messages found for this group. Trying other instances...');
      
      // Try other instances if the first one didn't work
      for (const instance of instances) {
        if (instance.name === instanceName) continue;
        
        console.log(`🔄 Trying instance: ${instance.name}`);
        const altMessages = await fetchAllGroupMessagesWithPagination(instance.name);
        
        if (altMessages.length > 0) {
          console.log(`✅ Found ${altMessages.length} messages in instance: ${instance.name}`);
          messages.push(...altMessages);
          break;
        }
      }
    }
    
    if (messages.length === 0) {
      console.log('❌ No messages found in any instance for this group.');
      return;
    }
    
    // Sort messages by timestamp (oldest first for proper chronological order)
    console.log(`\n📅 Sorting ${messages.length} messages chronologically...`);
    messages.sort((a, b) => a.messageTimestamp - b.messageTimestamp);
    
    // Save to file
    const fileName = `group_${GROUP_ID}_COMPLETE_${messages.length}_messages_${new Date().toISOString().split('T')[0]}.txt`;
    const filePath = path.join(process.cwd(), fileName);
    
    // Prepare the output content
    let outputContent = `WhatsApp Group Messages Export - COMPLETE HISTORY (${messages.length} MESSAGES)\n`;
    outputContent += `===================================================================================\n`;
    outputContent += `Group ID: ${GROUP_ID}\n`;
    outputContent += `Remote JID: ${REMOTE_JID}\n`;
    outputContent += `Instance: ${instanceName}\n`;
    outputContent += `Total Messages: ${messages.length}\n`;
    outputContent += `Export Date: ${new Date().toISOString()}\n`;
    outputContent += `Date Range: ${formatTimestamp(messages[0].messageTimestamp)} to ${formatTimestamp(messages[messages.length - 1].messageTimestamp)}\n`;
    outputContent += `===================================================================================\n\n`;

    // Add each message
    console.log(`📝 Writing ${messages.length} messages to file...`);
    
    messages.forEach((message, index) => {
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

    // Add summary at the end
    const messageTypes = {};
    messages.forEach(msg => {
      const type = msg.messageType || 'unknown';
      messageTypes[type] = (messageTypes[type] || 0) + 1;
    });

    outputContent += `\n===================================================================================\n`;
    outputContent += `Export Summary:\n`;
    outputContent += `- Total messages: ${messages.length}\n`;
    outputContent += `- Date range: ${formatTimestamp(messages[0].messageTimestamp)} to ${formatTimestamp(messages[messages.length - 1].messageTimestamp)}\n`;
    outputContent += `- Message types:\n`;
    Object.entries(messageTypes).forEach(([type, count]) => {
      outputContent += `  * ${type}: ${count}\n`;
    });

    // Write to file
    console.log(`💾 Saving to file: ${fileName}...`);
    fs.writeFileSync(filePath, outputContent, 'utf8');
    
    console.log(`\n🎉 SUCCESS! COMPLETE message history exported!`);
    console.log(`📁 File: ${fileName}`);
    console.log(`📁 Full path: ${filePath}`);
    console.log(`📊 Total messages: ${messages.length}`);
    console.log(`💾 File size: ${Math.round(outputContent.length / 1024)} KB`);
    console.log('');
    
    if (messages.length >= 1000) {
      console.log('🎉 SUCCESS! Found thousands of messages as expected!');
    } else if (messages.length >= 100) {
      console.log('✅ Found hundreds of messages - good result!');
    } else {
      console.log('⚠️ Found fewer than 100 messages. This might indicate the group is relatively new or has limited activity.');
    }
    
    console.log('✅ You can now open the text file to view the COMPLETE group message history!');

  } catch (error) {
    console.error('❌ Error fetching group messages:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

fetchGroupMessages(); 