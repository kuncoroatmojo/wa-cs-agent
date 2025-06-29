#!/usr/bin/env node

const fs = require('fs');
const csv = require('csv-parser');

const csvFilePath = 'Registrasi ISIF 2025 ISTN - 26 Juni 2025  (Responses) - Form Responses 1.csv';

console.log('Testing CSV parsing...\n');

fs.createReadStream(csvFilePath)
  .pipe(csv())
  .on('data', (row) => {
    console.log('Row data:');
    console.log('Headers found:', Object.keys(row));
    
    // Try different variations of the header names
    const nameVariations = [
      'Nama Lengkap\nFull Name',
      'Nama Lengkap\r\nFull Name', 
      'Nama Lengkap Full Name',
      'Nama Lengkap',
      'Full Name'
    ];
    
    let name = null;
    for (const variation of nameVariations) {
      if (row[variation]) {
        name = row[variation];
        console.log(`Found name using header: "${variation}" = "${name}"`);
        break;
      }
    }
    
    const whatsapp = row['WA'];
    const pdfLink = row['[PDF pass link]'];
    const currentStatus = row['WA Sent Status'];
    
    console.log('Extracted data:');
    console.log(`- Name: ${name}`);
    console.log(`- WhatsApp: ${whatsapp}`);
    console.log(`- PDF Link: ${pdfLink}`);
    console.log(`- Current Status: ${currentStatus}`);
    console.log('---');
  })
  .on('end', () => {
    console.log('CSV parsing completed.');
  })
  .on('error', (error) => {
    console.error('Error parsing CSV:', error);
  }); 