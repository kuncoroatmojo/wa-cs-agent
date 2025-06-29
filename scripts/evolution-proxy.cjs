const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const port = process.env.PROXY_PORT || 3001;

// Validate required environment variables
let EVOLUTION_API_URL = process.env.VITE_EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.VITE_EVOLUTION_API_KEY;

// Ensure URL has protocol
if (EVOLUTION_API_URL) {
  if (!EVOLUTION_API_URL.startsWith('http://') && !EVOLUTION_API_URL.startsWith('https://')) {
    EVOLUTION_API_URL = `https://${EVOLUTION_API_URL}`;
  }
  // Remove trailing slash if present
  EVOLUTION_API_URL = EVOLUTION_API_URL.replace(/\/$/, '');
}

if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
  console.error('❌ Missing required environment variables:');
  if (!EVOLUTION_API_URL) console.error('- VITE_EVOLUTION_API_URL');
  if (!EVOLUTION_API_KEY) console.error('- VITE_EVOLUTION_API_KEY');
  process.exit(1);
}

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Forward all requests to Evolution API
app.use('/', async (req, res) => {
  try {
    const targetUrl = `${EVOLUTION_API_URL}${req.url}`;
    console.log(`📡 Proxying ${req.method} request to: ${targetUrl}`);
    
    // Get API key from header or environment variable
    const apiKey = req.headers['x-evolution-api-key'] || EVOLUTION_API_KEY;
    
    if (req.body && Object.keys(req.body).length > 0) {
      console.log('📦 Request body:', req.body);
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined
    });

    // Read the response body
    const responseBody = await response.text();
    let data;
    
    try {
      // Try to parse as JSON
      data = JSON.parse(responseBody);
      console.log(`✅ Response from Evolution API:`, {
        status: response.status,
        ok: response.ok,
        url: targetUrl
      });
    } catch (e) {
      // If not JSON, use raw text
      data = responseBody;
      console.log(`✅ Response from Evolution API (text):`, {
        status: response.status,
        ok: response.ok,
        length: responseBody.length,
        url: targetUrl
      });
    }

    // Forward the actual status code and response from Evolution API
    res.status(response.status).json(data);
  } catch (error) {
    console.error('❌ Proxy error:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.stack
    });
  }
});

app.listen(port, () => {
  console.log(`🚀 Evolution API proxy running at http://localhost:${port}`);
  console.log(`📡 Proxying requests to: ${EVOLUTION_API_URL}`);
}); 