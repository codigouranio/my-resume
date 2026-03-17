#!/bin/bash
set -e

echo "🚀 Deploying BOTH Frontend and API Service to Cloud Run..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Deploy API Service first
./deploy-api-service.sh

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Deploy Frontend
./deploy-frontend.sh

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ BOTH services deployed successfully!"
echo ""
echo "🌐 Frontend: https://resumecast.ai"
echo "🌐 API:      https://api.resumecast.ai"
echo ""
echo "⚠️  Clear browser cache to see changes!"
