/**
 * QR Code generation utilities
 * This module provides functions to generate QR codes for WhatsApp Web connections
 */

/**
 * Generate a visual QR code as a data URL
 * In a real implementation, you would use a library like 'qrcode' or 'qr-code-generator'
 * For now, we'll create a simple placeholder that could be replaced with actual QR generation
 */
export function generateQRCodeDataURL(data: string, size: number = 200): Promise<string> {
  return new Promise((resolve) => {
    // Create a canvas element
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      // Fallback to a simple data URL
      resolve('data:image/svg+xml;base64,' + btoa(`
        <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="white"/>
          <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="monospace" font-size="12" fill="black">
            QR Code
          </text>
          <text x="50%" y="60%" text-anchor="middle" dy=".3em" font-family="monospace" font-size="8" fill="gray">
            ${data.substring(0, 20)}...
          </text>
        </svg>
      `));
      return;
    }

    canvas.width = size;
    canvas.height = size;

    // Create a simple pattern that looks like a QR code
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, size, size);

    // Draw QR code-like pattern
    ctx.fillStyle = 'black';
    const blockSize = size / 25; // 25x25 grid

    // Generate a pseudo-random pattern based on the data
    const hash = simpleHash(data);
    
    for (let x = 0; x < 25; x++) {
      for (let y = 0; y < 25; y++) {
        // Create a pattern based on position and data hash
        const shouldFill = ((x + y + hash) % 3 === 0) || 
                          (x < 7 && y < 7) || // Top-left finder pattern
                          (x > 17 && y < 7) || // Top-right finder pattern
                          (x < 7 && y > 17);   // Bottom-left finder pattern
        
        if (shouldFill) {
          ctx.fillRect(x * blockSize, y * blockSize, blockSize, blockSize);
        }
      }
    }

    // Add corner markers (finder patterns)
    drawFinderPattern(ctx, 0, 0, blockSize);
    drawFinderPattern(ctx, 18 * blockSize, 0, blockSize);
    drawFinderPattern(ctx, 0, 18 * blockSize, blockSize);

    // Convert to data URL
    const dataURL = canvas.toDataURL('image/png');
    resolve(dataURL);
  });
}

/**
 * Simple hash function for generating consistent patterns
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Draw a QR code finder pattern (the square markers in corners)
 */
function drawFinderPattern(ctx: CanvasRenderingContext2D, x: number, y: number, blockSize: number) {
  // Outer square (7x7)
  ctx.fillStyle = 'black';
  ctx.fillRect(x, y, 7 * blockSize, 7 * blockSize);
  
  // Inner white square (5x5)
  ctx.fillStyle = 'white';
  ctx.fillRect(x + blockSize, y + blockSize, 5 * blockSize, 5 * blockSize);
  
  // Center black square (3x3)
  ctx.fillStyle = 'black';
  ctx.fillRect(x + 2 * blockSize, y + 2 * blockSize, 3 * blockSize, 3 * blockSize);
}

/**
 * Generate WhatsApp Web QR code data
 * This simulates the format that WhatsApp Web uses
 */
export function generateWhatsAppQRData(instanceId: string): string {
  const timestamp = Date.now();
  const randomRef = Math.random().toString(36).substring(2, 15);
  const serverToken = Math.random().toString(36).substring(2, 25);
  
  // This mimics the actual WhatsApp Web QR code format
  // Format: ref,publicKey,serverToken,clientToken,timestamp
  return `1@${randomRef},${serverToken},${instanceId},${timestamp}`;
}

/**
 * Check if QR code data is expired (WhatsApp QR codes typically expire after 20 seconds)
 */
export function isQRCodeExpired(qrData: string, expirySeconds: number = 20): boolean {
  try {
    const parts = qrData.split(',');
    if (parts.length >= 4) {
      const timestamp = parseInt(parts[parts.length - 1]);
      if (!isNaN(timestamp)) {
        const now = Date.now();
        return (now - timestamp) > (expirySeconds * 1000);
      }
    }
  } catch (error) {
    console.error('Error checking QR code expiry:', error);
  }
  return true; // Consider expired if we can't parse
}

/**
 * Format QR code data for display
 */
export function formatQRDataForDisplay(qrData: string): string {
  try {
    const parts = qrData.split(',');
    if (parts.length >= 4) {
      const ref = parts[0];
      const timestamp = parseInt(parts[parts.length - 1]);
      const date = new Date(timestamp);
      
      return `Ref: ${ref}\nGenerated: ${date.toLocaleTimeString()}`;
    }
  } catch (error) {
    console.error('Error formatting QR data:', error);
  }
  return qrData.substring(0, 50) + '...';
} 