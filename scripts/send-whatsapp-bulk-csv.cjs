#!/usr/bin/env node

/**
 * Bulk WhatsApp Message Sender for ISIF 2025 Registration
 * Reads CSV file and sends WhatsApp messages with PDF attachments via Evolution API
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const axios = require('axios');
require('dotenv').config({ path: '.env.local' }); // Explicitly load .env.local

// Configuration
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || process.env.VITE_EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || process.env.VITE_EVOLUTION_API_KEY;
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'personal'; // Change this to your instance name

const MESSAGE = `Thank you for registering for the International Symposium & Innovation Forum 2025.
Your ticket is attached below. Please bring it with you and present it at the reception desk on the event day.
We look forward to welcoming you at ISTN Jakarta on June 26. See you soon.`;

// Validate environment variables
if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('  - EVOLUTION_API_URL or VITE_EVOLUTION_API_URL');
  console.error('  - EVOLUTION_API_KEY or VITE_EVOLUTION_API_KEY');
  console.error('  - EVOLUTION_INSTANCE_NAME (optional, defaults to "personal")');
  process.exit(1);
}

console.log('🚀 Evolution API Configuration:');
console.log(`  - URL: ${EVOLUTION_API_URL}`);
console.log(`  - API Key: ${EVOLUTION_API_KEY.substring(0, 8)}...`);
console.log(`  - Instance: ${INSTANCE_NAME}`);

/**
 * Normalize phone number to international format
 */
function normalizePhone(rawPhone) {
  if (!rawPhone) return '';
  
  let phone = String(rawPhone).replace(/[^0-9]/g, ''); // Remove non-digits
  
  // Handle Indonesian phone numbers
  if (phone.startsWith('0')) {
    phone = '62' + phone.slice(1); // Remove leading 0 and add +62
  } else if (phone.startsWith('8')) {
    phone = '62' + phone; // Add +62 for numbers starting with 8
  } else if (!phone.startsWith('62')) {
    phone = '62' + phone; // Add +62 for any other format
  }
  
  return phone;
}

/**
 * Send WhatsApp message with PDF attachment via Evolution API
 */
async function sendWhatsAppMessage(phone, message, pdfUrl) {
  try {
    const url = `${EVOLUTION_API_URL}/message/sendMedia/${INSTANCE_NAME}`;
    
    const payload = {
      number: phone,
      mediaMessage: {
        mediatype: 'document',
        media: pdfUrl,
        fileName: 'ISIF_2025_Ticket.pdf',
        caption: message
      }
    };

    console.log(`📤 Sending request to: ${url}`);
    console.log(`📤 Payload:`, JSON.stringify(payload, null, 2));

    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
      },
      timeout: 30000 // 30 second timeout
    });

    console.log(`✅ Sent to ${phone}: ${response.status} - ${JSON.stringify(response.data)}`);
    return { success: true, response: response.data };
    
  } catch (error) {
    console.error(`❌ Failed to send to ${phone}:`, error.response?.data || error.message);
    return { 
      success: false, 
      error: error.response?.data || error.message 
    };
  }
}

/**
 * Update CSV file with sent status
 */
function updateCsvStatus(csvFilePath, results) {
  try {
    const csvData = fs.readFileSync(csvFilePath, 'utf8');
    const lines = csvData.split('\n');
    
    // Find the WA Sent Status column index
    const headerLine = lines[0];
    const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, ''));
    const statusColIndex = headers.indexOf('WA Sent Status');
    
    if (statusColIndex === -1) {
      console.warn('⚠️  WA Sent Status column not found, cannot update CSV');
      return;
    }
    
    // Update each line with results
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue; // Skip empty lines
      
      const result = results[i - 1];
      if (result) {
        const columns = lines[i].split(',');
        
        // Ensure we have enough columns
        while (columns.length <= statusColIndex) {
          columns.push('');
        }
        
        columns[statusColIndex] = result.success ? 'SENT' : 'FAILED';
        lines[i] = columns.join(',');
      }
    }
    
    // Write updated CSV
    const updatedCsv = lines.join('\n');
    const backupPath = csvFilePath.replace('.csv', '_backup.csv');
    
    // Create backup
    fs.writeFileSync(backupPath, csvData);
    console.log(`📁 Backup created: ${backupPath}`);
    
    // Write updated file
    fs.writeFileSync(csvFilePath, updatedCsv);
    console.log(`📝 Updated CSV file: ${csvFilePath}`);
  } catch (error) {
    console.error('❌ Error updating CSV:', error.message);
  }
}

/**
 * Process CSV file and send messages
 */
async function processCsvFile(csvFilePath) {
  if (!fs.existsSync(csvFilePath)) {
    console.error(`❌ CSV file not found: ${csvFilePath}`);
    process.exit(1);
  }

  console.log(`📖 Reading CSV file: ${csvFilePath}`);
  
  const results = [];
  const rows = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (row) => {
        rows.push(row);
      })
      .on('end', async () => {
        console.log(`📊 Found ${rows.length} rows to process`);
        console.log('📋 First row columns:', Object.keys(rows[0] || {}));
        
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rawPhone = row['WA'] || row['wa'] || row['WhatsApp'] || row['phone'];
          const pdfUrl = row['PDF pass link'] || row['pdf'] || row['PDF'];
          const status = row['WA Sent Status'] || '';
          
          console.log(`\n📋 Row ${i + 1}:`);
          console.log(`  - Raw Phone: ${rawPhone}`);
          console.log(`  - PDF URL: ${pdfUrl}`);
          console.log(`  - Status: ${status}`);
          
          // Skip if already sent or missing data
          if (status === 'SENT' || !rawPhone || !pdfUrl) {
            console.log(`⏭️  Skipping row ${i + 1}: ${status === 'SENT' ? 'Already sent' : 'Missing data'}`);
            results.push({ success: false, skipped: true });
            continue;
          }
          
          const phone = normalizePhone(rawPhone);
          
          if (!phone) {
            console.log(`⏭️  Skipping row ${i + 1}: Invalid phone number`);
            results.push({ success: false, error: 'Invalid phone number' });
            continue;
          }
          
          console.log(`📤 Sending to ${phone} (row ${i + 1}/${rows.length})`);
          
          const result = await sendWhatsAppMessage(phone, MESSAGE, pdfUrl);
          results.push(result);
          
          // Rate limiting - wait 2 seconds between messages
          if (i < rows.length - 1) {
            console.log('⏳ Waiting 2 seconds...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        
        // Update CSV with results
        updateCsvStatus(csvFilePath, results);
        
        // Summary
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success && !r.skipped).length;
        const skipped = results.filter(r => r.skipped).length;
        
        console.log('\n📈 Summary:');
        console.log(`  ✅ Successful: ${successful}`);
        console.log(`  ❌ Failed: ${failed}`);
        console.log(`  ⏭️  Skipped: ${skipped}`);
        console.log(`  📊 Total: ${rows.length}`);
        
        resolve();
      })
      .on('error', reject);
  });
}

// Main execution
async function main() {
  const csvFilePath = process.argv[2];
  
  if (!csvFilePath) {
    console.error('❌ Please provide the CSV file path');
    console.error('Usage: node scripts/send-whatsapp-bulk-csv.cjs path/to/file.csv');
    process.exit(1);
  }
  
  try {
    await processCsvFile(csvFilePath);
    console.log('🎉 Bulk WhatsApp sending completed!');
  } catch (error) {
    console.error('💥 Error processing CSV:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  normalizePhone,
  sendWhatsAppMessage,
  processCsvFile
}; 