#!/bin/bash
# Fix nginx CORS by updating config

set -e

echo "🔧 Fixing nginx CORS configuration..."

# Render the template
ansible production -i inventory-production.yml -m template \
  -a "src=templates/nginx.conf.j2 dest=/tmp/resume-nginx.conf" \
  -e "domain=my-resume.paskot.com ansible_host=172.16.23.127 frontend_path=/opt/my-resume/apps/my-resume api_port=3000 llm_port=8000"

echo "✅ Template rendered"

# Update nginx config and reload
echo "📝 Updating nginx config (you'll be prompted for sudo password)..."
read -sp "Enter sudo password for remote server: " SUDO_PASS
echo ""

ssh -t jose@172.16.23.127 << ENDSSH
echo "$SUDO_PASS" | sudo -S cp /tmp/resume-nginx.conf /etc/nginx/sites-available/myresume
echo "$SUDO_PASS" | sudo -S nginx -t
echo "$SUDO_PASS" | sudo -S systemctl reload nginx
ENDSSH

echo "✅ Nginx reloaded successfully"

# Test CORS headers
echo "🧪 Testing CORS headers..."
curl -s -I -H "Origin: https://my-resume.paskot.com" http://172.16.23.127/api/resumes/public/jose-blanco-swe | grep -i access-control

echo "✅ Done!"
