#!/bin/bash
# Complete deployment script
# Runs all playbooks in sequence

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
INVENTORY="${INVENTORY:-$SCRIPT_DIR/inventory-production.yml}"

echo "════════════════════════════════════════════════════════"
echo "  My Resume Application - Complete Deployment"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Inventory: $INVENTORY"
echo ""

# Check if inventory exists
if [ ! -f "$INVENTORY" ]; then
    echo "❌ Error: Inventory file not found: $INVENTORY"
    echo "   Create one based on inventory-production.yml.example"
    exit 1
fi

# Validate ansible is installed
if ! command -v ansible-playbook &> /dev/null; then
    echo "❌ Error: ansible-playbook not found"
    echo "   Install: pip install ansible"
    exit 1
fi

echo "Step 1/5: Checking prerequisites..."
ansible-playbook -i "$INVENTORY" "$SCRIPT_DIR/playbooks/00-prerequisites.yml" || {
    echo ""
    echo "❌ Prerequisites check failed"
    echo "   Review the output above and fix any issues"
    exit 1
}

echo ""
read -p "Continue with full deployment? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Deployment cancelled"
    exit 0
fi

echo ""
echo "Step 2/5: Setting up system..."
ansible-playbook -i "$INVENTORY" "$SCRIPT_DIR/playbooks/01-system-setup.yml"

echo ""
echo "Step 3/5: Configuring database..."
ansible-playbook -i "$INVENTORY" "$SCRIPT_DIR/playbooks/02-database-setup.yml"

echo ""
echo "Step 4/5: Deploying application..."
ansible-playbook -i "$INVENTORY" "$SCRIPT_DIR/playbooks/03-application-deploy.yml"

echo ""
echo "Step 5/5: Configuring Nginx..."
ansible-playbook -i "$INVENTORY" "$SCRIPT_DIR/playbooks/04-nginx-setup.yml"

echo ""
echo "════════════════════════════════════════════════════════"
echo "  ✅ Deployment Completed Successfully!"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Your application is now running!"
echo ""
echo "Quick commands:"
echo "  Update code: ./update.sh"
echo "  Check logs: ./logs.sh"
echo "  Backup DB:   ./backup.sh"
echo ""
