#!/bin/bash

# Azure Evolution API Resources Restart Script
# This script will restart all stopped Azure resources for Evolution API deployment

set -e

echo "🚀 Starting Azure Evolution API Resources Restart Process..."
echo "=================================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Azure CLI is installed and user is logged in
check_azure_cli() {
    print_status "Checking Azure CLI installation and authentication..."
    
    if ! command -v az &> /dev/null; then
        print_error "Azure CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check if user is logged in
    if ! az account show &> /dev/null; then
        print_warning "Not logged in to Azure. Please login first."
        az login
    fi
    
    print_success "Azure CLI is ready!"
}

# Function to list and select resource group
select_resource_group() {
    print_status "Fetching available resource groups..."
    
    # Get all resource groups and display them
    echo "Available Resource Groups:"
    az group list --query '[].{Name:name, Location:location, State:properties.provisioningState}' --output table
    
    echo ""
    read -p "Enter the resource group name (default: evolution-api-rg): " RG_NAME
    RG_NAME=${RG_NAME:-evolution-api-rg}
    
    # Check if resource group exists
    if ! az group show --name "$RG_NAME" &> /dev/null; then
        print_error "Resource group '$RG_NAME' not found!"
        exit 1
    fi
    
    print_success "Using resource group: $RG_NAME"
}

# Function to restart Virtual Machines
restart_vms() {
    print_status "Checking and restarting Virtual Machines..."
    
    # Get all VMs in the resource group
    VMS=$(az vm list --resource-group "$RG_NAME" --query '[].name' --output tsv)
    
    if [ -z "$VMS" ]; then
        print_warning "No Virtual Machines found in resource group '$RG_NAME'"
        return
    fi
    
    for VM in $VMS; do
        print_status "Checking VM: $VM"
        
        # Get VM power state
        POWER_STATE=$(az vm get-instance-view --resource-group "$RG_NAME" --name "$VM" --query 'instanceView.statuses[1].displayStatus' --output tsv)
        
        echo "  Current state: $POWER_STATE"
        
        if [[ "$POWER_STATE" == *"deallocated"* ]] || [[ "$POWER_STATE" == *"stopped"* ]]; then
            print_status "Starting VM: $VM"
            az vm start --resource-group "$RG_NAME" --name "$VM" --no-wait
            print_success "VM $VM start command initiated"
        elif [[ "$POWER_STATE" == *"running"* ]]; then
            print_success "VM $VM is already running"
        else
            print_warning "VM $VM is in state: $POWER_STATE"
        fi
    done
}

# Function to restart PostgreSQL Flexible Servers
restart_postgresql() {
    print_status "Checking and restarting PostgreSQL Flexible Servers..."
    
    # Get all PostgreSQL servers in the resource group
    PG_SERVERS=$(az postgres flexible-server list --resource-group "$RG_NAME" --query '[].name' --output tsv)
    
    if [ -z "$PG_SERVERS" ]; then
        print_warning "No PostgreSQL Flexible Servers found in resource group '$RG_NAME'"
        return
    fi
    
    for PG_SERVER in $PG_SERVERS; do
        print_status "Checking PostgreSQL server: $PG_SERVER"
        
        # Get server state
        SERVER_STATE=$(az postgres flexible-server show --resource-group "$RG_NAME" --name "$PG_SERVER" --query 'state' --output tsv)
        
        echo "  Current state: $SERVER_STATE"
        
        if [[ "$SERVER_STATE" == "Stopped" ]] || [[ "$SERVER_STATE" == "Disabled" ]]; then
            print_status "Starting PostgreSQL server: $PG_SERVER"
            az postgres flexible-server start --resource-group "$RG_NAME" --name "$PG_SERVER"
            print_success "PostgreSQL server $PG_SERVER started"
        elif [[ "$SERVER_STATE" == "Ready" ]]; then
            print_success "PostgreSQL server $PG_SERVER is already running"
        else
            print_warning "PostgreSQL server $PG_SERVER is in state: $SERVER_STATE"
        fi
    done
}

# Function to check Redis Cache status
check_redis_cache() {
    print_status "Checking Redis Cache instances..."
    
    # Get all Redis caches in the resource group
    REDIS_CACHES=$(az redis list --resource-group "$RG_NAME" --query '[].name' --output tsv)
    
    if [ -z "$REDIS_CACHES" ]; then
        print_warning "No Redis Cache instances found in resource group '$RG_NAME'"
        return
    fi
    
    for REDIS_CACHE in $REDIS_CACHES; do
        print_status "Checking Redis cache: $REDIS_CACHE"
        
        # Get Redis status
        REDIS_STATUS=$(az redis show --resource-group "$RG_NAME" --name "$REDIS_CACHE" --query 'provisioningState' --output tsv)
        
        echo "  Current state: $REDIS_STATUS"
        
        if [[ "$REDIS_STATUS" == "Succeeded" ]]; then
            print_success "Redis cache $REDIS_CACHE is ready"
        else
            print_warning "Redis cache $REDIS_CACHE is in state: $REDIS_STATUS"
        fi
    done
}

# Function to check and update Network Security Groups
check_network_security() {
    print_status "Checking Network Security Groups and firewall rules..."
    
    # Get all NSGs in the resource group
    NSGS=$(az network nsg list --resource-group "$RG_NAME" --query '[].name' --output tsv)
    
    if [ -z "$NSGS" ]; then
        print_warning "No Network Security Groups found"
        return
    fi
    
    for NSG in $NSGS; do
        print_status "Checking NSG: $NSG"
        
        # Check for required ports (22, 8080, 443)
        REQUIRED_PORTS=("22" "8080" "443")
        
        for PORT in "${REQUIRED_PORTS[@]}"; do
            RULE_EXISTS=$(az network nsg rule list --resource-group "$RG_NAME" --nsg-name "$NSG" --query "[?destinationPortRange=='$PORT'].name" --output tsv)
            
            if [ -z "$RULE_EXISTS" ]; then
                print_warning "Port $PORT not open in NSG $NSG"
                
                read -p "Do you want to open port $PORT? (y/n): " OPEN_PORT
                if [[ "$OPEN_PORT" == "y" ]]; then
                    RULE_NAME="Allow-Port-$PORT"
                    az network nsg rule create \
                        --resource-group "$RG_NAME" \
                        --nsg-name "$NSG" \
                        --name "$RULE_NAME" \
                        --protocol tcp \
                        --priority $((1000 + PORT)) \
                        --destination-port-range "$PORT" \
                        --access allow
                    print_success "Opened port $PORT in NSG $NSG"
                fi
            else
                print_success "Port $PORT is already open in NSG $NSG"
            fi
        done
    done
}

# Function to get connection information
get_connection_info() {
    print_status "Gathering connection information..."
    
    echo ""
    echo "=================================================="
    echo "📋 CONNECTION INFORMATION"
    echo "=================================================="
    
    # VM Information
    print_status "Virtual Machine Information:"
    VMS=$(az vm list --resource-group "$RG_NAME" --query '[].name' --output tsv)
    for VM in $VMS; do
        PUBLIC_IP=$(az vm show --resource-group "$RG_NAME" --name "$VM" --show-details --query 'publicIps' --output tsv)
        PRIVATE_IP=$(az vm show --resource-group "$RG_NAME" --name "$VM" --show-details --query 'privateIps' --output tsv)
        
        echo "  🖥️  VM Name: $VM"
        echo "      Public IP: $PUBLIC_IP"
        echo "      Private IP: $PRIVATE_IP"
        echo "      SSH Command: ssh azureuser@$PUBLIC_IP"
        echo ""
    done
    
    # PostgreSQL Information
    print_status "PostgreSQL Server Information:"
    PG_SERVERS=$(az postgres flexible-server list --resource-group "$RG_NAME" --query '[].name' --output tsv)
    for PG_SERVER in $PG_SERVERS; do
        PG_FQDN=$(az postgres flexible-server show --resource-group "$RG_NAME" --name "$PG_SERVER" --query 'fullyQualifiedDomainName' --output tsv)
        
        echo "  🗄️  PostgreSQL Server: $PG_SERVER"
        echo "      FQDN: $PG_FQDN"
        echo "      Connection String: postgresql://evolutionadmin:Evolution@2024!@$PG_FQDN:5432/evolution?sslmode=require"
        echo ""
    done
    
    # Redis Information
    print_status "Redis Cache Information:"
    REDIS_CACHES=$(az redis list --resource-group "$RG_NAME" --query '[].name' --output tsv)
    for REDIS_CACHE in $REDIS_CACHES; do
        REDIS_HOSTNAME=$(az redis show --resource-group "$RG_NAME" --name "$REDIS_CACHE" --query 'hostName' --output tsv)
        REDIS_PORT=$(az redis show --resource-group "$RG_NAME" --name "$REDIS_CACHE" --query 'sslPort' --output tsv)
        
        echo "  📦 Redis Cache: $REDIS_CACHE"
        echo "      Hostname: $REDIS_HOSTNAME"
        echo "      SSL Port: $REDIS_PORT"
        echo "      Connection: redis://:PRIMARY_KEY@$REDIS_HOSTNAME:$REDIS_PORT"
        echo ""
    done
}

# Function to restart Evolution API containers
restart_evolution_api() {
    print_status "Checking if you want to restart Evolution API containers..."
    
    read -p "Do you want to connect to VM and restart Evolution API containers? (y/n): " RESTART_CONTAINERS
    
    if [[ "$RESTART_CONTAINERS" == "y" ]]; then
        VMS=$(az vm list --resource-group "$RG_NAME" --query '[].name' --output tsv)
        
        for VM in $VMS; do
            PUBLIC_IP=$(az vm show --resource-group "$RG_NAME" --name "$VM" --show-details --query 'publicIps' --output tsv)
            
            if [ ! -z "$PUBLIC_IP" ]; then
                print_status "Evolution API restart commands for VM $VM ($PUBLIC_IP):"
                echo ""
                echo "Run these commands after connecting to your VM:"
                echo "  ssh azureuser@$PUBLIC_IP"
                echo "  cd ~/evolution-api"
                echo "  docker compose down"
                echo "  docker compose pull"
                echo "  docker compose up -d"
                echo "  docker compose logs -f"
                echo ""
                break
            fi
        done
    fi
}

# Function to show resource costs
show_resource_costs() {
    print_status "Checking resource costs (last 30 days)..."
    
    # This requires proper permissions and might not work in all cases
    az consumption usage list --start-date $(date -d '30 days ago' '+%Y-%m-%d') --end-date $(date '+%Y-%m-%d') --output table 2>/dev/null || print_warning "Unable to fetch cost information. Check your permissions."
}

# Main execution
main() {
    echo "🔄 Azure Evolution API Resources Restart Script"
    echo "This script will help you restart stopped Azure resources"
    echo ""
    
    # Check prerequisites
    check_azure_cli
    
    # Select resource group
    select_resource_group
    
    echo ""
    print_status "Starting resource restart process for resource group: $RG_NAME"
    echo ""
    
    # Restart resources
    restart_vms
    echo ""
    
    restart_postgresql
    echo ""
    
    check_redis_cache
    echo ""
    
    check_network_security
    echo ""
    
    # Wait for VMs to start
    print_status "Waiting for VMs to fully start (this may take a few minutes)..."
    sleep 30
    
    # Get connection information
    get_connection_info
    
    # Option to restart Evolution API
    restart_evolution_api
    
    # Show costs
    show_resource_costs
    
    echo ""
    echo "=================================================="
    print_success "✅ Resource restart process completed!"
    echo "=================================================="
    echo ""
    print_status "Next steps:"
    echo "1. Connect to your VM using the SSH command provided above"
    echo "2. Check if Evolution API containers are running: docker compose ps"
    echo "3. If not running, restart them: docker compose up -d"
    echo "4. Test the API: curl -H 'apikey: YOUR_API_KEY' http://YOUR_VM_IP:8080/"
    echo ""
    print_warning "Remember to update your .env file with the correct database and Redis connection strings if they changed!"
}

# Run the main function
main "$@" 