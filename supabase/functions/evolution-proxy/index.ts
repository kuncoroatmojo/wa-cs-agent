// Supabase Edge Function for Evolution API proxy
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");

serve(async (req) => {
  // Set up CORS headers with dynamic origin
  const corsHeaders = {
    "Access-Control-Allow-Origin": req.headers.get("origin") || "https://wacanda.vercel.app",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Credentials": "true"
  };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the target endpoint from the URL
    const url = new URL(req.url);
    const targetEndpoint = url.pathname.replace("/evolution-proxy", "");
    
    // Get API key from header or environment
    const apiKey = req.headers.get("apikey") || EVOLUTION_API_KEY;
    
    // Forward the request to Evolution API
    const response = await fetch(`${EVOLUTION_API_URL}${targetEndpoint}`, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey // Evolution API expects the key in apikey header
      },
      body: req.method !== "GET" ? await req.text() : undefined
    });

    // Handle Evolution API response
    if (response.status === 401) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing Evolution API key" }),
        { 
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      );
    }

    const data = await response.json();

    // Return the response with CORS headers
    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
      status: response.status
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});

 