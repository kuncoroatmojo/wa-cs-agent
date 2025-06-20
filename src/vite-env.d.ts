/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Client-side environment variables (safe to expose)
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_EVOLUTION_API_URL: string;
  readonly VITE_EVOLUTION_API_KEY: string;
  readonly VITE_OPENAI_API_KEY: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_URL: string;
  readonly VITE_WEBHOOK_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 