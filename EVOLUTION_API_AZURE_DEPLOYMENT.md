# Evolution API Deployment Guide - Azure VM

## Overview

This comprehensive guide covers deploying Evolution API (WhatsApp Business API) on Azure Virtual Machine using Docker. Evolution API is a powerful WhatsApp integration solution that supports both Baileys (multi-device) and WhatsApp Business Cloud API.

## Prerequisites

- Azure CLI installed and configured
- Azure subscription with contributor permissions
- SSH client (Terminal on macOS/Linux, PuTTY on Windows)
- Basic knowledge of Docker and Linux commands

## Architecture Overview

```
Internet → Azure Load Balancer → VM (Ubuntu 22.04)
                                 ├── Docker Engine
                                 ├── Evolution API Container
                                 ├── PostgreSQL (Azure Database)
                                 └── Redis (Azure Cache)
```

## Phase 1: Azure Infrastructure Setup

### 1.1 Login and Set Subscription

```bash
# Login to Azure
az login

# List subscriptions
az account list --output table

# Set active subscription
az account set --subscription "your-subscription-id"
```

### 1.2 Create Resource Group

```bash
# Create resource group in your preferred region
az group create \
  --name evolution-api-rg \
  --location eastus
```

### 1.3 Create PostgreSQL Database

```bash
# Create PostgreSQL Flexible Server
az postgres flexible-server create \
  --resource-group evolution-api-rg \
  --name evolution-postgres-$(date +%s) \
  --admin-user evolutionadmin \
  --admin-password "Evolution@2024!" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --public-access 0.0.0.0 \
  --storage-size 32 \
  --location eastus \
  --version 14

# Create evolution database
az postgres flexible-server db create \
  --resource-group evolution-api-rg \
  --server-name evolution-postgres-$(date +%s) \
  --database-name evolution

# Configure firewall to allow Azure services
az postgres flexible-server firewall-rule create \
  --resource-group evolution-api-rg \
  --name evolution-postgres-$(date +%s) \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### 1.4 Create Redis Cache

```bash
# Create Redis cache
az redis create \
  --resource-group evolution-api-rg \
  --name evolution-redis-$(date +%s) \
  --location eastus \
  --sku Basic \
  --vm-size c0 \
  --enable-non-ssl-port

# Get Redis connection details
az redis show \
  --resource-group evolution-api-rg \
  --name evolution-redis-$(date +%s) \
  --query "{hostname:hostName,port:port,sslPort:sslPort}"

# Get Redis access keys
az redis list-keys \
  --resource-group evolution-api-rg \
  --name evolution-redis-$(date +%s)
```

## Phase 2: Virtual Machine Setup

### 2.1 Create SSH Key Pair

```bash
# Generate SSH key pair
ssh-keygen -t rsa -b 4096 -f ~/.ssh/evolution-vm-key -N ""

# Set proper permissions
chmod 600 ~/.ssh/evolution-vm-key
chmod 644 ~/.ssh/evolution-vm-key.pub
```

### 2.2 Create Virtual Machine

```bash
# Create VM with Ubuntu 22.04
az vm create \
  --resource-group evolution-api-rg \
  --name evolution-vm \
  --image Ubuntu2204 \
  --size Standard_B2s \
  --admin-username azureuser \
  --ssh-key-values ~/.ssh/evolution-vm-key.pub \
  --location eastus \
  --public-ip-sku Standard \
  --storage-sku Premium_LRS

# Open required ports
az vm open-port \
  --resource-group evolution-api-rg \
  --name evolution-vm \
  --port 8080 \
  --priority 1000

az vm open-port \
  --resource-group evolution-api-rg \
  --name evolution-vm \
  --port 443 \
  --priority 1001

# Get VM public IP
VM_IP=$(az vm show \
  --resource-group evolution-api-rg \
  --name evolution-vm \
  --show-details \
  --query publicIps \
  --output tsv)

echo "VM Public IP: $VM_IP"
```

## Phase 3: VM Configuration

### 3.1 Connect to VM

```bash
# Connect to VM
ssh -i ~/.ssh/evolution-vm-key azureuser@$VM_IP
```

### 3.2 System Updates and Dependencies

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y \
  curl \
  wget \
  git \
  unzip \
  software-properties-common \
  apt-transport-https \
  ca-certificates \
  gnupg \
  lsb-release \
  htop \
  nano \
  ufw

# Configure firewall
sudo ufw allow ssh
sudo ufw allow 8080
sudo ufw allow 443
sudo ufw --force enable
```

### 3.3 Install Docker

```bash
# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker $USER

# Apply group changes
newgrp docker

# Verify Docker installation
docker --version
docker compose version
```

## Phase 4: Evolution API Deployment

### 4.1 Create Project Structure

```bash
# Create project directory
mkdir -p ~/evolution-api/{data,logs,ssl}
cd ~/evolution-api

# Create necessary directories
mkdir -p data/instances
mkdir -p data/store
```

### 4.2 Create Docker Compose Configuration

```bash
# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  evolution-api:
    container_name: evolution_api
    image: atendai/evolution-api:v2.1.1
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      # Server Configuration
      - SERVER_TYPE=http
      - SERVER_PORT=8080
      - CORS_ORIGIN=*
      - CORS_METHODS=POST,GET,PUT,DELETE
      - CORS_CREDENTIALS=true
      
      # Logging
      - LOG_LEVEL=ERROR
      - LOG_COLOR=true
      - LOG_BAILEYS=error
      
      # Database (Replace with your PostgreSQL connection string)
      - DATABASE_ENABLED=true
      - DATABASE_PROVIDER=postgresql
      - DATABASE_CONNECTION_URI=${DATABASE_URL}
      - DATABASE_CONNECTION_CLIENT_NAME=evolution_api
      
      # Redis (Replace with your Redis connection string)
      - REDIS_ENABLED=true
      - REDIS_URI=${REDIS_URL}
      
      # Authentication
      - AUTHENTICATION_TYPE=apikey
      - AUTHENTICATION_API_KEY=${API_KEY}
      - AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true
      
      # QR Code Settings
      - QRCODE_LIMIT=30
      - QRCODE_COLOR=#198754
      
      # Webhook Settings
      - WEBHOOK_GLOBAL_URL=${WEBHOOK_URL}
      - WEBHOOK_GLOBAL_ENABLED=false
      - WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS=false
      
      # Session Configuration
      - CONFIG_SESSION_PHONE_CLIENT=Evolution API
      - CONFIG_SESSION_PHONE_NAME=Chrome
      
      # Instance Settings
      - DEL_INSTANCE=false
      - DEL_TEMP_INSTANCES=true
      
      # Storage Settings
      - STORE_MESSAGES=true
      - STORE_MESSAGE_UP=true
      - STORE_CONTACTS=true
      - STORE_CHATS=true
      
    volumes:
      - ./data/instances:/evolution/instances
      - ./data/store:/evolution/store
      - ./logs:/evolution/logs
    networks:
      - evolution-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

networks:
  evolution-network:
    driver: bridge

volumes:
  evolution_instances:
  evolution_store:
EOF
```

### 4.3 Create Environment Configuration

```bash
# Create .env file with your specific values
cat > .env << 'EOF'
# Database Configuration (Replace with your PostgreSQL details)
DATABASE_URL=postgresql://evolutionadmin:Evolution@2024!@evolution-postgres-XXXXX.postgres.database.azure.com:5432/evolution?sslmode=require

# Redis Configuration (Replace with your Redis details)
REDIS_URL=redis://:YOUR_REDIS_KEY@evolution-redis-XXXXX.redis.cache.windows.net:6380

# API Security
API_KEY=your-secure-api-key-here-make-it-long-and-random

# Webhook URL (Optional - for receiving WhatsApp events)
WEBHOOK_URL=https://your-webhook-endpoint.com/webhook

# Additional Settings
INSTANCE_EXPIRY_TIME=3600
MAX_INSTANCES=50
EOF

# Secure the environment file
chmod 600 .env
```

### 4.4 Generate Secure API Key

```bash
# Generate a secure API key
API_KEY=$(openssl rand -hex 32)
echo "Generated API Key: $API_KEY"

# Update .env file with the generated key
sed -i "s/your-secure-api-key-here-make-it-long-and-random/$API_KEY/g" .env
```

### 4.5 Deploy Evolution API

```bash
# Pull the latest image
docker compose pull

# Start Evolution API
docker compose up -d

# Check container status
docker compose ps

# View logs
docker compose logs -f evolution-api

# Test API endpoint
curl -H "apikey: $API_KEY" http://localhost:8080/
```

## Phase 5: SSL/TLS Configuration (Optional but Recommended)

### 5.1 Install Nginx

```bash
# Install Nginx
sudo apt install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 5.2 Configure Nginx Reverse Proxy

```bash
# Create Nginx configuration
sudo tee /etc/nginx/sites-available/evolution-api << 'EOF'
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;  # Replace with your domain
    
    # SSL Configuration (you'll need to obtain SSL certificates)
    ssl_certificate /etc/ssl/certs/your-cert.pem;
    ssl_certificate_key /etc/ssl/private/your-key.pem;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # Proxy to Evolution API
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}
EOF

# Enable the site
sudo ln -s /etc/nginx/sites-available/evolution-api /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## Phase 6: WhatsApp Instance Management

### 6.1 Create WhatsApp Instance

```bash
# Set your API key
API_KEY="your-api-key-here"
VM_IP="your-vm-ip-here"

# Create a new WhatsApp instance
curl -X POST "http://$VM_IP:8080/instance/create" \
  -H "Content-Type: application/json" \
  -H "apikey: $API_KEY" \
  -d '{
    "instanceName": "my-whatsapp-bot",
    "token": "my-instance-token",
    "qrcode": true,
    "integration": "BAILEYS"
  }'
```

### 6.2 Get QR Code for WhatsApp Connection

```bash
# Get QR code
curl -X GET "http://$VM_IP:8080/instance/connect/my-whatsapp-bot" \
  -H "apikey: $API_KEY"

# The response will include a base64 QR code that you can scan with WhatsApp
```

### 6.3 Check Instance Status

```bash
# Check instance status
curl -X GET "http://$VM_IP:8080/instance/connectionState/my-whatsapp-bot" \
  -H "apikey: $API_KEY"

# List all instances
curl -X GET "http://$VM_IP:8080/instance/fetchInstances" \
  -H "apikey: $API_KEY"
```

## Phase 7: Monitoring and Maintenance

### 7.1 Setup Log Rotation

```bash
# Create logrotate configuration
sudo tee /etc/logrotate.d/evolution-api << 'EOF'
/home/azureuser/evolution-api/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF
```

### 7.2 Create Backup Script

```bash
# Create backup script
cat > ~/backup-evolution.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/home/azureuser/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup Evolution API data
tar -czf "$BACKUP_DIR/evolution-data-$DATE.tar.gz" \
  -C /home/azureuser/evolution-api data/

# Keep only last 7 backups
find $BACKUP_DIR -name "evolution-data-*.tar.gz" -mtime +7 -delete

echo "Backup completed: evolution-data-$DATE.tar.gz"
EOF

# Make script executable
chmod +x ~/backup-evolution.sh

# Add to crontab for daily backups
(crontab -l 2>/dev/null; echo "0 2 * * * /home/azureuser/backup-evolution.sh") | crontab -
```

### 7.3 System Monitoring

```bash
# Create monitoring script
cat > ~/monitor-evolution.sh << 'EOF'
#!/bin/bash

# Check if Evolution API container is running
if ! docker compose -f /home/azureuser/evolution-api/docker-compose.yml ps | grep -q "Up"; then
    echo "Evolution API container is down. Restarting..."
    cd /home/azureuser/evolution-api
    docker compose restart
    
    # Send notification (optional - configure with your notification service)
    # curl -X POST "https://your-notification-webhook.com" \
    #   -d "Evolution API was restarted on $(hostname) at $(date)"
fi

# Check disk space
DISK_USAGE=$(df /home | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "Warning: Disk usage is at ${DISK_USAGE}%"
fi

# Check memory usage
MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100.0)}')
if [ $MEMORY_USAGE -gt 80 ]; then
    echo "Warning: Memory usage is at ${MEMORY_USAGE}%"
fi
EOF

# Make script executable
chmod +x ~/monitor-evolution.sh

# Add to crontab for monitoring every 5 minutes
(crontab -l 2>/dev/null; echo "*/5 * * * * /home/azureuser/monitor-evolution.sh") | crontab -
```

## Phase 8: Security Hardening

### 8.1 Configure Fail2Ban

```bash
# Install Fail2Ban
sudo apt install -y fail2ban

# Create custom jail for Evolution API
sudo tee /etc/fail2ban/jail.d/evolution-api.conf << 'EOF'
[evolution-api]
enabled = true
port = 8080
filter = evolution-api
logpath = /home/azureuser/evolution-api/logs/*.log
maxretry = 5
bantime = 3600
findtime = 600
EOF

# Create filter for Evolution API
sudo tee /etc/fail2ban/filter.d/evolution-api.conf << 'EOF'
[Definition]
failregex = ^.*\[.*\] .*"GET .* HTTP/1\.1" 401 .*$
            ^.*\[.*\] .*"POST .* HTTP/1\.1" 401 .*$
ignoreregex =
EOF

# Restart Fail2Ban
sudo systemctl restart fail2ban
```

### 8.2 Update System Packages Automatically

```bash
# Install unattended-upgrades
sudo apt install -y unattended-upgrades

# Configure automatic updates
sudo dpkg-reconfigure -plow unattended-upgrades
```

## Phase 9: Testing and Validation

### 9.1 API Health Check

```bash
# Test API health
curl -H "apikey: $API_KEY" "http://$VM_IP:8080/"

# Expected response: {"status":"ok","message":"Evolution API is running"}
```

### 9.2 Send Test Message

```bash
# Send a test message (replace with actual phone number)
curl -X POST "http://$VM_IP:8080/message/sendText/my-whatsapp-bot" \
  -H "Content-Type: application/json" \
  -H "apikey: $API_KEY" \
  -d '{
    "number": "5511999999999",
    "text": "Hello from Evolution API!"
  }'
```

## Troubleshooting

### Common Issues and Solutions

1. **Container won't start**
   ```bash
   # Check logs
   docker compose logs evolution-api
   
   # Check system resources
   docker system df
   free -h
   df -h
   ```

2. **Database connection issues**
   ```bash
   # Test PostgreSQL connection
   docker run --rm -it postgres:14 psql "$DATABASE_URL"
   ```

3. **Redis connection issues**
   ```bash
   # Test Redis connection
   docker run --rm -it redis:alpine redis-cli -u "$REDIS_URL" ping
   ```

4. **WhatsApp connection problems**
   - Ensure QR code is scanned within the time limit
   - Check if phone has internet connection
   - Verify WhatsApp is not connected on another device

### Useful Commands

```bash
# View Evolution API logs
docker compose logs -f evolution-api

# Restart Evolution API
docker compose restart evolution-api

# Update Evolution API
docker compose pull && docker compose up -d

# Check system resources
htop
df -h
free -h

# Monitor network connections
netstat -tulpn | grep :8080
```

## Conclusion

Your Evolution API is now deployed and ready for WhatsApp integration. Key points to remember:

1. **Security**: Keep your API key secure and use HTTPS in production
2. **Monitoring**: Regularly check logs and system resources
3. **Backups**: Ensure regular backups of your instance data
4. **Updates**: Keep Evolution API and system packages updated
5. **Scaling**: Monitor usage and scale resources as needed

For production use, consider:
- Setting up a domain name with SSL certificates
- Implementing proper monitoring and alerting
- Using Azure Application Gateway for load balancing
- Setting up automated backups to Azure Storage

## Support and Resources

- [Evolution API Documentation](https://doc.evolution-api.com/)
- [Evolution API GitHub](https://github.com/EvolutionAPI/evolution-api)
- [WhatsApp Business API Documentation](https://developers.facebook.com/docs/whatsapp)
- [Azure Documentation](https://docs.microsoft.com/en-us/azure/)

---

**Note**: Replace placeholder values (API keys, database URLs, domain names) with your actual values before deployment.