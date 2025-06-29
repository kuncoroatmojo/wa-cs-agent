# Redis Connection Analysis Summary

## Current Situation 🔍

Based on the analysis of your Evolution API setup, here's what I found:

### Configuration Status
- **Local Redis URL**: `redis://redis:6379` (Docker container name)
- **External Evolution API**: ❌ Not configured
- **Docker**: ❌ Not running
- **Local Redis**: ❌ Not installed

### The Issue 🚨
The error `getaddrinfo ENOTFOUND redis` occurs because:

1. Your `.env` file is configured for **Docker containers**
2. The hostname `redis` only works inside Docker networks
3. Docker is not currently running on your system
4. No external Evolution API is configured as backup

## Deployment Scenarios Detected 🎯

### 1. Docker Compose Setup (Current Configuration)
- **Status**: Detected but not running
- **Redis Endpoint**: `redis:6379` (container)
- **Requirements**:
  - ✅ Configuration files present
  - ❌ Docker Desktop running
  - ❌ docker-compose.yml file
  - ❌ Evolution API container

## Solutions 💡

### Option 1: Use External Evolution API (Recommended) 🌐
**Best for production and simplicity**

1. **Get a hosted Evolution API service**:
   - Sign up with a provider like [EvolutionAPI.com](https://evolutionapi.com) or similar
   - Or use a cloud service provider

2. **Update your `.env` file**:
   ```env
   # Add these lines to your .env file
   VITE_EVOLUTION_API_URL=https://your-evolution-api-url.com
   VITE_EVOLUTION_API_KEY=your-api-key-here
   ```

3. **Benefits**:
   - ✅ Redis is managed by the provider
   - ✅ No local infrastructure needed
   - ✅ Production-ready
   - ✅ Automatic updates and maintenance

### Option 2: Local Docker Setup 🐳
**Best for development and testing**

1. **Install Docker Desktop**:
   - Download from [docker.com](https://docs.docker.com/desktop/install/mac-install/)
   - Start Docker Desktop

2. **Create docker-compose.yml**:
   ```yaml
   services:
     api:
       container_name: evolution_api
       image: atendai/evolution-api:v2.1.1
       restart: unless-stopped
       ports:
         - "8080:8080"
       env_file:
         - .env
       depends_on:
         - redis
         - postgres
       networks:
         - evolution-net

     redis:
       image: redis:latest
       container_name: redis
       command: redis-server --port 6379 --appendonly yes
       ports:
         - "6379:6379"
       networks:
         - evolution-net

     postgres:
       container_name: postgres
       image: postgres:15
       environment:
         - POSTGRES_USER=evolution
         - POSTGRES_PASSWORD=evolution123
         - POSTGRES_DB=evolution
       ports:
         - "5432:5432"
       networks:
         - evolution-net

   networks:
     evolution-net:
       driver: bridge
   ```

3. **Start the services**:
   ```bash
   docker-compose up -d
   ```

4. **Your Evolution API will be available at**: `http://localhost:8080`

### Option 3: Local Redis Installation 🔴
**For custom setups**

1. **Install Redis locally**:
   ```bash
   # On macOS
   brew install redis
   brew services start redis
   ```

2. **Update your `.env` file**:
   ```env
   # Change redis URL to localhost
   REDIS_URL=redis://localhost:6379
   ```

3. **Install and run Evolution API separately**

## Testing Your Setup ✅

### For External Evolution API:
```bash
# Test the connection
VITE_EVOLUTION_API_URL=your-url VITE_EVOLUTION_API_KEY=your-key node scripts/test-redis-connection.cjs
```

### For Docker Setup:
```bash
# After starting docker-compose
curl -H "apikey: your-api-key" http://localhost:8080/
```

### For Local Redis:
```bash
# Test Redis directly
redis-cli ping
# Should return: PONG
```

## Current Environment Variables 📋

Your current `.env` file shows:
- `REDIS_URL=redis://redis:6379` (Docker container)
- `DATABASE_URL=postgresql://evolution:evolution123@postgres:5432/evolution` (Docker container)
- `API_KEY=215ba1a65be3ae69a4c8b3d09867f012411bc1030bf5d43cbf896b5708a9c8c5`

This configuration is perfect for **Docker setup** but won't work outside containers.

## Recommended Next Steps 🚀

1. **Choose Option 1 (External Evolution API)** for immediate results
2. **Set up Option 2 (Docker)** for development environment
3. **Test the Redis connection** using the provided scripts

## Quick Fix Commands 🔧

### For External API Setup:
```bash
# Add to your .env file
echo "VITE_EVOLUTION_API_URL=https://your-evolution-api-url.com" >> .env
echo "VITE_EVOLUTION_API_KEY=your-api-key-here" >> .env
```

### For Docker Setup:
```bash
# Install Docker Desktop first, then:
docker-compose up -d
```

### Test Connection:
```bash
# Run the diagnosis script
node scripts/redis-connection-diagnosis.cjs
```

## Support 📞

If you need help with any of these options:
1. **External API**: Contact your Evolution API provider
2. **Docker Issues**: Check Docker Desktop documentation
3. **Local Redis**: Check Redis documentation
4. **Configuration**: Review Evolution API environment variable documentation

---

**Note**: The Redis connection error you're seeing is completely normal given your current setup. Choose one of the solutions above to resolve it. 