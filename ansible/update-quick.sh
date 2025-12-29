#!/bin/bash
# Quick update script
# Updates code and restarts services

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
INVENTORY="${INVENTORY:-$SCRIPT_DIR/inventory-production.yml}"

echo "════════════════════════════════════════════════════════"
echo "  Quick Update"
echo "════════════════════════════════════════════════════════"

ansible-playbook -i "$INVENTORY" "$SCRIPT_DIR/playbooks/05-update.yml"

echo ""
echo "✅ Update complete!"
