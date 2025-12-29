#!/bin/bash
# Check status of all services across all servers

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
INVENTORY="${INVENTORY:-$SCRIPT_DIR/inventory-production.yml}"

echo "════════════════════════════════════════════════════════"
echo "  Service Status Check"
echo "════════════════════════════════════════════════════════"
echo ""

ansible all -i "$INVENTORY" -m shell -a "source /opt/miniconda3/etc/profile.d/conda.sh && conda activate /opt/my-resume/apps/api-service/conda-env && \$(npm root -g)/pm2/bin/pm2 list" -b

echo ""
echo "════════════════════════════════════════════════════════"
echo "  System Resources"
echo "════════════════════════════════════════════════════════"
echo ""

ansible all -i "$INVENTORY" -m shell -a "echo '=== CPU & Memory ===' && free -h && echo '' && echo '=== Disk Usage ===' && df -h /" -b
