#!/usr/bin/env node

/**
 * Comprehensive search for WhatsApp group messages using multiple formats and approaches
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const EVOLUTION_API_URL = process.env.VITE_EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.VITE_EVOLUTION_API_KEY;

// Group ID provided by user
const GROUP_ID = '120363410585796672';

const POSSIBLE_FORMATS = [
  `${GROUP_ID}@g.us`,        // Standard WhatsApp group format
  `${GROUP_ID}@c.us`,        // Contact format
  `${GROUP_ID}@s.whatsapp.net`, // Standard WhatsApp format
  `${GROUP_ID}`,             // Just the ID
  GROUP_ID                   // Plain group ID
];

async function searchAllFormats() {
  console.log('🔍 Comprehensive Group Message Search');
  console.log(`📱 Group ID: ${GROUP_ID}`);
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

  const instances = await instancesResponse.json();
  console.log(`✅ Found ${instances.length} instances`);
  
  let totalFound = 0;
  const results = [];
  
  for (const instance of instances) {
    console.log(`\n📞 Testing instance: ${instance.name} (${instance.connectionStatus}) - ${instance._count.Message} total messages`);
    
    for (const format of POSSIBLE_FORMATS) {
      console.log(`   🔍 Testing format: ${format}`);
      
      try {
        const response = await fetch(`${EVOLUTION_API_URL}/chat/findMessages/${instance.name}`, {
          method: 'POST',
          headers: {
            'apikey': EVOLUTION_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            where: {
              key: {
                remoteJid: format
              }
            },
            limit: 100
          })
        });

        if (response.ok) {
          const result = await response.json();
          let messages = [];
          
          if (result && result.messages && Array.isArray(result.messages.records)) {
            messages = result.messages.records;
          } else if (Array.isArray(result)) {
            messages = result;
          }
          
          if (messages.length > 0) {
            console.log(`     ✅ FOUND ${messages.length} messages!`);
            results.push({
              instance: instance.name,
              format: format,
              messageCount: messages.length,
              messages: messages
            });
            totalFound += messages.length;
          } else {
            console.log(`     ❌ No messages`);
          }
        } else {
          console.log(`     ❌ Error: ${response.status}`);
        }
        
        // Small delay to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`     ❌ Error: ${error.message}`);
      }
    }
  }
  
  console.log(`\n📊 SEARCH COMPLETE`);
  console.log(`🎯 Total messages found across all instances/formats: ${totalFound}`);
  
  if (results.length > 0) {
    console.log(`\n📋 Results Summary:`);
    results.forEach(result => {
      console.log(`  • ${result.instance} with format "${result.format}": ${result.messageCount} messages`);
    });
    
    // Check for unique messages across all results
    const allMessages = [];
    const uniqueIds = new Set();
    
    results.forEach(result => {
      result.messages.forEach(msg => {
        const msgId = msg.key?.id;
        if (msgId && !uniqueIds.has(msgId)) {
          uniqueIds.add(msgId);
          allMessages.push(msg);
        }
      });
    });
    
    console.log(`\n🔢 Unique messages (deduplicated): ${allMessages.length}`);
    
    if (allMessages.length > 0) {
      // Show date range
      const timestamps = allMessages.map(msg => msg.messageTimestamp).filter(Boolean).sort();
      if (timestamps.length > 0) {
        const oldest = new Date(timestamps[0] * 1000);
        const newest = new Date(timestamps[timestamps.length - 1] * 1000);
        console.log(`📅 Date range: ${oldest.toLocaleDateString()} to ${newest.toLocaleDateString()}`);
      }
    }
  } else {
    console.log(`\n❌ No messages found in any instance with any format`);
    console.log(`\nThis could mean:`);
    console.log(`  • The group ID is incorrect`);
    console.log(`  • The group exists but has no messages`);
    console.log(`  • The group is in a different Evolution API instance`);
    console.log(`  • The group uses a different identifier format`);
  }
  
  // Also try searching by content/participant
  console.log(`\n🔍 Trying alternative search approaches...`);
  
  for (const instance of instances) {
    console.log(`\n📞 Searching in instance: ${instance.name}`);
    
    try {
      // Try searching for messages that might contain the group ID
      const searchResponse = await fetch(`${EVOLUTION_API_URL}/chat/findMessages/${instance.name}`, {
        method: 'POST',
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          where: {},
          limit: 1000  // Get more messages to search through
        })
      });

      if (searchResponse.ok) {
        const searchResult = await searchResponse.json();
        let allInstanceMessages = [];
        
        if (searchResult && searchResult.messages && Array.isArray(searchResult.messages.records)) {
          allInstanceMessages = searchResult.messages.records;
        } else if (Array.isArray(searchResult)) {
          allInstanceMessages = searchResult;
        }
        
        console.log(`   📊 Searching through ${allInstanceMessages.length} messages...`);
        
        // Look for messages that might be related to our group
        const relatedMessages = allInstanceMessages.filter(msg => {
          const remoteJid = msg.key?.remoteJid || '';
          const participant = msg.key?.participant || '';
          return remoteJid.includes(GROUP_ID) || participant.includes(GROUP_ID);
        });
        
        if (relatedMessages.length > 0) {
          console.log(`   🎯 Found ${relatedMessages.length} potentially related messages`);
          relatedMessages.forEach(msg => {
            console.log(`     • ${msg.key?.remoteJid} (participant: ${msg.key?.participant})`);
          });
        } else {
          console.log(`   ❌ No related messages found`);
        }
        
        // Also check for group patterns
        const groupMessages = allInstanceMessages.filter(msg => {
          const remoteJid = msg.key?.remoteJid || '';
          return remoteJid.includes('@g.us');
        });
        
        console.log(`   📊 Instance has ${groupMessages.length} total group messages`);
        
        if (groupMessages.length > 0) {
          const uniqueGroups = [...new Set(groupMessages.map(msg => msg.key?.remoteJid))];
          console.log(`   📋 Unique groups in instance: ${uniqueGroups.length}`);
          console.log(`   📋 Group list:`);
          uniqueGroups.slice(0, 10).forEach(group => {
            console.log(`     • ${group}`);
          });
          if (uniqueGroups.length > 10) {
            console.log(`     ... and ${uniqueGroups.length - 10} more groups`);
          }
        }
        
      } else {
        console.log(`   ❌ Cannot search instance: ${searchResponse.status}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error searching instance: ${error.message}`);
    }
  }
}

searchAllFormats().catch(console.error); 