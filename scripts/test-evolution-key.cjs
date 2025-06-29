const fetch = require('node-fetch');

const EDGE_FUNCTION_URL = 'https://pfirjlhuulkchogjbvsv.functions.supabase.co/evolution-proxy';
const API_KEY = 'YGyPcZ5tn8RfmaATbP5ou9bOP4Usc7Pk4G0k04p9G7iNMpWqbNhga2FOl6T7ud26';

async function testApiKey() {
  try {
    console.log('Testing Evolution API key...');
    const response = await fetch(`${EDGE_FUNCTION_URL}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': API_KEY
      }
    });

    const data = await response.text();
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);
    console.log('Response body:', data);
  } catch (error) {
    console.error('Error testing API key:', error);
  }
}

testApiKey(); 