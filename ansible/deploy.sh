#!/bin/bash
# Deployment script for My Resume Application

set -e

echo "🚀 Starting deployment to 172.16.23.127..."

# Check if ansible is installed locally
if ! command -v ansible &> /dev/null; then
    echo "❌ Ansible is not installed on this machine"
    echo "   But it's installed on the remote server, so you can:"
    echo "   1. SSH to the server: ssh ubuntu@172.16.23.127"
    echo "   2. Clone this repo on the server"
    echo "   3. Run: cd ansible && ansible-playbook -i inventory.yml playbook.yml --connection=local"
    exit 1
fi

# Test connection
echo "🔍 Testing connection to remote server..."
ansible production -i inventory.yml -m ping

# Run deployment playbook
echo "📦 Running deployment playbook..."
ansible-playbook -i inventory.yml playbook.yml

echo ""
echo "✅ Deployment completed!"
echo ""
echo "🔗 Access your application:"
echo "   Frontend:  http://172.16.23.127"
echo "   API:       http://172.16.23.127/api"
echo "   GraphQL:   http://172.16.23.127/graphql"
echo "   Swagger:   http://172.16.23.127/api/docs"
echo ""
echo "📊 Useful commands on remote server:"
echo "   pm2 status              - Check service status"
echo "   pm2 logs                - View all logs"
echo "   pm2 logs api-service    - View API logs"
echo "   pm2 logs llm-service    - View LLM logs"
echo "   pm2 restart all         - Restart all services"
echo "   pm2 monit               - Monitor resources"
echo ""
