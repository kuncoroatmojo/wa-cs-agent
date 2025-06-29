#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const axios = require('axios');

// Evolution API Configuration
const EVOLUTION_API_URL = 'https://evo.istn.ac.id';
const EVOLUTION_API_KEY = 'YGyPcZ5tn8RfmaATbP5ou9bOP4Usc7Pk4G0k04p9G7iNMpWqbNhga2FOl6T7ud26';
const INSTANCE_NAME = 'wacanda-isif-2025'; // You may need to adjust this

// Message template
const MESSAGE_TEMPLATE = `Thank you for registering for the International Symposium & Innovation Forum 2025.
Your ticket is attached below. Please bring it with you and present it at the reception desk on the event day.
We look forward to welcoming you at ISTN Jakarta on June 26. See you soon.`;

class ISIFInvitationSender {
  constructor() {
    this.results = [];
    this.csvFilePath = 'Registrasi ISIF 2025 ISTN - 26 Juni 2025  (Responses) - Form Responses 1.csv';
    this.outputFilePath = 'isif-whatsapp-results.json';
  }

  // Normalize phone number to international format
  normalizePhoneNumber(phone) {
    if (!phone) return null;
    
    // Remove spaces, dashes, and other non-numeric characters
    let cleaned = phone.replace(/[^\d]/g, '');
    
    // Handle Indonesian numbers
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.substring(1);
    } else if (cleaned.startsWith('8')) {
      cleaned = '62' + cleaned;
    } else if (!cleaned.startsWith('62')) {
      cleaned = '62' + cleaned;
    }
    
    return cleaned;
  }

  // Download PDF from URL and convert to base64
  async downloadPdfAsBase64(url) {
    try {
      console.log(`Downloading PDF from: ${url}`);
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const base64 = Buffer.from(response.data).toString('base64');
      console.log(`PDF downloaded successfully, size: ${response.data.length} bytes`);
      return base64;
    } catch (error) {
      console.error(`Error downloading PDF: ${error.message}`);
      throw error;
    }
  }

  // Send WhatsApp message with PDF attachment
  async sendWhatsAppMessage(phoneNumber, message, pdfBase64, filename = 'ISIF_2025_Ticket.pdf') {
    try {
      const url = `${EVOLUTION_API_URL}/message/sendMedia/${INSTANCE_NAME}`;
      
      const payload = {
        number: phoneNumber,
        options: {
          delay: 1200,
          presence: 'composing'
        },
        mediaMessage: {
          mediatype: 'document',
          caption: message,
          media: `data:application/pdf;base64,${pdfBase64}`,
          fileName: filename
        }
      };

      console.log(`Sending message to ${phoneNumber}...`);
      
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY
        },
        timeout: 60000
      });

      console.log(`Message sent successfully to ${phoneNumber}`);
      return { success: true, response: response.data };
    } catch (error) {
      console.error(`Error sending message to ${phoneNumber}:`, error.response?.data || error.message);
      return { success: false, error: error.response?.data || error.message };
    }
  }

  // Process CSV and send messages
  async processCsvAndSendMessages() {
    const registrants = [];
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(this.csvFilePath)
        .pipe(csv())
        .on('data', (row) => {
          // Extract data from CSV columns (handle multiline headers)
          const name = row['Nama Lengkap\nFull Name'] || row['Nama Lengkap\r\nFull Name'];
          const whatsapp = row['WA'];
          const pdfLink = row['[PDF pass link]'];
          const currentStatus = row['WA Sent Status'];
          
          if (name && whatsapp && pdfLink && currentStatus !== 'SUCCESS') {
            registrants.push({
              name: name.trim(),
              whatsapp: whatsapp.trim(),
              pdfLink: pdfLink.trim(),
              currentStatus: currentStatus || 'PENDING'
            });
          }
        })
        .on('end', async () => {
          console.log(`Found ${registrants.length} registrants to process`);
          
          for (let i = 0; i < registrants.length; i++) {
            const registrant = registrants[i];
            console.log(`\nProcessing ${i + 1}/${registrants.length}: ${registrant.name}`);
            
            try {
              // Normalize phone number
              const phoneNumber = this.normalizePhoneNumber(registrant.whatsapp);
              if (!phoneNumber) {
                throw new Error('Invalid phone number');
              }
              
              // Download PDF
              const pdfBase64 = await this.downloadPdfAsBase64(registrant.pdfLink);
              
              // Send WhatsApp message
              const result = await this.sendWhatsAppMessage(
                phoneNumber,
                MESSAGE_TEMPLATE,
                pdfBase64,
                `ISIF_2025_Ticket_${registrant.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
              );
              
              // Store result
              this.results.push({
                name: registrant.name,
                whatsapp: registrant.whatsapp,
                normalizedPhone: phoneNumber,
                pdfLink: registrant.pdfLink,
                status: result.success ? 'SUCCESS' : 'FAILED',
                error: result.error || null,
                timestamp: new Date().toISOString()
              });
              
              // Add delay between messages
              if (i < registrants.length - 1) {
                console.log('Waiting 5 seconds before next message...');
                await new Promise(resolve => setTimeout(resolve, 5000));
              }
              
            } catch (error) {
              console.error(`Failed to process ${registrant.name}: ${error.message}`);
              this.results.push({
                name: registrant.name,
                whatsapp: registrant.whatsapp,
                normalizedPhone: null,
                pdfLink: registrant.pdfLink,
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
              });
            }
          }
          
          // Save results
          this.saveResults();
          this.printSummary();
          resolve();
        })
        .on('error', reject);
    });
  }

  // Save results to JSON file
  saveResults() {
    const resultsWithTimestamp = {
      timestamp: new Date().toISOString(),
      totalProcessed: this.results.length,
      successful: this.results.filter(r => r.status === 'SUCCESS').length,
      failed: this.results.filter(r => r.status === 'FAILED').length,
      results: this.results
    };
    
    fs.writeFileSync(this.outputFilePath, JSON.stringify(resultsWithTimestamp, null, 2));
    console.log(`\nResults saved to: ${this.outputFilePath}`);
  }

  // Print summary
  printSummary() {
    const successful = this.results.filter(r => r.status === 'SUCCESS').length;
    const failed = this.results.filter(r => r.status === 'FAILED').length;
    
    console.log('\n=== SUMMARY ===');
    console.log(`Total processed: ${this.results.length}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);
    
    if (failed > 0) {
      console.log('\nFailed messages:');
      this.results
        .filter(r => r.status === 'FAILED')
        .forEach(r => console.log(`- ${r.name} (${r.whatsapp}): ${r.error}`));
    }
  }

  // Update CSV with results (optional)
  async updateCsvStatus() {
    console.log('\nTo update the CSV file, you can manually update the "WA Sent Status" column based on the results file.');
    console.log('Or implement CSV writing functionality if needed.');
  }
}

// Main execution
async function main() {
  console.log('ISIF 2025 WhatsApp Invitation Sender');
  console.log('=====================================');
  
  const sender = new ISIFInvitationSender();
  
  try {
    await sender.processCsvAndSendMessages();
    console.log('\nProcess completed successfully!');
  } catch (error) {
    console.error('Process failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = ISIFInvitationSender; 