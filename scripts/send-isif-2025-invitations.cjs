#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const axios = require('axios');

// Configuration
const EVOLUTION_API_URL = 'https://evo.istn.ac.id';
const EVOLUTION_API_KEY = 'YGyPcZ5tn8RfmaATbP5ou9bOP4Usc7Pk4G0k04p9G7iNMpWqbNhga2FOl6T7ud26';
const INSTANCE_NAME = 'personal';
const CSV_FILE_PATH = 'Registrasi ISIF 2025 ISTN - 26 Juni 2025  (Responses) - Form Responses 1.csv';
const DELAY_BETWEEN_MESSAGES = 5000; // 5 seconds delay
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds
const API_TIMEOUT = 30000; // 30 seconds

// Message template
const MESSAGE_TEMPLATE = `Thank you for registering for the International Symposium & Innovation Forum 2025.
Your ticket is attached below. Please bring it with you and present it at the reception desk on the event day.
We look forward to welcoming you at ISTN Jakarta on June 26. See you soon.`;

// Create logs directory if it doesn't exist
const LOGS_DIR = 'logs';
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR);
}

// Setup logging
const LOG_FILE = path.join(LOGS_DIR, `isif_invitations_${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
function log(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type}] ${message}\n`;
  console.log(message);
  fs.appendFileSync(LOG_FILE, logMessage);
}

log('🎫 ISIF 2025 WhatsApp Invitation Sender');
log('=====================================');
log(`Using instance: ${INSTANCE_NAME}`);
log(`CSV file: ${CSV_FILE_PATH}`);
log(`Log file: ${LOG_FILE}`);
log('');

// Helper function for API calls with retry logic
async function makeApiCall(endpoint, method = 'GET', data = null, retries = MAX_RETRIES) {
  try {
    const config = {
      method,
      url: `${EVOLUTION_API_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      timeout: API_TIMEOUT
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    log(`API call failed: ${endpoint} - ${error.message}`, 'ERROR');
    
    if (retries > 0) {
      const delay = (MAX_RETRIES - retries + 1) * RETRY_DELAY;
      log(`Retrying in ${delay/1000} seconds... (${retries} attempts remaining)`, 'WARN');
      await new Promise(resolve => setTimeout(resolve, delay));
      return makeApiCall(endpoint, method, data, retries - 1);
    }
    
    throw error;
  }
}

// Clean phone number (remove spaces, dashes, etc.)
function cleanPhoneNumber(phone) {
  if (!phone) return '';
  
  // Remove all non-numeric characters
  let cleaned = phone.replace(/[^\d]/g, '');
  
  // If it starts with 0, replace with 62 (Indonesia country code)
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  }
  
  // If it doesn't start with 62, add it
  if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }
  
  log(`📱 Original number: ${phone} -> Cleaned: ${cleaned}`, 'INFO');
  return cleaned;
}

// Helper function to check instance status
async function checkInstanceStatus() {
  try {
    log('🔍 Checking WhatsApp instance status...', 'INFO');
    const response = await makeApiCall(`/instance/connectionState/${INSTANCE_NAME}`, 'GET');
    
    if (response && response.instance && response.instance.state === 'open') {
      log('✅ WhatsApp instance is connected and ready', 'SUCCESS');
      return true;
    } else {
      throw new Error(`Instance not ready. Status: ${JSON.stringify(response)}`);
    }
  } catch (error) {
    throw new Error(`Failed to check instance status: ${error.message}`);
  }
}

// Send message with PDF URL using correct Evolution API format
async function sendMessageWithPdf(phoneNumber, message, pdfUrl, name) {
  try {
    const cleanedPhone = cleanPhoneNumber(phoneNumber);
    if (!cleanedPhone) {
      throw new Error('Invalid phone number');
    }

    log(`📤 Sending PDF to ${name} (${cleanedPhone})...`, 'INFO');
    log(`📥 Using PDF URL: ${pdfUrl}`, 'INFO');

    // Simpler media message format
    const messageData = {
      number: cleanedPhone,
      mediaMessage: {
        mediatype: "document",
        media: pdfUrl,
        caption: message
      }
    };

    const result = await makeApiCall(`/message/media/${INSTANCE_NAME}`, 'POST', messageData);
    
    if (result && !result.error) {
      log(`✅ PDF sent successfully to ${name}`, 'SUCCESS');
      return { success: true };
    } else {
      throw new Error(JSON.stringify(result));
    }
  } catch (error) {
    log(`❌ Failed to send to ${name}: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
}

// Read CSV and process registrations with proper header handling
async function processRegistrations() {
  return new Promise((resolve, reject) => {
    const registrations = [];
    let lineCount = 0;
    let headerProcessed = false;
    
    // Read raw lines to handle multi-line headers
    const lines = fs.readFileSync(CSV_FILE_PATH, 'utf8').split('\n');
    
    // Find the actual header line (the one that contains PDF pass link and WA Sent Status)
    let headerLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Look for line that contains PDF pass link and WA Sent Status (this is the actual column header line)
      if (line.includes('[PDF pass link]') && line.includes('WA Sent Status')) {
        headerLineIndex = i;
        break;
      }
    }
    
    if (headerLineIndex === -1) {
      reject(new Error('Could not find header line in CSV'));
      return;
    }
    
    log(`📋 Found header at line ${headerLineIndex + 1}`, 'INFO');
    
    // Parse the header to understand column positions
    const headerLine = lines[headerLineIndex];
    const headers = headerLine.split(',').map(h => h.trim());
    
    log('📊 CSV Headers:', 'INFO');
    log(JSON.stringify(headers, null, 2), 'INFO');
    
    // Find column indices in the header line
    const pdfIndex = headers.findIndex(h => h.includes('[PDF pass link]'));
    const statusIndex = headers.findIndex(h => h.includes('WA Sent Status'));
    
    log(`📍 Column positions - PDF: ${pdfIndex}, Status: ${statusIndex}`, 'INFO');
    log(`📍 Total header columns: ${headers.length}`, 'INFO');
    
    // The actual column positions based on data structure
    const actualPdfIndex = 10;
    const actualStatusIndex = 13;
    
    log(`📍 Using actual column positions - PDF: ${actualPdfIndex}, Status: ${actualStatusIndex}`, 'INFO');
    
    // Process data lines (starting from headerLineIndex + 1)
    for (let i = headerLineIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Split by comma but handle quoted fields
      const columns = [];
      let current = '';
      let inQuotes = false;
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          columns.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      columns.push(current.trim());
      
      // Skip if doesn't have enough columns
      if (columns.length < Math.max(actualPdfIndex, actualStatusIndex) + 1) {
        log(`⚠️  Skipping line ${i + 1}: insufficient columns (${columns.length})`, 'WARN');
        continue;
      }
      
      // Parse registration data
      const timestamp = columns[0]?.trim();
      const name = columns[1]?.trim();
      const phone = columns[2]?.trim(); 
      const email = columns[3]?.trim();
      const institution = columns[4]?.trim();
      const trackingCode = columns[9]?.trim();
      const pdfLink = columns[actualPdfIndex]?.trim();
      const waStatus = columns[actualStatusIndex]?.trim() || 'NOT_SENT';
      
      // Only process if we have required data and it looks like real data
      if (name && phone && pdfLink && timestamp && timestamp.includes('/')) {
        registrations.push({
          timestamp: timestamp,
          name: name,
          phone: phone,
          email: email || '',
          institution: institution || '',
          pdfLink: pdfLink,
          trackingCode: trackingCode || '',
          waStatus: waStatus,
          rawLine: line
        });
        
        log(`✅ Added: ${name} - ${phone} - PDF: ${pdfLink.substring(0, 50)}...`, 'INFO');
      } else {
        log(`⚠️  Skipping: ${name || 'no name'} - missing required data`, 'WARN');
      }
    }
    
    log(`📊 Found ${registrations.length} registrations to process`, 'INFO');
    resolve(registrations);
  });
}

// Update CSV with new status
async function updateCsvStatus(registrations) {
  try {
    log('💾 Updating CSV file...', 'INFO');
    
    // Read the entire file
    const fileContent = fs.readFileSync(CSV_FILE_PATH, 'utf8');
    let updatedContent = fileContent;
    
    // For each registration, find and update its status
    registrations.forEach(reg => {
      if (reg.rawLine && reg.waStatus !== 'NOT_SENT') {
        // Replace the old status with new status in the raw line
        const oldStatus = reg.rawLine.split(',').pop().trim();
        const newLine = reg.rawLine.replace(new RegExp(oldStatus + '$'), reg.waStatus);
        updatedContent = updatedContent.replace(reg.rawLine, newLine);
      }
    });
    
    // Write back to file
    fs.writeFileSync(CSV_FILE_PATH, updatedContent);
    log('✅ CSV file updated successfully', 'SUCCESS');
    
  } catch (error) {
    log(`❌ Error updating CSV: ${error.message}`, 'ERROR');
    throw error;
  }
}

// Send a test text message first
async function sendTestMessage(phoneNumber, name) {
  try {
    const cleanedPhone = cleanPhoneNumber(phoneNumber);
    if (!cleanedPhone) {
      throw new Error('Invalid phone number');
    }

    log(`📤 Sending test message to ${name} (${cleanedPhone})...`, 'INFO');
    
    // Simpler message format based on Evolution API docs
    const messageData = {
      number: cleanedPhone,
      text: "Test message from ISIF 2025 registration system. Your PDF ticket will be sent shortly."
    };

    // Try sending using the text message endpoint
    const result = await makeApiCall(`/message/text/${INSTANCE_NAME}`, 'POST', messageData);
    
    if (result && !result.error) {
      log(`✅ Test message sent successfully to ${name}`, 'SUCCESS');
      return true;
    } else {
      log(`❌ Failed to send test message to ${name}: ${JSON.stringify(result)}`, 'ERROR');
      return false;
    }
  } catch (error) {
    log(`❌ Error sending test message to ${name}: ${error.message}`, 'ERROR');
    return false;
  }
}

// Main execution
async function main() {
  try {
    // Check instance status first
    await checkInstanceStatus();
    
    // Process registrations
    const registrations = await processRegistrations();
    
    // Send messages
    let successCount = 0;
    let failureCount = 0;
    
    for (const reg of registrations) {
      // Skip Kuncoro Atmojo as requested
      if (reg.name.toLowerCase().includes('kuncoro')) {
        log(`⏭️  Skipping ${reg.name} as requested`, 'INFO');
        continue;
      }

      if (reg.waStatus === 'SENT') {
        log(`⏭️  Skipping ${reg.name}: already sent`, 'INFO');
        continue;
      }

      // Try sending a test message first
      const testSuccess = await sendTestMessage(reg.phone, reg.name);
      if (!testSuccess) {
        log(`⚠️  Skipping PDF send for ${reg.name} due to test message failure`, 'WARN');
        reg.waStatus = 'FAILED_TEST';
        failureCount++;
        continue;
      }

      // Wait before sending the PDF
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_MESSAGES));
      
      const result = await sendMessageWithPdf(reg.phone, MESSAGE_TEMPLATE, reg.pdfLink, reg.name);
      
      if (result.success) {
        reg.waStatus = 'SENT';
        successCount++;
      } else {
        reg.waStatus = 'FAILED';
        failureCount++;
      }
      
      // Update CSV after each message
      await updateCsvStatus(registrations);
      
      // Delay between messages
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_MESSAGES));
    }
    
    // Final summary
    log('\n📊 Final Summary', 'INFO');
    log(`Total processed: ${registrations.length}`, 'INFO');
    log(`Successfully sent: ${successCount}`, 'SUCCESS');
    log(`Failed: ${failureCount}`, 'ERROR');
    
  } catch (error) {
    log(`❌ Fatal error: ${error.message}`, 'ERROR');
    process.exit(1);
  }
}

// Run the script
main();

module.exports = {
  processRegistrations,
  sendMessageWithPdf,
  updateCsvStatus,
  main
}; 