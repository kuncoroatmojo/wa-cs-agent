# 🚀 Deployment Guide - WhatsApp AI Customer Support Assistant

This guide covers the complete deployment process for your WhatsApp AI Customer Support Assistant.

## 📋 Pre-Deployment Checklist

### ✅ **Step 1: Environment Variables Setup**

Create a `.env` file in your project root with these variables:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Evolution API Configuration
VITE_EVOLUTION_API_URL=https://your-evolution-api.com
VITE_EVOLUTION_API_KEY=your-evolution-api-key

# OpenAI Configuration
VITE_OPENAI_API_KEY=sk-your-openai-api-key

# Google Drive API
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# App Configuration
VITE_APP_NAME="WhatsApp AI Assistant"
VITE_APP_URL=https://your-app.vercel.app
VITE_WEBHOOK_URL=https://your-app.vercel.app/api/webhook
```

### ✅ **Step 2: Supabase Database Setup**

1. **Create Supabase Project**
   ```bash
   # Go to https://supabase.com and create a new project
   # Note down your project URL and anon key
   ```

2. **Run Database Migrations**
   ```sql
   -- Enable vector extension
   CREATE EXTENSION IF NOT EXISTS vector;
   
   -- Users table
   CREATE TABLE IF NOT EXISTS profiles (
     id UUID REFERENCES auth.users(id) PRIMARY KEY,
     email TEXT UNIQUE NOT NULL,
     full_name TEXT,
     avatar_url TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   
   -- WhatsApp instances table
   CREATE TABLE IF NOT EXISTS whatsapp_instances (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
     name TEXT NOT NULL,
     instance_key TEXT UNIQUE NOT NULL,
     api_type TEXT CHECK (api_type IN ('baileys', 'cloud')) DEFAULT 'baileys',
     status TEXT CHECK (status IN ('connecting', 'connected', 'disconnected', 'error')) DEFAULT 'disconnected',
     phone_number TEXT,
     qr_code TEXT,
     webhook_url TEXT,
     settings JSONB DEFAULT '{}',
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   
   -- Conversations table
   CREATE TABLE IF NOT EXISTS conversations (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
     contact_id TEXT NOT NULL,
     contact_name TEXT,
     contact_number TEXT,
     status TEXT CHECK (status IN ('active', 'resolved', 'escalated')) DEFAULT 'active',
     assigned_to UUID REFERENCES profiles(id),
     last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   
   -- Messages table
   CREATE TABLE IF NOT EXISTS messages (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
     message_id TEXT UNIQUE NOT NULL,
     sender_type TEXT CHECK (sender_type IN ('contact', 'agent', 'bot')) NOT NULL,
     content TEXT NOT NULL,
     message_type TEXT CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document')) DEFAULT 'text',
     media_url TEXT,
     timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     metadata JSONB DEFAULT '{}'
   );
   
   -- Documents table for RAG
   CREATE TABLE IF NOT EXISTS documents (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
     title TEXT NOT NULL,
     content TEXT NOT NULL,
     file_type TEXT,
     file_size INTEGER,
     source_url TEXT,
     embedding vector(1536),
     metadata JSONB DEFAULT '{}',
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   
   -- Create indexes
   CREATE INDEX IF NOT EXISTS idx_documents_embedding ON documents USING ivfflat (embedding vector_cosine_ops);
   CREATE INDEX IF NOT EXISTS idx_conversations_instance ON conversations(instance_id);
   CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
   ```

3. **Set up Row Level Security (RLS)**
   ```sql
   -- Enable RLS on all tables
   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
   ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;
   ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
   ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
   ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
   
   -- Profiles policies
   CREATE POLICY "Users can view own profile" ON profiles
     FOR SELECT USING (auth.uid() = id);
   
   CREATE POLICY "Users can update own profile" ON profiles
     FOR UPDATE USING (auth.uid() = id);
   
   -- WhatsApp instances policies
   CREATE POLICY "Users can manage own instances" ON whatsapp_instances
     FOR ALL USING (auth.uid() = user_id);
   
   -- Conversations policies
   CREATE POLICY "Users can view own conversations" ON conversations
     FOR SELECT USING (
       EXISTS (
         SELECT 1 FROM whatsapp_instances 
         WHERE whatsapp_instances.id = conversations.instance_id 
         AND whatsapp_instances.user_id = auth.uid()
       )
     );
   
   -- Messages policies
   CREATE POLICY "Users can view messages from own conversations" ON messages
     FOR SELECT USING (
       EXISTS (
         SELECT 1 FROM conversations 
         JOIN whatsapp_instances ON conversations.instance_id = whatsapp_instances.id
         WHERE conversations.id = messages.conversation_id 
         AND whatsapp_instances.user_id = auth.uid()
       )
     );
   
   -- Documents policies
   CREATE POLICY "Users can manage own documents" ON documents
     FOR ALL USING (auth.uid() = user_id);
   ```

### ✅ **Step 3: Evolution API Setup**

1. **Deploy Evolution API Instance**
   ```bash
   # Option 1: Docker (Recommended)
   docker run -d \
     --name evolution-api \
     -p 8080:8080 \
     -e AUTHENTICATION_API_KEY=your-secure-api-key \
     -e WEBHOOK_GLOBAL_URL=https://your-app.vercel.app/api/webhook \
     evolution-api/evolution-api:latest
   
   # Option 2: Using Docker Compose
   # Create docker-compose.yml in a separate directory
   ```

2. **Docker Compose Configuration**
   ```yaml
   version: '3.8'
   services:
     evolution-api:
       image: evolution-api/evolution-api:latest
       container_name: evolution-api
       ports:
         - "8080:8080"
       environment:
         - AUTHENTICATION_API_KEY=your-secure-api-key
         - WEBHOOK_GLOBAL_URL=https://your-app.vercel.app/api/webhook
         - DATABASE_CONNECTION_URI=postgresql://user:pass@localhost:5432/evolution
         - REDIS_URI=redis://localhost:6379
       volumes:
         - evolution_instances:/evolution/instances
         - evolution_store:/evolution/store
       restart: unless-stopped
   
   volumes:
     evolution_instances:
     evolution_store:
   ```

### ✅ **Step 4: Google Drive API Setup**

1. **Create Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select existing one
   - Enable Google Drive API

2. **Configure OAuth Credentials**
   ```bash
   # Go to APIs & Services > Credentials
   # Create OAuth 2.0 Client IDs
   # Add your domain to authorized origins:
   # - https://your-app.vercel.app
   # - http://localhost:5173 (for development)
   ```

3. **Set Authorized Redirect URIs**
   ```
   https://your-app.vercel.app/auth/callback
   http://localhost:5173/auth/callback
   ```

## 🌐 **Step 5: Vercel Deployment**

### 1. **Install Vercel CLI**
```bash
npm install -g vercel
```

### 2. **Login to Vercel**
```bash
vercel login
```

### 3. **Build and Deploy**
```bash
# Test build locally first
npm run build

# Deploy to Vercel
vercel --prod
```

### 4. **Configure Environment Variables in Vercel**
```bash
# Set environment variables in Vercel dashboard or via CLI
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel env add VITE_EVOLUTION_API_URL
vercel env add VITE_EVOLUTION_API_KEY
vercel env add VITE_OPENAI_API_KEY
vercel env add VITE_GOOGLE_CLIENT_ID
```

### 5. **Custom Domain Setup (Optional)**
```bash
# Add custom domain
vercel domains add yourdomain.com
vercel domains add www.yourdomain.com

# Configure DNS records as instructed by Vercel
```

## 🔧 **Step 6: Supabase Edge Functions** (Optional Advanced Features)

Create serverless functions for advanced processing:

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Create edge function for webhook processing
supabase functions new webhook-handler

# Create edge function for document processing
supabase functions new document-processor

# Deploy functions
supabase functions deploy webhook-handler
supabase functions deploy document-processor
```

## 🔍 **Step 7: Post-Deployment Testing**

### 1. **Test Authentication**
- Sign up/login flow
- Profile management
- Session persistence

### 2. **Test WhatsApp Integration**
- Create new instance
- QR code generation and scanning
- Message sending/receiving

### 3. **Test RAG System**
- Document upload
- Vector search functionality
- AI response generation

### 4. **Test Real-time Features**
- Live message updates
- Conversation status changes
- Multiple user sessions

## 🔐 **Step 8: Security & Performance**

### 1. **Security Headers**
```javascript
// Add to vercel.json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

### 2. **Performance Optimization**
```bash
# Analyze bundle size
npm run build -- --analyze

# Enable gzip compression in vercel.json
# Set up CDN for static assets
# Implement service worker for caching
```

## 📊 **Step 9: Monitoring & Analytics**

### 1. **Error Tracking**
```bash
# Install Sentry
npm install @sentry/react @sentry/vite-plugin

# Configure Sentry in your app
```

### 2. **Performance Monitoring**
```javascript
// Add to your React app
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

getCLS(console.log);
getFID(console.log);
getFCP(console.log);
getLCP(console.log);
getTTFB(console.log);
```

## 🚀 **Step 10: Go Live!**

### Final Checklist:
- [ ] All environment variables configured
- [ ] Supabase database and RLS policies set up
- [ ] Evolution API instance running and connected
- [ ] Google Drive API credentials configured
- [ ] Vercel deployment successful
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificates active
- [ ] Monitoring and error tracking enabled
- [ ] Backup strategy implemented
- [ ] Documentation updated

### Post-Launch Tasks:
1. **Monitor Performance**: Check Vercel analytics and Core Web Vitals
2. **User Feedback**: Implement feedback collection system
3. **Scaling**: Monitor usage and scale Evolution API as needed
4. **Updates**: Set up CI/CD pipeline for automated deployments
5. **Security**: Regular security audits and dependency updates

---

## 🆘 **Troubleshooting Common Issues**

### Build Errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Check TypeScript errors
npm run type-check
```

### CORS Issues
```javascript
// Configure CORS in Evolution API
// Add your domain to allowed origins
```

### Database Connection Issues
```bash
# Check Supabase connection
# Verify RLS policies
# Check environment variables
```

### WebSocket Connection Issues
```javascript
// Check Supabase real-time configuration
// Verify authentication tokens
// Check network connectivity
```

---

**🎉 Congratulations! Your WhatsApp AI Customer Support Assistant is now live!**

For support and additional features, refer to the main [README.md](./README.md) documentation. 