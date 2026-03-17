#!/bin/bash
# Quick fix for LLM service configuration on resumecast.ai

set -e

echo "🔧 Fixing LLM service configuration on resumecast.ai..."
echo ""

ssh jose@resumecast.ai 'bash -s' << 'ENDSSH'
cd /opt/my-resume

echo "📋 Current API_SERVICE_URL:"
grep "API_SERVICE_URL:" ecosystem.config.js | head -2

echo ""
echo "🔄 Updating configuration..."

# Backup current config
cp ecosystem.config.js ecosystem.config.js.backup.$(date +%Y%m%d_%H%M%S)

# Update API_SERVICE_URL to point to Cloud Run API
sed -i "s|API_SERVICE_URL: 'http://localhost:3000'|API_SERVICE_URL: 'https://api.resumecast.ai'|g" ecosystem.config.js

# Also update any http://localhost:3000 references
sed -i "s|\"http://localhost:3000\"|\"https://api.resumecast.ai\"|g" ecosystem.config.js

echo ""
echo "✅ Updated API_SERVICE_URL:"
grep "API_SERVICE_URL:" ecosystem.config.js | head -2

echo ""
echo "🔄 Restarting LLM service..."
pm2 restart llm-service --update-env

echo ""
echo "⏳ Waiting for service to start..."
sleep 3

echo ""
echo "📊 Service status:"
pm2 list | grep llm-service

echo ""
echo "📝 Recent logs:"
pm2 logs llm-service --lines 5 --nostream || true

ENDSSH

echo ""
echo "✅ Configuration updated and service restarted!"
echo ""
echo "🧪 Test the fix:"
echo "   curl -X POST https://llm-service.paskot.com/api/chat \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -H 'X-API-Key: 54728f0532ae29140b925faf99d9b00b6d9b9102c83c882e75ea2ece5d6c6951' \\"
echo "     -d '{\"message\":\"test\",\"slug\":\"jose-blanco-swe\"}'"
