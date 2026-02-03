#!/bin/bash
# Update Nginx configuration for subdomain routing and obtain SSL certificates

set -e

echo "🔧 Updating Nginx configuration for subdomain routing..."
echo ""

# Run ansible playbook for nginx setup
ansible-playbook -i inventory.yml playbooks/04-nginx-setup.yml

echo ""
echo "✅ Nginx configuration updated!"
echo ""
echo "📋 Next steps:"
echo "1. Verify DNS records are set:"
echo "   - api.resumecast.ai → Your server IP"
echo "   - llm.resumecast.ai → Your server IP"
echo ""
echo "2. Test configuration:"
echo "   ssh user@server 'sudo nginx -t'"
echo ""
echo "3. Obtain SSL certificates (run on server):"
echo "   sudo certbot --nginx -d api.resumecast.ai -d llm.resumecast.ai --non-interactive --agree-tos --email admin@resumecast.ai"
echo ""
echo "4. Rebuild and deploy frontend:"
echo "   ./ansible/update-quick.sh"
echo ""
