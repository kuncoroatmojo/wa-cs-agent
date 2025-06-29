# Azure Resources Restart Guide

## Quick Commands to Restart Stopped Azure Resources

### Prerequisites
```bash
# Login to Azure CLI
az login

# List and set subscription
az account list --output table
az account set --subscription "your-subscription-id"
```

### 1. List All Resources in Resource Group
```bash
# List all resources
az resource list --resource-group evolution-api-rg --output table

# Get resource group status
az group show --name evolution-api-rg
```

### 2. Restart Virtual Machines

#### Check VM Status
```bash
# List all VMs in resource group
az vm list --resource-group evolution-api-rg --output table

# Check specific VM status
az vm get-instance-view --resource-group evolution-api-rg --name evolution-vm --query 'instanceView.statuses[1].displayStatus'
```

#### Start Stopped VMs
```bash
# Start a specific VM
az vm start --resource-group evolution-api-rg --name evolution-vm

# Start all VMs in resource group
for vm in $(az vm list --resource-group evolution-api-rg --query '[].name' -o tsv); do
  echo "Starting VM: $vm"
  az vm start --resource-group evolution-api-rg --name "$vm" --no-wait
done
```

### 3. Restart PostgreSQL Flexible Server

#### Check PostgreSQL Status
```bash
# List PostgreSQL servers
az postgres flexible-server list --resource-group evolution-api-rg --output table

# Check specific server status
az postgres flexible-server show --resource-group evolution-api-rg --name evolution-postgres-XXXXX --query 'state'
```

#### Start PostgreSQL Server
```bash
# Start PostgreSQL server
az postgres flexible-server start --resource-group evolution-api-rg --name evolution-postgres-XXXXX

# Start all PostgreSQL servers in resource group
for pg in $(az postgres flexible-server list --resource-group evolution-api-rg --query '[].name' -o tsv); do
  echo "Starting PostgreSQL: $pg"
  az postgres flexible-server start --resource-group evolution-api-rg --name "$pg"
done
```

### 4. Check Redis Cache

#### Check Redis Status
```bash
# List Redis caches
az redis list --resource-group evolution-api-rg --output table

# Check specific Redis cache
az redis show --resource-group evolution-api-rg --name evolution-redis-XXXXX
```

> **Note**: Redis Cache doesn't have start/stop operations like VMs. It's either provisioned or deleted.

### 5. Network Security Groups (Firewall Rules)

#### Check NSG Rules
```bash
# List NSGs
az network nsg list --resource-group evolution-api-rg --output table

# Check rules for specific NSG
az network nsg rule list --resource-group evolution-api-rg --nsg-name evolution-vm-nsg --output table
```

#### Add Missing Port Rules
```bash
# Open port 8080 for Evolution API
az network nsg rule create \
  --resource-group evolution-api-rg \
  --nsg-name evolution-vm-nsg \
  --name Allow-Port-8080 \
  --protocol tcp \
  --priority 1080 \
  --destination-port-range 8080 \
  --access allow

# Open port 443 for HTTPS
az network nsg rule create \
  --resource-group evolution-api-rg \
  --nsg-name evolution-vm-nsg \
  --name Allow-Port-443 \
  --protocol tcp \
  --priority 1443 \
  --destination-port-range 443 \
  --access allow
```

### 6. Get Connection Information

#### VM Connection Details
```bash
# Get VM public IP
az vm show --resource-group evolution-api-rg --name evolution-vm --show-details --query 'publicIps' --output tsv

# Get complete VM info
az vm show --resource-group evolution-api-rg --name evolution-vm --show-details --query '{Name:name, PublicIP:publicIps, PrivateIP:privateIps, PowerState:powerState}'
```

#### Database Connection Strings
```bash
# Get PostgreSQL FQDN
az postgres flexible-server show --resource-group evolution-api-rg --name evolution-postgres-XXXXX --query 'fullyQualifiedDomainName' --output tsv

# Get Redis hostname and port
az redis show --resource-group evolution-api-rg --name evolution-redis-XXXXX --query '{hostname:hostName,sslPort:sslPort}'

# Get Redis access keys
az redis list-keys --resource-group evolution-api-rg --name evolution-redis-XXXXX
```

### 7. Evolution API Container Management

After VMs are running, connect and manage Docker containers:

```bash
# Connect to VM
ssh azureuser@YOUR_VM_PUBLIC_IP

# Navigate to Evolution API directory
cd ~/evolution-api

# Check container status
docker compose ps

# Restart Evolution API containers
docker compose down
docker compose pull
docker compose up -d

# View logs
docker compose logs -f evolution-api

# Check API health
curl -H "apikey: YOUR_API_KEY" http://localhost:8080/
```

### 8. Troubleshooting Common Issues

#### Issue: VM won't start
```bash
# Check VM details and issues
az vm get-instance-view --resource-group evolution-api-rg --name evolution-vm

# Check if there are any deployment errors
az vm show --resource-group evolution-api-rg --name evolution-vm --query 'instanceView.statuses'
```

#### Issue: Database connection fails
```bash
# Check PostgreSQL firewall rules
az postgres flexible-server firewall-rule list --resource-group evolution-api-rg --name evolution-postgres-XXXXX

# Add firewall rule for Azure services
az postgres flexible-server firewall-rule create \
  --resource-group evolution-api-rg \
  --name evolution-postgres-XXXXX \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

#### Issue: Redis connection fails
```bash
# Verify Redis configuration
az redis show --resource-group evolution-api-rg --name evolution-redis-XXXXX --query '{provisioningState:provisioningState,enableNonSslPort:enableNonSslPort}'

# If needed, enable non-SSL port (not recommended for production)
az redis update --resource-group evolution-api-rg --name evolution-redis-XXXXX --enable-non-ssl-port true
```

### 9. Cost Management

#### Check Resource Costs
```bash
# Check current month costs for resource group
az consumption usage list --start-date $(date -d '1 month ago' '+%Y-%m-%d') --end-date $(date '+%Y-%m-%d') --output table

# Get cost analysis (requires Cost Management permissions)
az costmanagement query \
  --type Usage \
  --scope "/subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/evolution-api-rg" \
  --time-period from="$(date -d '30 days ago' '+%Y-%m-%d')" to="$(date '+%Y-%m-%d')"
```

#### Stop Resources to Save Costs
```bash
# Stop VM (deallocate to stop billing for compute)
az vm deallocate --resource-group evolution-api-rg --name evolution-vm

# Stop PostgreSQL server
az postgres flexible-server stop --resource-group evolution-api-rg --name evolution-postgres-XXXXX
```

### 10. Automated Restart Script

Run the comprehensive restart script:
```bash
# Make script executable
chmod +x wacanda/scripts/restart-azure-resources.sh

# Run the script
./wacanda/scripts/restart-azure-resources.sh
```

### 11. Common Connection Strings Format

Update your Evolution API `.env` file with these formats:

```env
# PostgreSQL
DATABASE_URL=postgresql://evolutionadmin:Evolution@2024!@evolution-postgres-XXXXX.postgres.database.azure.com:5432/evolution?sslmode=require

# Redis
REDIS_URL=redis://:YOUR_PRIMARY_KEY@evolution-redis-XXXXX.redis.cache.windows.net:6380

# API Key (generate new if needed)
API_KEY=your-64-character-api-key-here
```

### 12. Emergency Recovery

If resources are completely corrupted or deleted:

1. **Backup Recovery**: Check if you have backups in Azure Storage
2. **Redeploy**: Use the original deployment guide to recreate resources
3. **Data Recovery**: Export data from PostgreSQL before recreating

```bash
# Export PostgreSQL data
pg_dump "postgresql://evolutionadmin:Evolution@2024!@evolution-postgres-XXXXX.postgres.database.azure.com:5432/evolution?sslmode=require" > backup.sql

# Import to new database
psql "postgresql://evolutionadmin:Evolution@2024!@NEW_SERVER.postgres.database.azure.com:5432/evolution?sslmode=require" < backup.sql
```

---

## Quick Reference Commands

```bash
# One-liner to start all VMs
az vm start --ids $(az vm list --resource-group evolution-api-rg --query '[].id' -o tsv)

# One-liner to start all PostgreSQL servers
for pg in $(az postgres flexible-server list --resource-group evolution-api-rg --query '[].name' -o tsv); do az postgres flexible-server start --resource-group evolution-api-rg --name "$pg"; done

# Get all connection info at once
echo "=== VMs ===" && az vm list --resource-group evolution-api-rg --show-details --query '[].{Name:name,PublicIP:publicIps,State:powerState}' --output table && echo "=== PostgreSQL ===" && az postgres flexible-server list --resource-group evolution-api-rg --query '[].{Name:name,FQDN:fullyQualifiedDomainName,State:state}' --output table && echo "=== Redis ===" && az redis list --resource-group evolution-api-rg --query '[].{Name:name,Hostname:hostName,State:provisioningState}' --output table
``` 