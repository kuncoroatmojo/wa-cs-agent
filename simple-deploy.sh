#!/bin/bash

# Simple Evolution API Deployment Script
# This script prepares files locally and provides manual instructions

set -e

echo "🚀 Preparing Evolution API Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_instruction() {
    echo -e "${BLUE}[INSTRUCTION]${NC} $1"
}

print_status "Creating deployment package..."
DEPLOY_DIR="evolution-deploy"
rm -rf $DEPLOY_DIR
mkdir -p $DEPLOY_DIR

# Copy docker-compose file
cp docker-compose.yml $DEPLOY_DIR/

# Create the complete setup script
cat > $DEPLOY_DIR/setup-evolution.sh << 'EOF'
#!/bin/bash

echo "🔧 Setting up Evolution API on server..."

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Update system
print_status "Updating system..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    print_status "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl enable docker
    systemctl start docker
    rm get-docker.sh
    print_status "Docker installed successfully"
else
    print_status "Docker is already installed"
fi

# Install Docker Compose if not present
if ! command -v docker-compose &> /dev/null; then
    print_status "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    print_status "Docker Compose installed successfully"
else
    print_status "Docker Compose is already installed"
fi

# Create evolution directory
print_status "Creating Evolution API directory..."
mkdir -p /opt/evolution-api
cd /opt/evolution-api

# Stop existing containers if running
print_status "Stopping existing containers..."
docker-compose down 2>/dev/null || true

# Clean up old containers and images
print_status "Cleaning up old containers..."
docker container prune -f || true

# Copy docker-compose.yml if it exists in current directory
if [ -f "docker-compose.yml" ]; then
    print_status "Using existing docker-compose.yml"
else
    print_error "docker-compose.yml not found in current directory"
    exit 1
fi

print_status "Pulling latest Docker images..."
docker-compose pull

print_status "Starting Evolution API services..."
docker-compose up -d

print_status "Waiting for services to start..."
sleep 30

print_status "Checking service status..."
docker-compose ps

print_status "Checking Evolution API health..."
for i in {1..10}; do
    if curl -f http://localhost:8080 >/dev/null 2>&1; then
        print_status "✅ Evolution API is running successfully!"
        break
    else
        echo "Waiting for Evolution API to start... ($i/10)"
        sleep 10
    fi
done

echo ""
echo "🎉 Evolution API deployment completed!"
echo "🌐 API available at: http://45.32.114.86:8080"
echo "📚 Documentation: http://45.32.114.86:8080/manager"
echo "🔑 API Key: YGyPcZ5tn8RfmaATbP5ou9bOP4Usc7Pk4G0k04p9G7iNMpWqbNhga2FOl6T7ud26"
echo ""
echo "📋 Service logs:"
docker-compose logs --tail=20
EOF

chmod +x $DEPLOY_DIR/setup-evolution.sh

# Create a compressed archive
print_status "Creating deployment archive..."
tar -czf evolution-deploy.tar.gz -C $DEPLOY_DIR .

print_status "✅ Deployment package created successfully!"
echo ""
print_instruction "📋 Manual Deployment Instructions:"
echo ""
print_instruction "1. Transfer the deployment package to your server:"
echo "   scp evolution-deploy.tar.gz root@45.32.114.86:/tmp/"
echo ""
print_instruction "2. Connect to your server:"
echo "   ssh root@45.32.114.86"
echo "   Password: 8z!AFSD2gkgNhS}h"
echo ""
print_instruction "3. Extract and run the setup script:"
echo "   cd /opt"
echo "   mkdir -p evolution-api"
echo "   cd evolution-api"
echo "   tar -xzf /tmp/evolution-deploy.tar.gz"
echo "   chmod +x setup-evolution.sh"
echo "   ./setup-evolution.sh"
echo ""
print_instruction "4. Test the deployment:"
echo "   curl -f http://45.32.114.86:8080"
echo ""

# Show quick copy-paste commands
echo ""
print_warning "🚀 Quick Copy-Paste Commands:"
echo ""
echo "# On your local machine:"
echo "scp evolution-deploy.tar.gz root@45.32.114.86:/tmp/"
echo ""
echo "# On the server (after SSH login):"
echo "cd /opt && mkdir -p evolution-api && cd evolution-api"
echo "tar -xzf /tmp/evolution-deploy.tar.gz"
echo "chmod +x setup-evolution.sh"
echo "./setup-evolution.sh"
echo ""

print_status "🎯 Deployment package ready: evolution-deploy.tar.gz"
print_status "📁 Package contents:"
ls -la evolution-deploy.tar.gz
echo ""
print_status "🔍 Archive contents:"
tar -tzf evolution-deploy.tar.gz

# Cleanup
print_status "🧹 Cleaning up temporary files..."
rm -rf $DEPLOY_DIR 