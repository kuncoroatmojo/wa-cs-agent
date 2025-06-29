#!/bin/bash

# Remote script to update Evolution API environment
echo "🔧 Updating Evolution API environment variables..."

# Navigate to Evolution API directory
cd ~/evolution-api || {
    echo "❌ Evolution API directory not found"
    exit 1
}

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found in ~/evolution-api/"
    exit 1
fi

# Backup current .env
BACKUP_FILE=".env.backup-$(date +%Y%m%d-%H%M%S)"
cp .env "$BACKUP_FILE"
echo "✅ Backed up .env to $BACKUP_FILE"

# Add or update the environment variable
ENV_VAR="CONFIG_SESSION_PHONE_VERSION=2.3000.1023204200"

# Check if variable already exists
if grep -q "^CONFIG_SESSION_PHONE_VERSION=" .env; then
    # Update existing variable
    sed -i "s/^CONFIG_SESSION_PHONE_VERSION=.*/$ENV_VAR/" .env
    echo "✅ Updated existing CONFIG_SESSION_PHONE_VERSION"
else
    # Add new variable
    echo "$ENV_VAR" >> .env
    echo "✅ Added new CONFIG_SESSION_PHONE_VERSION"
fi

# Verify the change
echo ""
echo "📋 Current CONFIG_SESSION_PHONE_VERSION setting:"
grep "CONFIG_SESSION_PHONE_VERSION" .env

# Show container status before restart
echo ""
echo "📊 Current container status:"
docker compose ps

# Restart Evolution API
echo ""
echo "🔄 Restarting Evolution API containers..."
docker compose down
sleep 3
docker compose up -d

# Wait for containers to start
echo "⏳ Waiting for containers to start..."
sleep 10

# Check final status
echo ""
echo "📊 Final container status:"
docker compose ps

echo ""
echo "🎉 Environment variable update completed!"
echo "📝 You can check logs with: docker compose logs -f evolution-api"
