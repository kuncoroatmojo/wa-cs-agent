#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const EVOLUTION_API_URL = 'https://evo.istn.ac.id';
const EVOLUTION_API_KEY = 'YGyPcZ5tn8RfmaATbP5ou9bOP4Usc7Pk4G0k04p9G7iNMpWqbNhga2FOl6T7ud26';
const INSTANCE_NAME = 'personal';
const CSV_FILE_PATH = 'Registrasi ISIF 2025 ISTN - 26 Juni 2025  (Responses) - Form Responses 1.csv';

const MESSAGE_TEXT = "Thank you for registering for the International Symposium & Innovation Forum 2025. Your ticket is attached below. Please bring it with you and present it at the reception desk on the event day. We look forward to welcoming you at ISTN Jakarta on June 26. See you soon.";

// Function to parse Indonesian phone numbers
function parseIndonesianPhoneNumber(phoneStr) {
  if (!phoneStr) return null;
  
  // Remove all spaces, hyphens, and other non-digit characters
  let cleaned = phoneStr.replace(/[\s\-\(\)]/g, '');
  
  // Handle different formats
  if (cleaned.startsWith('0')) {
    // Replace leading 0 with 62 (Indonesia country code)
    cleaned = '62' + cleaned.substring(1);
  } else if (cleaned.startsWith('8')) {
    // Add 62 prefix if starts with 8
    cleaned = '62' + cleaned;
  } else if (!cleaned.startsWith('62')) {
    // Add 62 prefix if no country code
    cleaned = '62' + cleaned;
  }
  
  return cleaned;
}

// Function to send WhatsApp message with PDF document
async function sendWhatsAppPDF(phoneNumber, pdfUrl, name) {
  try {
    console.log(`Sending PDF ticket to ${name} (${phoneNumber})...`);
    
    // First try sending as document media
    const mediaPayload = {
      number: phoneNumber,
      mediatype: "document",
      mimetype: "application/pdf",
      caption: MESSAGE_TEXT,
      media: pdfUrl,
      fileName: `ISIF2025_Ticket_${name.replace(/\s+/g, '_')}.pdf`
    };

    const response = await axios({
      method: 'POST',
      url: `${EVOLUTION_API_URL}/message/sendMedia/${INSTANCE_NAME}`,
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      data: mediaPayload,
      timeout: 30000
    });

    console.log(`✅ Success: PDF sent to ${name} (${phoneNumber})`);
    console.log('Response:', response.data);
    return { success: true, response: response.data };

  } catch (error) {
    console.error(`❌ Failed to send PDF to ${name} (${phoneNumber}):`, error.message);
    
    // Fallback: try sending text message with PDF link
    try {
      console.log(`Attempting fallback: sending text with PDF link to ${name}...`);
      
      const textPayload = {
        number: phoneNumber,
        text: `${MESSAGE_TEXT}\n\nTicket PDF: ${pdfUrl}`
      };

      const textResponse = await axios({
        method: 'POST',
        url: `${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`,
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY
        },
        data: textPayload,
        timeout: 30000
      });

      console.log(`✅ Fallback success: Text with PDF link sent to ${name} (${phoneNumber})`);
      return { success: true, response: textResponse.data, fallback: true };

    } catch (fallbackError) {
      console.error(`❌ Fallback also failed for ${name}:`, fallbackError.message);
      return { success: false, error: fallbackError.message };
    }
  }
}

// Function to parse CSV with fixed column positions
function parseCSV(csvContent) {
  const lines = csvContent.split('\n');
  const registrants = [];

  // Based on the CSV structure, the actual data starts from a specific line
  // Let's find the line that contains the actual header with column names
  let headerLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('[PDF pass link]') && lines[i].includes('WA Sent Status')) {
      headerLineIndex = i;
      break;
    }
  }

  if (headerLineIndex === -1) {
    console.error('Could not find header line with column names');
    return { registrants: [], headers: [], lines };
  }

  const headers = lines[headerLineIndex].split(',');
  console.log('Found headers:', headers.map((h, i) => `${i}: ${h.trim()}`));

  // Based on the actual CSV structure:
  // Column 1: Name (Nama Lengkap/Full Name)
  // Column 2: WA (Phone number) 
  // Column 10: [PDF pass link]
  // Column 13: WA Sent Status
  const nameIndex = 1;
  const phoneIndex = 2;
  const pdfIndex = 10;
  const statusIndex = 13;

  console.log('Using column indices:', { nameIndex, phoneIndex, pdfIndex, statusIndex });

  // Parse data rows (start from after header)
  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const columns = line.split(',');
    if (columns.length > Math.max(nameIndex, phoneIndex, pdfIndex, statusIndex)) {
      const name = columns[nameIndex]?.trim();
      const phone = columns[phoneIndex]?.trim();
      const pdfUrl = columns[pdfIndex]?.trim();
      const currentStatus = columns[statusIndex]?.trim() || 'FAILED';

      if (name && phone && pdfUrl) {
        registrants.push({
          name,
          phone: parseIndonesianPhoneNumber(phone),
          originalPhone: phone,
          pdfUrl,
          currentStatus,
          lineIndex: i,
          originalLine: line
        });
      }
    }
  }

  return { registrants, headers, lines, headerLineIndex };
}

// Function to update CSV with new status
function updateCSVStatus(csvData, registrantIndex, newStatus) {
  const { lines } = csvData;
  const statusIndex = 13; // Fixed position for WA Sent Status
  
  const lineIndex = csvData.registrants[registrantIndex].lineIndex;
  const columns = lines[lineIndex].split(',');
  columns[statusIndex] = newStatus;
  lines[lineIndex] = columns.join(',');

  return csvData;
}

// Main function
async function main() {
  try {
    // Read CSV file
    const csvContent = fs.readFileSync(CSV_FILE_PATH, 'utf8');
    const csvData = parseCSV(csvContent);

    console.log(`\nFound ${csvData.registrants.length} registrants:`);
    csvData.registrants.forEach((reg, i) => {
      console.log(`${i + 1}. ${reg.name} - ${reg.originalPhone} -> ${reg.phone} - Status: ${reg.currentStatus}`);
      console.log(`   PDF: ${reg.pdfUrl}`);
    });

    if (csvData.registrants.length === 0) {
      console.log('No registrants found. Exiting.');
      return;
    }

    // Ask for confirmation
    console.log(`\nReady to send PDF tickets to ${csvData.registrants.length} registrants.`);
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to proceed...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Send messages
    const results = [];
    for (let i = 0; i < csvData.registrants.length; i++) {
      const registrant = csvData.registrants[i];
      
      console.log(`\n--- Processing ${i + 1}/${csvData.registrants.length}: ${registrant.name} ---`);
      
      const result = await sendWhatsAppPDF(registrant.phone, registrant.pdfUrl, registrant.name);
      results.push(result);

      // Update status
      const newStatus = result.success ? (result.fallback ? 'SENT_TEXT' : 'SENT_PDF') : 'FAILED';
      updateCSVStatus(csvData, i, newStatus);

      // Add delay between messages
      if (i < csvData.registrants.length - 1) {
        console.log('Waiting 3 seconds before next message...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // Save updated CSV
    const updatedCSV = csvData.lines.join('\n');
    fs.writeFileSync(CSV_FILE_PATH, updatedCSV);
    console.log(`\n✅ CSV file updated with sending statuses`);

    // Summary
    console.log('\n=== SUMMARY ===');
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const fallbacks = results.filter(r => r.success && r.fallback).length;
    
    console.log(`✅ Successful: ${successful}/${results.length}`);
    console.log(`📄 PDF sent: ${successful - fallbacks}`);
    console.log(`📝 Text with link: ${fallbacks}`);
    console.log(`❌ Failed: ${failed}`);

    // Show updated statuses
    console.log('\n=== UPDATED STATUSES ===');
    csvData.registrants.forEach((reg, i) => {
      const result = results[i];
      const status = result.success ? (result.fallback ? 'SENT_TEXT' : 'SENT_PDF') : 'FAILED';
      console.log(`${reg.name}: ${status}`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

main(); 