#!/bin/bash
# View PM2 logs from all servers

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
INVENTORY="${INVENTORY:-$SCRIPT_DIR/inventory-production.yml}"

echo "Fetching PM2 logs from all servers..."
echo ""

ansible all -i "$INVENTORY" -m shell -a "source /opt/miniconda3/etc/profile.d/conda.sh && conda activate /opt/my-resume/apps/api-service/conda-env && \$(npm root -g)/pm2/bin/pm2 logs --lines 50 --nostream" -b
