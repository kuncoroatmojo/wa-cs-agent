import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on mode
  const env = loadEnv(mode, process.cwd(), '')

  // Ensure environment variables are properly stringified
  const envWithProcessPrefix = {
    'process.env': Object.entries(env).reduce((prev, [key, val]) => {
      return {
        ...prev,
        [key]: val,
      }
    }, {}),
  }

  return {
    plugins: [react()],
    envPrefix: ['VITE_', 'SUPABASE_'],  // Allow both VITE_ and SUPABASE_ prefixes
    define: {
      ...envWithProcessPrefix,  // Make env vars available as process.env.X
      'import.meta.env.VITE_WHATSAPP_TARGET_INSTANCE': JSON.stringify(env.VITE_WHATSAPP_TARGET_INSTANCE || 'istn'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    css: {
      postcss: './postcss.config.js',
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            router: ['react-router-dom'],
            ui: ['@headlessui/react', '@heroicons/react'],
            supabase: ['@supabase/supabase-js'],
            query: ['@tanstack/react-query'],
          },
        },
      },
    },
    server: {
      port: 5173,
      host: true
    },
    preview: {
      port: 4173,
      host: true,
    },
  }
})
