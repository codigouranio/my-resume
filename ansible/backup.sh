#!/bin/bash
# Backup database from all servers

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
INVENTORY="${INVENTORY:-$SCRIPT_DIR/inventory-production.yml}"

echo "════════════════════════════════════════════════════════"
echo "  Database Backup"
echo "════════════════════════════════════════════════════════"
echo ""

ansible all -i "$INVENTORY" -m shell -a "/opt/backups/my-resume/backup-database.sh" -b --become-user=jose

echo ""
echo "✅ Backup complete on all servers"
