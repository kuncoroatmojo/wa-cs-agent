# 🚀 Deployment Checklist - WhatsApp AI Customer Support Assistant

Use this checklist to ensure a successful deployment. Check off each item as you complete it.

## 📋 Pre-Deployment Setup

### ✅ Environment Setup
- [ ] **Node.js 18+** installed locally
- [ ] **Git** repository initialized and connected to GitHub
- [ ] **Vercel CLI** installed (`npm install -g vercel`)
- [ ] **Supabase CLI** installed (`npm install -g supabase`)

### ✅ Account Creation
- [ ] **Supabase account** created at [supabase.com](https://supabase.com)
- [ ] **Vercel account** created at [vercel.com](https://vercel.com)
- [ ] **OpenAI account** with API access at [platform.openai.com](https://platform.openai.com)
- [ ] **Google Cloud account** for Drive API at [console.cloud.google.com](https://console.cloud.google.com)
- [ ] **Evolution API** instance deployed (Docker/VPS)

## 🔧 Configuration Steps

### ✅ Supabase Setup
- [ ] New Supabase project created
- [ ] Project URL and anon key copied
- [ ] Database schema migration run (`docs/database/01_initial_schema.sql`)
- [ ] RLS policies applied (`docs/database/02_rls_policies.sql`)
- [ ] Vector extension enabled (`CREATE EXTENSION vector;`)
- [ ] Storage bucket created for file uploads
- [ ] Real-time subscriptions enabled

### ✅ Evolution API Setup
- [ ] Evolution API deployed via Docker
- [ ] API key generated and secured
- [ ] Webhook URL configured
- [ ] SSL certificates configured
- [ ] Instance connectivity tested

### ✅ Google Drive API Setup
- [ ] Google Cloud project created
- [ ] Drive API enabled
- [ ] OAuth 2.0 credentials created
- [ ] Authorized domains configured
- [ ] Redirect URIs set up

### ✅ OpenAI API Setup
- [ ] API key generated
- [ ] Usage limits configured
- [ ] Billing setup completed

## 🌐 Vercel Deployment

### ✅ Initial Setup
- [ ] Repository connected to Vercel
- [ ] Build settings configured
- [ ] Environment variables added:
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_ANON_KEY`
  - [ ] `VITE_EVOLUTION_API_URL`
  - [ ] `VITE_EVOLUTION_API_KEY`
  - [ ] `VITE_OPENAI_API_KEY`
  - [ ] `VITE_GOOGLE_CLIENT_ID`
  - [ ] `VITE_APP_URL`
  - [ ] `VITE_WEBHOOK_URL`

### ✅ Build & Deploy
- [ ] Local build test successful (`npm run build`)
- [ ] TypeScript compilation successful (`npm run type-check`)
- [ ] Linting passed (`npm run lint`)
- [ ] Vercel deployment initiated (`vercel --prod`)
- [ ] Deployment URL received and accessible

### ✅ Domain Setup (Optional)
- [ ] Custom domain added in Vercel dashboard
- [ ] DNS records configured
- [ ] SSL certificate issued
- [ ] Domain propagation verified

## 🔍 Post-Deployment Testing

### ✅ Core Functionality
- [ ] **Homepage loads** without errors
- [ ] **Authentication works** (sign up/login)
- [ ] **Dashboard accessible** after login
- [ ] **Navigation functional** between pages

### ✅ WhatsApp Integration
- [ ] **Instance creation** works
- [ ] **QR code generation** displays
- [ ] **Connection status** updates correctly
- [ ] **Webhook endpoints** receiving data

### ✅ RAG System
- [ ] **Document upload** functional
- [ ] **File processing** completes successfully
- [ ] **Vector search** returns relevant results
- [ ] **AI responses** generated correctly

### ✅ Real-time Features
- [ ] **Live updates** working (conversations, messages)
- [ ] **WebSocket connections** stable
- [ ] **Multiple sessions** working simultaneously

### ✅ Performance & Security
- [ ] **Page load times** acceptable (<3 seconds)
- [ ] **Security headers** present
- [ ] **HTTPS** enforced
- [ ] **API endpoints** secured with authentication

## 📊 Monitoring Setup

### ✅ Analytics & Tracking
- [ ] **Error tracking** configured (Sentry recommended)
- [ ] **Performance monitoring** enabled
- [ ] **Usage analytics** set up
- [ ] **Uptime monitoring** configured

### ✅ Logging
- [ ] **Application logs** accessible
- [ ] **Error logs** monitored
- [ ] **API request logs** tracked
- [ ] **Database query logs** reviewed

## 🚨 Troubleshooting

### Common Issues & Solutions

#### Build Failures
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json .vite
npm install
npm run build
```

#### Environment Variables
```bash
# Verify all required env vars are set
vercel env ls
# Add missing variables
vercel env add VARIABLE_NAME
```

#### Database Connection
```sql
-- Test Supabase connection
SELECT version();
-- Check RLS policies
SELECT * FROM pg_policies;
```

#### CORS Issues
- Verify Evolution API CORS configuration
- Check Vercel headers in `vercel.json`
- Ensure proper domain configuration

## 📈 Post-Launch Tasks

### ✅ Immediate (First 24 Hours)
- [ ] Monitor error logs and fix critical issues
- [ ] Verify all integrations working
- [ ] Test user workflows end-to-end
- [ ] Check performance metrics

### ✅ Short-term (First Week)
- [ ] Gather user feedback
- [ ] Monitor usage patterns
- [ ] Optimize performance bottlenecks
- [ ] Document any deployment issues

### ✅ Long-term (First Month)
- [ ] Set up automated backups
- [ ] Implement CI/CD pipeline
- [ ] Scale infrastructure as needed
- [ ] Plan feature updates

## 🆘 Emergency Procedures

### Rollback Steps
1. **Immediate:** Use Vercel dashboard to revert to previous deployment
2. **Database:** Have migration rollback scripts ready
3. **External APIs:** Ensure fallback configurations available

### Emergency Contacts
- **Technical Lead:** [Your contact info]
- **Supabase Support:** [Support details]
- **Vercel Support:** [Support details]
- **Evolution API Support:** [Support details]

---

## ✅ Final Verification

- [ ] All checklist items completed
- [ ] Application accessible to end users
- [ ] All core features functional
- [ ] Monitoring and alerts active
- [ ] Documentation updated
- [ ] Team notified of successful deployment

**Deployment Date:** ___________  
**Deployed by:** ___________  
**Version:** ___________  
**Production URL:** ___________

---

**🎉 Congratulations! Your WhatsApp AI Customer Support Assistant is now live!**

*Keep this checklist for future deployments and updates.*

## Environment Variables

### Required Variables
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_ANON_KEY`
- [ ] `VITE_EVOLUTION_API_URL`
- [ ] `VITE_EVOLUTION_API_KEY`

### Optional Variables
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (for migrations and admin operations)
- [ ] `NODE_ENV`
- [ ] `VITE_APP_ENV` (development/staging/production)

## Database
- [ ] Run all migrations
- [ ] Check RLS policies
- [ ] Verify table constraints
- [ ] Test user authentication

## Evolution API
- [ ] Instance is running
- [ ] API key is valid
- [ ] Webhook URL is configured
- [ ] Test connection

## Frontend
- [ ] Build succeeds locally
- [ ] All environment variables are set
- [ ] Static assets are served correctly
- [ ] Routes work as expected

## Testing
- [ ] Run unit tests
- [ ] Run integration tests
- [ ] Test WhatsApp connection
- [ ] Test chat functionality
- [ ] Verify file uploads

## Monitoring
- [ ] Error tracking is configured
- [ ] Performance monitoring is set up
- [ ] Database monitoring is active
- [ ] API monitoring is enabled

## Security
- [ ] SSL/TLS is enabled
- [ ] API keys are secured
- [ ] RLS policies are active
- [ ] CORS is configured properly

## Backup
- [ ] Database backup is configured
- [ ] File storage backup is set up
- [ ] Disaster recovery plan is in place

## Documentation
- [ ] API documentation is updated
- [ ] Deployment guide is current
- [ ] Environment variables are documented
- [ ] Known issues are documented 