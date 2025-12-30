#!/bin/bash
# Check nginx configuration

echo "=== Checking nginx configuration ==="
read -sp "Enter sudo password: " SUDO_PASS
echo ""

ssh -t jose@172.16.23.127 << ENDSSH
echo "$SUDO_PASS" | sudo -S cat /etc/nginx/sites-available/myresume
ENDSSH
