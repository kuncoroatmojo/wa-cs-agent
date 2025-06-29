# Environment Variables Configuration

## Simplified Environment Variable Configuration

We've simplified the Evolution API environment variable configuration to use only `VITE_EVOLUTION_API_KEY` for consistency across both frontend and backend code.

### Environment Variables Used

All code (frontend, backend, and scripts) now uses the same environment variable names:

- `VITE_EVOLUTION_API_URL` - Evolution API base URL (used everywhere)
- `VITE_EVOLUTION_API_KEY` - Evolution API key (used everywhere)

## Environment File Setup

Your `.env` or `.env.local` file should contain:

```env
# Evolution API Configuration (used for both frontend and scripts)
VITE_EVOLUTION_API_URL=https://your-evolution-api-url.com
VITE_EVOLUTION_API_KEY=your-api-key

# WhatsApp Instance Configuration
VITE_WHATSAPP_TARGET_INSTANCE=istn

# Supabase Configuration
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Usage Patterns

### In React Components (src/)
```typescript
// Use VITE_ prefixed variables (required for browser access)
const apiUrl = import.meta.env.VITE_EVOLUTION_API_URL;
const apiKey = import.meta.env.VITE_EVOLUTION_API_KEY;
const targetInstance = import.meta.env.VITE_WHATSAPP_TARGET_INSTANCE;
```

### In Node.js Scripts (scripts/)
```javascript
// Use the same VITE_ variables for consistency
const EVOLUTION_API_URL = process.env.VITE_EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.VITE_EVOLUTION_API_KEY;
const TARGET_INSTANCE = process.env.VITE_WHATSAPP_TARGET_INSTANCE;
```

## Summary of Changes

✅ **Simplified Configuration**: All code now uses `VITE_EVOLUTION_API_KEY`
✅ **Frontend (src/)**: Uses `VITE_EVOLUTION_API_URL` and `VITE_EVOLUTION_API_KEY`
✅ **Scripts**: Updated to use `VITE_EVOLUTION_API_KEY` for consistency
✅ **No Duplication**: Single variable means no confusion

This approach provides consistency across the entire codebase while maintaining full frontend compatibility.
