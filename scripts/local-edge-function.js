import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const app = express();
const port = 54321;

// Headers to remove from forwarded requests
const removeHeaders = [
  'host',
  'connection',
  'content-length',
  'sec-ch-ua',
  'sec-ch-ua-platform',
  'sec-ch-ua-mobile',
  'sec-fetch-site',
  'sec-fetch-mode',
  'sec-fetch-dest',
  'referer',
  'cookie',
  'origin',
  'accept-encoding', // This can cause issues with compression
  'cache-control',
  'pragma',
  'upgrade-insecure-requests'
];

// CORS middleware
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey']
}));

// Body parser middleware
app.use(express.json());

// Ensure Evolution API URL is properly formatted
const evolutionApiUrl = process.env.VITE_EVOLUTION_API_URL?.replace(/\/$/, '');
const evolutionApiKey = process.env.VITE_EVOLUTION_API_KEY;

if (!evolutionApiUrl) {
  console.error('❌ VITE_EVOLUTION_API_URL is not set in .env.local');
  process.exit(1);
}

if (!evolutionApiKey) {
  console.error('❌ VITE_EVOLUTION_API_KEY is not set in .env.local');
  process.exit(1);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Proxy middleware for Evolution API
app.use('/functions/v1/evolution-proxy', async (req, res) => {
  try {
    console.log(`🔍 Incoming request: ${req.method} ${req.originalUrl}`);
    console.log(`🔍 Headers:`, req.headers);
    
    // Get the target path by removing the proxy prefix
    let targetPath = req.originalUrl.replace('/functions/v1/evolution-proxy', '');
    console.log(`🔍 Target path after prefix removal: "${targetPath}"`);
    
    // Ensure target path starts with /
    if (!targetPath.startsWith('/')) {
      targetPath = '/' + targetPath;
    }
    
    // If path is empty, default to /
    if (!targetPath || targetPath === '/') {
      targetPath = '/';
    }
    
    console.log(`🔍 Final target path: "${targetPath}"`);
    
    // Construct the full URL by simple concatenation
    const targetUrl = evolutionApiUrl + targetPath;
    console.log(`📡 Proxying ${req.method} request to: ${targetUrl}`);
    
    // Validate URL
    try {
      new URL(targetUrl);
    } catch (urlError) {
      console.error('❌ Invalid URL:', targetUrl, urlError.message);
      return res.status(400).json({ error: 'Invalid target URL', url: targetUrl });
    }
    
    // Build clean headers - only send essential ones
    const headers = {
      'apikey': req.headers.apikey || req.headers.authorization || evolutionApiKey,
      'Accept': 'application/json',
      'User-Agent': 'Evolution-API-Client/1.0'
    };
    
    // Add content-type if body exists
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      headers['Content-Type'] = 'application/json';
    }
    
    console.log(`🔍 Clean request headers:`, headers);
    
    // Forward the request
    const fetchOptions = {
      method: req.method,
      headers
    };
    
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
      console.log(`🔍 Request body:`, req.body);
    }
    
    console.log(`🔍 Fetch options:`, fetchOptions);
    
    const response = await fetch(targetUrl, fetchOptions);
    
    console.log(`✅ Response status: ${response.status}`);

    // Forward the response
    res.status(response.status);
    
    // Forward response headers (except problematic ones)
    for (const [key, value] of response.headers.entries()) {
      if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    }

    // Send response body
    const responseBody = await response.text();
    console.log(`📤 Response body:`, responseBody);
    res.send(responseBody);
  } catch (error) {
    console.error('❌ Proxy error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

app.listen(port, () => {
  console.log(`🚀 Local Edge Function running at http://localhost:${port}`);
  console.log(`📡 Proxying requests to ${evolutionApiUrl}`);
  console.log(`🔍 Health check available at http://localhost:${port}/health`);
});

// Keep the process alive
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
}); 