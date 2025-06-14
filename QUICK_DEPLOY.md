# 🚀 Quick Deploy - WhatsApp AI Customer Support Assistant

**Ready to deploy in 5 minutes!** Follow these essential steps for rapid deployment.

## ⚡ Prerequisites (2 minutes)

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Login to Vercel
vercel login

# 3. Install dependencies
npm install
```

## 🔧 Environment Setup (2 minutes)

Create accounts and get your API keys:

1. **Supabase**: [supabase.com](https://supabase.com) → Create project → Copy URL & anon key
2. **OpenAI**: [platform.openai.com](https://platform.openai.com) → API Keys → Create new key
3. **Evolution API**: Deploy via Docker or use hosted service
4. **Google Cloud**: [console.cloud.google.com](https://console.cloud.google.com) → Enable Drive API → Create OAuth credentials

## 🌐 Deploy to Vercel (1 minute)

```bash
# Quick deployment
vercel --prod

# Or step by step:
npm run build          # Test build
npm run type-check     # Verify TypeScript
vercel --prod          # Deploy to production
```

### Environment Variables

Add these in Vercel dashboard or via CLI:

```bash
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel env add VITE_EVOLUTION_API_URL
vercel env add VITE_EVOLUTION_API_KEY
vercel env add VITE_OPENAI_API_KEY
vercel env add VITE_GOOGLE_CLIENT_ID
```

## 🗄️ Database Setup

Run these SQL commands in your Supabase SQL editor:

```sql
-- 1. Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Run schema migration
-- Copy and paste content from: docs/database/01_initial_schema.sql

-- 3. Apply security policies  
-- Copy and paste content from: docs/database/02_rls_policies.sql
```

## ✅ Verification

Test these core features after deployment:

- [ ] **Homepage loads** without errors
- [ ] **Authentication** works (signup/login)
- [ ] **Dashboard** accessible
- [ ] **Environment variables** loaded correctly

## 🚨 Quick Troubleshooting

### Build Errors
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Missing Environment Variables
```bash
vercel env ls                    # List current variables
vercel env add VARIABLE_NAME     # Add missing variable
```

### Database Connection Issues
```sql
-- Test in Supabase SQL editor
SELECT version();
SELECT * FROM profiles LIMIT 1;
```

## 📋 Essential Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run type-check      # TypeScript checking
npm run lint            # Code linting

# Deployment
vercel                  # Deploy to preview
vercel --prod          # Deploy to production
vercel logs            # View deployment logs
vercel env ls          # List environment variables

# Database
# Use Supabase dashboard SQL editor for database operations
```

## 🔗 Important Links

- **Vercel Dashboard**: [vercel.com/dashboard](https://vercel.com/dashboard)
- **Supabase Dashboard**: [supabase.com/dashboard](https://supabase.com/dashboard)
- **Full Documentation**: See `DEPLOYMENT.md` for complete guide
- **Deployment Checklist**: See `DEPLOYMENT_CHECKLIST.md` for detailed verification

---

## 🎯 Next Steps After Deployment

1. **Test Core Features** (5 minutes)
   - Authentication flow
   - WhatsApp instance creation
   - Document upload
   - AI chat responses

2. **Monitor & Optimize** (Ongoing)
   - Check Vercel analytics
   - Monitor error logs
   - Optimize performance
   - Gather user feedback

3. **Scale & Enhance** (Future)
   - Add custom domain
   - Implement monitoring
   - Add more integrations
   - Enhance UI/UX

---

**🎉 Your WhatsApp AI Customer Support Assistant is now live!**

*For detailed deployment instructions, troubleshooting, and advanced configuration, see the complete [DEPLOYMENT.md](./DEPLOYMENT.md) guide.* 