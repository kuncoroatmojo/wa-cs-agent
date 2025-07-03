#!/usr/bin/env node

/**
 * FINAL COMPREHENSIVE script to fetch ALL unique messages from Evolution API 
 * by merging data from all instances that contain the target group
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
const REMOTE_JID = `${GROUP_ID}@g.us`;

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
 * Fetch messages from a specific instance with pagination
 */
async function fetchMessagesFromInstance(instanceName) {
  console.log(`📨 Fetching messages from instance: ${instanceName}`);
  
  let allMessages = [];
  let page = 0;
  const limit = 50;
  let hasMoreMessages = true;
  let requestCount = 0;
  const maxRequests = 20; // Safety limit per instance
  
  while (hasMoreMessages && requestCount < maxRequests) {
    requestCount++;
    const offset = page * limit;
    
    console.log(`   📦 Request ${requestCount}: offset ${offset}, limit ${limit}`);
    
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
          order: [['messageTimestamp', 'DESC']]
        })
      });

      if (!response.ok) {
        if (requestCount === 1) {
          console.log(`   ❌ Instance ${instanceName} cannot access group: ${response.status}`);
          break;
        } else {
          console.log(`   ⚠️ Pagination ended at request ${requestCount}: ${response.status}`);
          hasMoreMessages = false;
          break;
        }
      }

      const result = await response.json();
      let pageMessages = [];
      
      if (result && result.messages && Array.isArray(result.messages.records)) {
        pageMessages = result.messages.records;
      } else if (Array.isArray(result)) {
        pageMessages = result;
      }

      console.log(`   ✅ Request ${requestCount}: ${pageMessages.length} messages`);

      if (pageMessages.length === 0) {
        hasMoreMessages = false;
      } else {
        // Check for duplicates within this instance
        const newMessages = pageMessages.filter(msg => {
          const msgId = msg.key?.id;
          return !allMessages.some(existing => existing.key?.id === msgId);
        });
        
        if (newMessages.length === 0) {
          console.log(`   📭 All messages are duplicates, pagination complete for ${instanceName}`);
          hasMoreMessages = false;
        } else {
          allMessages = allMessages.concat(newMessages);
          
          if (pageMessages.length < limit) {
            hasMoreMessages = false;
          }
        }
      }
      
      page++;
      
      // Small delay between requests
      if (hasMoreMessages) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
    } catch (error) {
      console.log(`   ❌ Error in ${instanceName} request ${requestCount}: ${error.message}`);
      if (requestCount === 1) {
        break; // Can't access this instance
      } else {
        hasMoreMessages = false; // End pagination for this instance
      }
    }
  }
  
  console.log(`   🏁 Instance ${instanceName}: ${allMessages.length} unique messages collected`);
  return allMessages;
}

async function fetchCompleteGroupHistory() {
  try {
    console.log('🚀 FINAL COMPREHENSIVE GROUP MESSAGE EXTRACTION');
    console.log(`📱 Group ID: ${GROUP_ID}`);
    console.log(`🆔 Remote JID: ${REMOTE_JID}`);
    console.log(`🌐 API URL: ${EVOLUTION_API_URL}`);
    console.log('');
    console.log('🎯 Strategy: Merge unique messages from ALL instances');
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
    
    // Track results from each instance
    const instanceResults = [];
    let totalMessagesFromAllInstances = 0;
    
    // Fetch messages from each instance
    for (const instance of instances) {
      console.log(`\n📞 Processing instance: ${instance.name} (${instance.connectionStatus}) - ${instance._count.Message} total messages`);
      
      const instanceMessages = await fetchMessagesFromInstance(instance.name);
      
      instanceResults.push({
        name: instance.name,
        status: instance.connectionStatus,
        totalMessages: instance._count.Message,
        groupMessages: instanceMessages,
        groupMessageCount: instanceMessages.length
      });
      
      totalMessagesFromAllInstances += instanceMessages.length;
      
      if (instanceMessages.length > 0) {
        console.log(`   ✅ ${instance.name}: Successfully collected ${instanceMessages.length} messages`);
      } else {
        console.log(`   ❌ ${instance.name}: No group messages found`);
      }
    }
    
    console.log(`\n📊 Collection Summary:`);
    instanceResults.forEach(result => {
      console.log(`  • ${result.name} (${result.status}): ${result.groupMessageCount} messages`);
    });
    console.log(`🔢 Total messages before deduplication: ${totalMessagesFromAllInstances}`);
    
    // Merge and deduplicate all messages
    console.log(`\n🔄 Merging and deduplicating messages from all instances...`);
    const allMessages = [];
    const uniqueIds = new Set();
    const duplicateCount = {};
    
    instanceResults.forEach(result => {
      result.groupMessages.forEach(msg => {
        const msgId = msg.key?.id;
        if (msgId) {
          if (!uniqueIds.has(msgId)) {
            uniqueIds.add(msgId);
            allMessages.push({
              ...msg,
              sourceInstance: result.name  // Track which instance this message came from
            });
          } else {
            // Count duplicates per instance
            duplicateCount[result.name] = (duplicateCount[result.name] || 0) + 1;
          }
        }
      });
    });
    
    console.log(`✅ Deduplication complete!`);
    console.log(`🔢 Unique messages: ${allMessages.length}`);
    console.log(`🔄 Duplicates removed: ${totalMessagesFromAllInstances - allMessages.length}`);
    
    if (Object.keys(duplicateCount).length > 0) {
      console.log(`📋 Duplicate breakdown:`);
      Object.entries(duplicateCount).forEach(([instance, count]) => {
        console.log(`  • ${instance}: ${count} duplicates`);
      });
    }
    
    if (allMessages.length === 0) {
      console.log('❌ No messages found in any instance for this group.');
      console.log('This could indicate the group ID is incorrect or the group has no messages.');
      return;
    }
    
    // Sort messages chronologically (oldest first)
    console.log(`\n📅 Sorting ${allMessages.length} messages chronologically...`);
    allMessages.sort((a, b) => a.messageTimestamp - b.messageTimestamp);
    
    // Show date range
    if (allMessages.length > 0) {
      const oldest = formatTimestamp(allMessages[0].messageTimestamp);
      const newest = formatTimestamp(allMessages[allMessages.length - 1].messageTimestamp);
      console.log(`📅 Complete date range: ${oldest} → ${newest}`);
    }
    
    // Save to file
    const fileName = `group_${GROUP_ID}_ULTIMATE_${allMessages.length}_messages_${new Date().toISOString().split('T')[0]}.txt`;
    const filePath = path.join(process.cwd(), fileName);
    
    // Prepare the output content
    let outputContent = `WhatsApp Group Messages Export - ULTIMATE COMPLETE HISTORY\n`;
    outputContent += `================================================================\n`;
    outputContent += `Group ID: ${GROUP_ID}\n`;
    outputContent += `Remote JID: ${REMOTE_JID}\n`;
    outputContent += `Total Messages: ${allMessages.length} (merged from ${instances.length} instances)\n`;
    outputContent += `Date Range: ${formatTimestamp(allMessages[0].messageTimestamp)} → ${formatTimestamp(allMessages[allMessages.length - 1].messageTimestamp)}\n`;
    outputContent += `Export Date: ${new Date().toISOString()}\n`;
    outputContent += `\nInstance Sources:\n`;
    instanceResults.forEach(result => {
      if (result.groupMessageCount > 0) {
        outputContent += `  • ${result.name}: ${result.groupMessageCount} messages (${duplicateCount[result.name] || 0} duplicates removed)\n`;
      }
    });
    outputContent += `================================================================\n\n`;

    // Add each message
    console.log(`📝 Writing ${allMessages.length} messages to file...`);
    const progressInterval = Math.max(1, Math.floor(allMessages.length / 10));
    
    allMessages.forEach((message, index) => {
      if (index % progressInterval === 0 && index > 0) {
        const progress = Math.round((index / allMessages.length) * 100);
        console.log(`   📝 Progress: ${progress}% (${index}/${allMessages.length})`);
      }
      
      const timestamp = formatTimestamp(message.messageTimestamp);
      const sender = getSenderName(message);
      const content = extractMessageContent(message);
      const direction = message.key?.fromMe ? '→' : '←';
      const source = message.sourceInstance;
      
      outputContent += `[${index + 1}] ${timestamp} ${direction} ${sender}\n`;
      outputContent += `${content}\n`;
      
      // Add metadata
      if (message.messageType && message.messageType !== 'conversation' && message.messageType !== 'extendedTextMessage') {
        outputContent += `   (Type: ${message.messageType})\n`;
      }
      outputContent += `   (Source: ${source})\n`;
      
      outputContent += `\n`;
    });

    // Add summary at the end
    const messageTypes = {};
    const sourceStats = {};
    allMessages.forEach(msg => {
      const type = msg.messageType || 'unknown';
      messageTypes[type] = (messageTypes[type] || 0) + 1;
      
      const source = msg.sourceInstance;
      sourceStats[source] = (sourceStats[source] || 0) + 1;
    });

    outputContent += `\n================================================================\n`;
    outputContent += `ULTIMATE EXPORT SUMMARY\n`;
    outputContent += `================================================================\n`;
    outputContent += `Total unique messages: ${allMessages.length}\n`;
    outputContent += `Date span: ${formatTimestamp(allMessages[0].messageTimestamp)} → ${formatTimestamp(allMessages[allMessages.length - 1].messageTimestamp)}\n`;
    outputContent += `\nMessage types:\n`;
    Object.entries(messageTypes).forEach(([type, count]) => {
      outputContent += `  • ${type}: ${count}\n`;
    });
    outputContent += `\nSource instance distribution:\n`;
    Object.entries(sourceStats).forEach(([source, count]) => {
      outputContent += `  • ${source}: ${count} messages\n`;
    });
    outputContent += `\nDeduplication summary:\n`;
    outputContent += `  • Total messages fetched: ${totalMessagesFromAllInstances}\n`;
    outputContent += `  • Unique messages: ${allMessages.length}\n`;
    outputContent += `  • Duplicates removed: ${totalMessagesFromAllInstances - allMessages.length}\n`;

    // Write to file
    console.log(`💾 Saving to file: ${fileName}...`);
    fs.writeFileSync(filePath, outputContent, 'utf8');
    
    console.log(`\n🎉 ULTIMATE SUCCESS! Complete group history exported!`);
    console.log(`📁 File: ${fileName}`);
    console.log(`📁 Path: ${filePath}`);
    console.log(`📊 Final count: ${allMessages.length} unique messages`);
    console.log(`📅 Date range: ${formatTimestamp(allMessages[0].messageTimestamp)} → ${formatTimestamp(allMessages[allMessages.length - 1].messageTimestamp)}`);
    console.log(`💾 File size: ${Math.round(outputContent.length / 1024)} KB`);
    console.log('');
    
    console.log('🏆 MISSION ACCOMPLISHED! You now have the COMPLETE message history!');
    console.log(`✅ Found ${allMessages.length} unique messages across all Evolution API instances!`);

  } catch (error) {
    console.error('❌ Error in comprehensive group extraction:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

fetchCompleteGroupHistory(); 