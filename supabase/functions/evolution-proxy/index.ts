// Follow Deno and Oak best practices
import { Application, Router } from "https://deno.land/x/oak/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://wacanda.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Credentials": "true"
};

const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the target endpoint from the URL
    const url = new URL(req.url);
    const targetEndpoint = url.pathname.replace("/evolution-proxy", "");
    
    // Forward the request to Evolution API
    const response = await fetch(`${EVOLUTION_API_URL}${targetEndpoint}`, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "apikey": EVOLUTION_API_KEY!
      },
      body: req.method !== "GET" ? await req.text() : undefined
    });

    const data = await response.json();

    // Return the response with CORS headers
    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
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

const app = new Application();
const router = new Router();

router.options("/", (ctx) => {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    ctx.response.headers.set(key, value);
  });
  ctx.response.status = 200;
});

router.post("/", async (ctx) => {
  try {
    const body = await ctx.request.body().value;
    const { endpoint, method, requestBody } = body;

    // Get Evolution API configuration from environment
    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionApiUrl || !evolutionApiKey) {
      ctx.response.status = 500;
      ctx.response.body = { error: "Evolution API configuration missing" };
      return;
    }

    // Make request to Evolution API
    const response = await fetch(`${evolutionApiUrl}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "apikey": evolutionApiKey,
      },
      body: requestBody ? JSON.stringify(requestBody) : undefined,
    });

    const data = await response.json();
    
    // Set CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
      ctx.response.headers.set(key, value);
    });

    ctx.response.status = response.status;
    ctx.response.body = data;
  } catch (error) {
    console.error("Error in evolution-proxy:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: error.message };
  }
});

app.use(router.routes());
app.use(router.allowedMethods());

await app.listen({ port: 8000 }); 