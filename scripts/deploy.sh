#!/bin/bash

# =============================================================================
# WhatsApp AI Customer Support Assistant - Deployment Script
# =============================================================================
# This script automates the deployment process to Vercel
# Run with: ./scripts/deploy.sh [environment]
# Example: ./scripts/deploy.sh production

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-preview}
BUILD_DIR="dist"
PROJECT_NAME="wa-cs-agent"

# Print functions
print_header() {
    echo -e "${BLUE}======================================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}======================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ is required. Current version: $(node --version)"
        exit 1
    fi
    print_success "Node.js $(node --version) found"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    print_success "npm $(npm --version) found"
    
    # Check Vercel CLI
    if ! command -v vercel &> /dev/null; then
        print_warning "Vercel CLI not found. Installing..."
        npm install -g vercel@latest
        print_success "Vercel CLI installed"
    else
        print_success "Vercel CLI $(vercel --version) found"
    fi
    
    # Check if logged into Vercel
    if ! vercel whoami &> /dev/null; then
        print_warning "Not logged into Vercel. Please login:"
        vercel login
    fi
    print_success "Logged into Vercel as $(vercel whoami)"
}

# Install dependencies
install_dependencies() {
    print_header "Installing Dependencies"
    
    if [ ! -d "node_modules" ]; then
        print_info "Installing npm dependencies..."
        npm ci
        print_success "Dependencies installed"
    else
        print_info "Checking for dependency updates..."
        npm ci
        print_success "Dependencies up to date"
    fi
}

# Run quality checks
run_quality_checks() {
    print_header "Running Quality Checks"
    
    # Type checking
    print_info "Running TypeScript type checking..."
    if npm run type-check; then
        print_success "Type checking passed"
    else
        print_error "Type checking failed"
        exit 1
    fi
    
    # Linting
    print_info "Running ESLint..."
    if npm run lint; then
        print_success "Linting passed"
    else
        print_error "Linting failed"
        exit 1
    fi
    
    # Build test
    print_info "Testing build process..."
    if npm run build; then
        print_success "Build test passed"
    else
        print_error "Build test failed"
        exit 1
    fi
}

# Check environment variables
check_environment() {
    print_header "Checking Environment Configuration"
    
    # List of required environment variables
    REQUIRED_VARS=(
        "SUPABASE_URL"
        "SUPABASE_ANON_KEY"
        "VITE_EVOLUTION_API_URL"
        "VITE_EVOLUTION_API_KEY"
        "VITE_OPENAI_API_KEY"
        "VITE_GOOGLE_CLIENT_ID"
    )
    
    # Check Vercel environment variables
    print_info "Checking Vercel environment variables..."
    
    MISSING_VARS=()
    for var in "${REQUIRED_VARS[@]}"; do
        if ! vercel env ls | grep -q "$var"; then
            MISSING_VARS+=("$var")
        fi
    done
    
    if [ ${#MISSING_VARS[@]} -gt 0 ]; then
        print_warning "Missing environment variables in Vercel:"
        for var in "${MISSING_VARS[@]}"; do
            echo "  - $var"
        done
        echo ""
        print_info "Please add missing variables with: vercel env add VARIABLE_NAME"
        echo "Or add them through the Vercel dashboard: https://vercel.com/dashboard"
        
        read -p "Continue deployment anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Deployment cancelled"
            exit 1
        fi
    else
        print_success "All required environment variables found"
    fi
}

# Deploy to Vercel
deploy_to_vercel() {
    print_header "Deploying to Vercel ($ENVIRONMENT)"
    
    if [ "$ENVIRONMENT" = "production" ]; then
        print_info "Deploying to production..."
        DEPLOY_URL=$(vercel --prod --yes)
    else
        print_info "Deploying to preview..."
        DEPLOY_URL=$(vercel --yes)
    fi
    
    if [ $? -eq 0 ]; then
        print_success "Deployment successful!"
        echo ""
        print_info "🌐 Deployment URL: $DEPLOY_URL"
        echo ""
        
        # Wait a moment for deployment to be ready
        print_info "Waiting for deployment to be ready..."
        sleep 10
        
        # Basic health check
        print_info "Running health check..."
        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOY_URL")
        
        if [ "$HTTP_STATUS" -eq 200 ]; then
            print_success "Health check passed (HTTP $HTTP_STATUS)"
        else
            print_warning "Health check returned HTTP $HTTP_STATUS"
        fi
        
    else
        print_error "Deployment failed"
        exit 1
    fi
}

# Post-deployment tasks
post_deployment() {
    print_header "Post-Deployment Tasks"
    
    print_info "📋 Recommended next steps:"
    echo "  1. Test authentication and core features"
    echo "  2. Verify WhatsApp integration"
    echo "  3. Test document upload and RAG system"
    echo "  4. Check real-time features"
    echo "  5. Monitor error logs and performance"
    echo ""
    
    if [ "$ENVIRONMENT" = "production" ]; then
        print_info "🚨 Production deployment checklist:"
        echo "  - Monitor application for the next 30 minutes"
        echo "  - Check error tracking (Sentry/logs)"
        echo "  - Verify all external integrations"
        echo "  - Test user workflows end-to-end"
        echo "  - Update team/stakeholders"
        echo ""
    fi
    
    print_info "📊 Useful links:"
    echo "  - Vercel Dashboard: https://vercel.com/dashboard"
    echo "  - Deployment URL: $DEPLOY_URL"
    echo "  - Project Analytics: https://vercel.com/analytics"
    echo ""
}

# Main execution
main() {
    clear
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║              WhatsApp AI Customer Support Assistant         ║"
    echo "║                        Deployment Script                    ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    
    print_info "Environment: $ENVIRONMENT"
    print_info "Project: $PROJECT_NAME"
    print_info "Build Directory: $BUILD_DIR"
    echo ""
    
    # Confirm deployment
    if [ "$ENVIRONMENT" = "production" ]; then
        print_warning "You are about to deploy to PRODUCTION!"
        read -p "Are you sure you want to continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Deployment cancelled"
            exit 1
        fi
    fi
    
    # Run deployment steps
    check_prerequisites
    install_dependencies
    run_quality_checks
    check_environment
    deploy_to_vercel
    post_deployment
    
    print_success "🎉 Deployment completed successfully!"
    
    if [ "$ENVIRONMENT" = "production" ]; then
        echo ""
        print_info "🔔 Consider sharing the deployment success:"
        echo "   WhatsApp AI Assistant deployed to production! 🚀"
        echo "   URL: $DEPLOY_URL"
    fi
}

# Handle script termination
trap 'print_error "Deployment interrupted"; exit 130' INT

# Run main function
main "$@" 