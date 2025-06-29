#!/bin/bash

# Evolution API Deployment Script
# Server: 45.32.114.86
# User: root

set -e

echo "🚀 Starting Evolution API Deployment..."

# Server details
SERVER_HOST="45.32.114.86"
SERVER_USER="root"
SERVER_PASS="8z!AFSD2gkgNhS}h"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Check if sshpass is installed
if ! command -v sshpass &> /dev/null; then
    print_error "sshpass is required but not installed."
    print_status "Installing sshpass..."
    
    # Install sshpass based on OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install hudochenkov/sshpass/sshpass
        else
            print_error "Homebrew is required to install sshpass on macOS"
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command -v apt-get &> /dev/null; then
            sudo apt-get update && sudo apt-get install -y sshpass
        elif command -v yum &> /dev/null; then
            sudo yum install -y sshpass
        else
            print_error "Could not install sshpass. Please install it manually."
            exit 1
        fi
    else
        print_error "Unsupported OS for automatic sshpass installation"
        exit 1
    fi
fi

print_status "Creating deployment directory..."
DEPLOY_DIR="evolution-api-deploy"
mkdir -p $DEPLOY_DIR

# Copy necessary files
print_status "Copying deployment files..."
cp docker-compose.yml $DEPLOY_DIR/
cp -r supabase/ $DEPLOY_DIR/ 2>/dev/null || true

# Create environment file with updated values
print_status "Creating environment configuration..."
cat > $DEPLOY_DIR/.env << EOF
# Redis Cache Configuration
CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=redis://localhost:6379/6
CACHE_REDIS_TTL=604800
CACHE_REDIS_PREFIX_KEY=evolution
CACHE_REDIS_SAVE_INSTANCES=false

# Session Phone Configuration
CONFIG_SESSION_PHONE_VERSION=2.3000.1023204200
CONFIG_SESSION_PHONE_CLIENT=Evolution API
CONFIG_SESSION_PHONE_NAME=Chrome

# Server Configuration
SERVER_TYPE=http
SERVER_PORT=8080
CORS_ORIGIN=*

# Database Configuration
DATABASE_ENABLED=true
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://evolution:evolution123@postgres:5432/evolution

# Authentication
AUTHENTICATION_TYPE=apikey
AUTHENTICATION_API_KEY=YGyPcZ5tn8RfmaATbP5ou9bOP4Usc7Pk4G0k04p9G7iNMpWqbNhga2FOl6T7ud26

# Webhook Configuration
WEBHOOK_GLOBAL_URL=https://wacanda.vercel.app/api/webhook
WEBHOOK_GLOBAL_ENABLED=true

# Storage Settings
STORE_MESSAGES=true
STORE_MESSAGE_UP=true
STORE_CONTACTS=true
STORE_CHATS=true
EOF

# Create deployment script for remote server
print_status "Creating remote deployment script..."
cat > $DEPLOY_DIR/remote-deploy.sh << 'EOF'
#!/bin/bash

echo "🔧 Setting up Evolution API on remote server..."

# Update system
apt-get update

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl enable docker
    systemctl start docker
fi

# Install Docker Compose if not present
if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# Create evolution directory
mkdir -p /opt/evolution-api
cd /opt/evolution-api

# Stop existing containers if running
docker-compose down || true

# Remove old containers and volumes if they exist
docker container prune -f || true
docker volume prune -f || true

echo "✅ Docker setup complete"
EOF

print_status "Transferring files to server..."

# Create the deployment archive
cd $DEPLOY_DIR
tar -czf ../evolution-deploy.tar.gz .
cd ..

# Transfer files to server
sshpass -p "$SERVER_PASS" scp -o StrictHostKeyChecking=no evolution-deploy.tar.gz $SERVER_USER@$SERVER_HOST:/tmp/

print_status "Executing deployment on remote server..."

# Execute deployment commands on remote server
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST << 'ENDSSH'
set -e

echo "📦 Extracting deployment files..."
cd /opt
rm -rf evolution-api || true
mkdir -p evolution-api
cd evolution-api
tar -xzf /tmp/evolution-deploy.tar.gz

echo "🔧 Setting up Docker..."
# Update system
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl enable docker
    systemctl start docker
    rm get-docker.sh
fi

# Install Docker Compose if not present
if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

echo "🚀 Starting Evolution API services..."
# Stop any existing services
docker-compose down || true

# Pull latest images
docker-compose pull

# Start services
docker-compose up -d

echo "⏳ Waiting for services to start..."
sleep 30

echo "🔍 Checking service status..."
docker-compose ps

echo "📋 Service logs:"
docker-compose logs --tail=20

echo "✅ Evolution API deployment completed!"
echo "🌐 API will be available at: http://45.32.114.86:8080"
echo "📚 Documentation: http://45.32.114.86:8080/manager"

# Cleanup
rm /tmp/evolution-deploy.tar.gz
ENDSSH

if [ $? -eq 0 ]; then
    print_status "✅ Deployment completed successfully!"
    print_status "🌐 Evolution API is available at: http://45.32.114.86:8080"
    print_status "📚 API Documentation: http://45.32.114.86:8080/manager"
    print_status "🔑 API Key: YGyPcZ5tn8RfmaATbP5ou9bOP4Usc7Pk4G0k04p9G7iNMpWqbNhga2FOl6T7ud26"
else
    print_error "❌ Deployment failed!"
    exit 1
fi

# Cleanup local files
print_status "🧹 Cleaning up local deployment files..."
rm -rf $DEPLOY_DIR evolution-deploy.tar.gz

print_status "🎉 Deployment process completed!" 