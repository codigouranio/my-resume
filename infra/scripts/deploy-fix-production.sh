#!/bin/bash
# Quick fix deployment for production server 172.16.23.127
# Fixes .env file quoting issues that cause service failures

set -e

echo "🔧 Quick Fix Deployment to Production"
echo "======================================"
echo ""

cd "$(dirname "$0")/ansible"

echo "1️⃣ Running Ansible playbook to fix .env configurations..."
ansible-playbook -i inventory-production.yml \
  playbooks/03-application-deploy.yml \
  --vault-password-file ~/.ansible/vault_password \
  --tags "config" \
  -v

echo ""
echo "2️⃣ Restarting services on production..."
ssh prod-host "pm2 restart all && pm2 status"

echo ""
echo "3️⃣ Checking service health..."
sleep 3

echo ""
echo "API Service:"
ssh prod-host "curl -s http://localhost:3000/health || echo 'API not responding'"

echo ""
echo "LLM Service:"
ssh prod-host "curl -s http://localhost:5000/health || echo 'LLM not responding'"

echo ""
echo "4️⃣ Checking recent logs..."
echo "API Service logs:"
ssh prod-host "pm2 logs api-service --lines 10 --nostream | tail -10"

echo ""
echo "LLM Service logs:"
ssh prod-host "pm2 logs llm-service --lines 10 --nostream | tail -10"

echo ""
echo "======================================"
echo "✅ Deployment complete!"
echo ""
echo "Check full status: ssh prod-host 'pm2 status'"
echo "View logs: ssh prod-host 'pm2 logs'"
