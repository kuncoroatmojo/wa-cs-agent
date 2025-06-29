# Evolution API Deployment Guide

## Server Information
- **Host**: 45.32.114.86
- **User**: root
- **Password**: 8z!AFSD2gkgNhS}h

## Automatic Deployment

### Option 1: Run Deployment Script
```bash
cd wacanda
./deploy-evolution.sh
```

The script will automatically:
1. Install required dependencies (sshpass)
2. Copy configuration files
3. Transfer files to the server
4. Install Docker and Docker Compose
5. Deploy Evolution API services
6. Start all containers

## Manual Deployment

### Step 1: Connect to Server
```bash
ssh root@45.32.114.86
# Password: 8z!AFSD2gkgNhS}h
```

### Step 2: Install Docker (if not installed)
```bash
# Update system
apt-get update

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
systemctl enable docker
systemctl start docker

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

### Step 3: Create Project Directory
```bash
mkdir -p /opt/evolution-api
cd /opt/evolution-api
```

### Step 4: Create Docker Compose File
```bash
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15
    container_name: evolution_postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: evolution
      POSTGRES_USER: evolution
      POSTGRES_PASSWORD: evolution123
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - evolution-network

  # Redis Cache
  redis:
    image: redis:alpine
    container_name: evolution_redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks:
      - evolution-network

  # Evolution API
  evolution-api:
    image: atendai/evolution-api:v2.1.1
    container_name: evolution_api
    restart: unless-stopped
    ports:
      - "8080:8080"
    depends_on:
      - postgres
      - redis
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
      
      # Database Configuration
      - DATABASE_ENABLED=true
      - DATABASE_PROVIDER=postgresql
      - DATABASE_CONNECTION_URI=postgresql://evolution:evolution123@postgres:5432/evolution
      - DATABASE_CONNECTION_CLIENT_NAME=evolution_api
      
      # Redis Cache Configuration
      - CACHE_REDIS_ENABLED=true
      - CACHE_REDIS_URI=redis://redis:6379/6
      - CACHE_REDIS_TTL=604800
      - CACHE_REDIS_PREFIX_KEY=evolution
      - CACHE_REDIS_SAVE_INSTANCES=false
      - CACHE_LOCAL_ENABLED=true
      
      # Authentication
      - AUTHENTICATION_TYPE=apikey
      - AUTHENTICATION_API_KEY=YGyPcZ5tn8RfmaATbP5ou9bOP4Usc7Pk4G0k04p9G7iNMpWqbNhga2FOl6T7ud26
      - AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true
      
      # QR Code Settings
      - QRCODE_LIMIT=30
      - QRCODE_COLOR=#198754
      
      # Webhook Settings
      - WEBHOOK_GLOBAL_URL=https://wacanda.vercel.app/api/webhook
      - WEBHOOK_GLOBAL_ENABLED=true
      - WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS=true
      
      # Session Configuration
      - CONFIG_SESSION_PHONE_CLIENT=Evolution API
      - CONFIG_SESSION_PHONE_NAME=Chrome
      - CONFIG_SESSION_PHONE_VERSION=2.3000.1023204200
      
      # Instance Settings
      - DEL_INSTANCE=false
      - DEL_TEMP_INSTANCES=true
      
      # Storage Settings
      - STORE_MESSAGES=true
      - STORE_MESSAGE_UP=true
      - STORE_CONTACTS=true
      - STORE_CHATS=true
      
    volumes:
      - evolution_instances:/evolution/instances
      - evolution_store:/evolution/store
      - evolution_logs:/evolution/logs
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
  postgres_data:
  redis_data:
  evolution_instances:
  evolution_store:
  evolution_logs:
EOF
```

### Step 5: Deploy Services
```bash
# Pull latest images
docker-compose pull

# Start services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

## Configuration Details

### Environment Variables Applied
- **CACHE_REDIS_ENABLED**: true
- **CACHE_REDIS_URI**: redis://localhost:6379/6
- **CACHE_REDIS_TTL**: 604800
- **CONFIG_SESSION_PHONE_VERSION**: 2.3000.1023204200

### Service URLs
- **Evolution API**: http://45.32.114.86:8080
- **API Documentation**: http://45.32.114.86:8080/manager
- **Database**: localhost:5432 (internal)
- **Redis**: localhost:6379 (internal)

### Authentication
- **API Key**: `YGyPcZ5tn8RfmaATbP5ou9bOP4Usc7Pk4G0k04p9G7iNMpWqbNhga2FOl6T7ud26`

## Service Management Commands

### Start Services
```bash
cd /opt/evolution-api
docker-compose up -d
```

### Stop Services
```bash
cd /opt/evolution-api
docker-compose down
```

### Restart Services
```bash
cd /opt/evolution-api
docker-compose restart
```

### View Logs
```bash
cd /opt/evolution-api
docker-compose logs -f evolution-api
```

### Check Service Status
```bash
cd /opt/evolution-api
docker-compose ps
```

### Update Services
```bash
cd /opt/evolution-api
docker-compose pull
docker-compose up -d
```

## Troubleshooting

### Check Container Status
```bash
docker ps -a
```

### Check Container Logs
```bash
docker logs evolution_api
docker logs evolution_postgres
docker logs evolution_redis
```

### Restart Individual Services
```bash
docker restart evolution_api
docker restart evolution_postgres
docker restart evolution_redis
```

### Clean Up and Restart
```bash
cd /opt/evolution-api
docker-compose down
docker system prune -f
docker-compose up -d
```

## Testing the Deployment

### Health Check
```bash
curl -f http://45.32.114.86:8080
```

### API Test
```bash
curl -X GET "http://45.32.114.86:8080/manager" \
  -H "apikey: YGyPcZ5tn8RfmaATbP5ou9bOP4Usc7Pk4G0k04p9G7iNMpWqbNhga2FOl6T7ud26"
```

### Create WhatsApp Instance
```bash
curl -X POST "http://45.32.114.86:8080/instance/create" \
  -H "Content-Type: application/json" \
  -H "apikey: YGyPcZ5tn8RfmaATbP5ou9bOP4Usc7Pk4G0k04p9G7iNMpWqbNhga2FOl6T7ud26" \
  -d '{
    "instanceName": "test-instance",
    "integration": "WHATSAPP-BAILEYS"
  }'
```

## Security Considerations

1. **Firewall**: Ensure port 8080 is open
2. **API Key**: Change the default API key in production
3. **Database**: Use strong passwords for PostgreSQL
4. **SSL**: Consider adding SSL/TLS termination
5. **Backups**: Regular database and volume backups

## Monitoring

### Resource Usage
```bash
docker stats
```

### Disk Usage
```bash
docker system df
```

### Service Health
```bash
curl -f http://45.32.114.86:8080/health
```

## Backup and Recovery

### Backup Data
```bash
# Backup PostgreSQL
docker exec evolution_postgres pg_dump -U evolution evolution > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup volumes
docker run --rm -v evolution_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup_$(date +%Y%m%d_%H%M%S).tar.gz /data
```

### Restore Data
```bash
# Restore PostgreSQL
docker exec -i evolution_postgres psql -U evolution -d evolution < backup_file.sql
``` 