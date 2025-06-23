# Environment Variables Configuration

## Updated Environment Variable Names

We've updated the Evolution API environment variable configuration to use a cleaner naming convention:

### Client-Side Variables (Frontend)
These variables are used in the React application (src/ files) and **must** have the `VITE_` prefix to be accessible in the browser:

- `VITE_EVOLUTION_API_URL` - Evolution API base URL (accessible in browser)
- `VITE_EVOLUTION_API_KEY` - Evolution API key (accessible in browser)

### Server-Side Variables (Scripts & Functions)
These variables are used in Node.js scripts and server functions:

- `VITE_EVOLUTION_API_URL` - Evolution API base URL (used for consistency)
- `EVOLUTION_API_KEY` - Evolution API key (cleaner name for server-side scripts)

## Environment File Setup

Your `.env` file should contain:

```env
# Required for both client-side and server-side access
VITE_EVOLUTION_API_URL=https://your-evolution-api-url.com
VITE_EVOLUTION_API_KEY=your-api-key

# Required for server-side scripts (cleaner variable name)
EVOLUTION_API_KEY=your-api-key

# Other variables
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
```

### In Node.js Scripts (scripts/)
```javascript
// Use cleaner variable names for server-side
const EVOLUTION_API_URL = process.env.VITE_EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
```

## Summary of Changes

✅ **Frontend (src/)**: Uses `VITE_EVOLUTION_API_URL` and `VITE_EVOLUTION_API_KEY` (no changes)
✅ **Scripts**: Updated to use `EVOLUTION_API_KEY` instead of `VITE_EVOLUTION_API_KEY`
✅ **URL Variable**: Scripts continue to use `VITE_EVOLUTION_API_URL` for consistency
✅ **Backward Compatibility**: Existing deployments will continue to work

This approach provides cleaner script code while maintaining full frontend compatibility.
