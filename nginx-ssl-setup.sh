#!/bin/bash

# Nginx + SSL Setup Script for Evolution API
# Domain: https://evo.istn.ac.id
# Server: 45.32.114.86

set -e

echo "🚀 Setting up Nginx with SSL for Evolution API..."

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

# Server details
SERVER_HOST="45.32.114.86"
SERVER_USER="root"
DOMAIN="evo.istn.ac.id"
EMAIL="admin@istn.ac.id"

print_status "Creating Nginx configuration files..."

# Create nginx configuration directory
mkdir -p nginx-config

# Create Nginx configuration for Evolution API
cat > nginx-config/evo.istn.ac.id.conf << 'NGINXEOF'
# HTTP redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name evo.istn.ac.id;
    
    # Let's Encrypt challenge location
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS configuration
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name evo.istn.ac.id;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/evo.istn.ac.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/evo.istn.ac.id/privkey.pem;
    
    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # HSTS (HTTP Strict Transport Security)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # CORS headers for Evolution API
    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization, apikey" always;
    
    # Handle preflight requests
    location / {
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "*";
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization, apikey";
            add_header Access-Control-Max-Age 86400;
            add_header Content-Type "text/plain charset=UTF-8";
            add_header Content-Length 0;
            return 204;
        }
        
        # Proxy to Evolution API
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        proxy_cache_bypass $http_upgrade;
        
        # Increase proxy timeouts for long-running requests
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Increase buffer sizes
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
    }
    
    # WebSocket support for real-time features
    location /socket.io/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 10240;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;
        
    # Logging
    access_log /var/log/nginx/evo.istn.ac.id.access.log;
    error_log /var/log/nginx/evo.istn.ac.id.error.log;
}
NGINXEOF

# Create SSL setup script for the server
cat > nginx-config/setup-ssl.sh << 'SSLEOF'
#!/bin/bash

echo "🔧 Setting up Nginx with SSL for Evolution API..."

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Variables
DOMAIN="evo.istn.ac.id"
EMAIL="admin@istn.ac.id"

# Update system
print_status "Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq

# Install Nginx
print_status "Installing Nginx..."
apt-get install -y nginx

# Install Certbot for Let's Encrypt
print_status "Installing Certbot..."
apt-get install -y certbot python3-certbot-nginx

# Create web root directory
print_status "Creating web root directory..."
mkdir -p /var/www/html

# Stop Nginx temporarily
print_status "Stopping Nginx temporarily..."
systemctl stop nginx

# Obtain SSL certificate
print_status "Obtaining SSL certificate for $DOMAIN..."
certbot certonly --standalone -d $DOMAIN --email $EMAIL --agree-tos --non-interactive

# Copy Nginx configuration
print_status "Setting up Nginx configuration..."
cp evo.istn.ac.id.conf /etc/nginx/sites-available/
ln -sf /etc/nginx/sites-available/evo.istn.ac.id.conf /etc/nginx/sites-enabled/

# Remove default Nginx site
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
print_status "Testing Nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
    print_status "Nginx configuration is valid"
else
    print_error "Nginx configuration has errors"
    exit 1
fi

# Start and enable Nginx
print_status "Starting Nginx..."
systemctl start nginx
systemctl enable nginx

# Setup automatic certificate renewal
print_status "Setting up automatic certificate renewal..."
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -

# Configure firewall
print_status "Configuring firewall..."
ufw allow 'Nginx Full'
ufw allow OpenSSH
ufw --force enable

# Test SSL certificate
print_status "Testing SSL certificate..."
sleep 5
curl -I https://$DOMAIN

if [ $? -eq 0 ]; then
    print_status "✅ SSL setup completed successfully!"
    echo ""
    echo "🎉 Evolution API is now available at:"
    echo "🌐 HTTPS: https://$DOMAIN"
    echo "🔒 SSL Certificate: Valid and active"
    echo "🔄 Auto-renewal: Configured"
    echo ""
    echo "📋 Service status:"
    systemctl status nginx --no-pager -l
    echo ""
    echo "🔍 Certificate info:"
    certbot certificates
else
    print_error "❌ SSL setup failed or domain not accessible"
fi
SSLEOF

chmod +x nginx-config/setup-ssl.sh

# Create deployment archive
print_status "Creating SSL deployment package..."
tar -czf nginx-ssl-deploy.tar.gz -C nginx-config .

print_status "✅ Nginx SSL configuration created successfully!"
echo ""
print_instruction "📋 Deployment Instructions:"
echo ""
print_instruction "⚠️  IMPORTANT: First ensure DNS is configured:"
print_instruction "   - Point evo.istn.ac.id A record to 45.32.114.86"
print_instruction "   - Wait for DNS propagation (may take up to 24 hours)"
print_instruction "   - Verify with: nslookup evo.istn.ac.id"
echo ""
print_instruction "1. Transfer the SSL package to your server:"
echo "   scp nginx-ssl-deploy.tar.gz root@45.32.114.86:/tmp/"
echo ""
print_instruction "2. Connect to your server:"
echo "   ssh root@45.32.114.86"
echo ""
print_instruction "3. Extract and run the SSL setup:"
echo "   cd /tmp"
echo "   tar -xzf nginx-ssl-deploy.tar.gz"
echo "   chmod +x setup-ssl.sh"
echo "   ./setup-ssl.sh"
echo ""
print_instruction "4. Test the deployment:"
echo "   curl -I https://evo.istn.ac.id"
echo ""

# Show quick copy-paste commands
echo ""
print_warning "🚀 Quick Copy-Paste Commands:"
echo ""
echo "# DNS Check first:"
echo "nslookup evo.istn.ac.id"
echo ""
echo "# On your local machine:"
echo "scp nginx-ssl-deploy.tar.gz root@45.32.114.86:/tmp/"
echo ""
echo "# On the server:"
echo "cd /tmp && tar -xzf nginx-ssl-deploy.tar.gz"
echo "chmod +x setup-ssl.sh && ./setup-ssl.sh"
echo ""

print_status "🎯 SSL deployment package ready: nginx-ssl-deploy.tar.gz"
print_status "📁 Package contents:"
ls -la nginx-ssl-deploy.tar.gz
echo ""
print_status "🔍 Archive contents:"
tar -tzf nginx-ssl-deploy.tar.gz

# Cleanup
print_status "🧹 Cleaning up temporary files..."
rm -rf nginx-config

print_warning "⚠️  Remember to configure DNS before running the SSL setup!"
print_status "   Add A record: evo.istn.ac.id -> 45.32.114.86"
