#!/bin/bash
# Quick script to update LLM service API_SERVICE_URL and restart

set -e

echo "🔧 Updating LLM Service Configuration..."

# SSH to production server
HOST="resumecast.ai"
USER="jose"

# Update the PM2 ecosystem configuration
ssh ${USER}@${HOST} << 'EOF'
  # Find the ecosystem.config.js file
  ECOSYSTEM_FILE="/opt/my-resume/ecosystem.config.js"
  
  if [ ! -f "$ECOSYSTEM_FILE" ]; then
    echo "❌ Error: $ECOSYSTEM_FILE not found"
    exit 1
  fi
  
  # Backup current config
  cp $ECOSYSTEM_FILE ${ECOSYSTEM_FILE}.backup-$(date +%Y%m%d-%H%M%S)
  
  # Update API_SERVICE_URL in the llm-service section
  # Replace localhost:3000 with api.resumecast.ai
  sed -i "s|API_SERVICE_URL: '[^']*'|API_SERVICE_URL: 'https://api.resumecast.ai'|g" $ECOSYSTEM_FILE
  
  echo "✅ Updated API_SERVICE_URL in $ECOSYSTEM_FILE"
  
  # Show the change
  echo "📝 Current LLM service API_SERVICE_URL:"
  grep -A 2 "API_SERVICE_URL" $ECOSYSTEM_FILE | head -3
  
  # Restart LLM service with updated config
  echo "🔄 Restarting LLM service..."
  pm2 restart llm-service --update-env
  
  echo "✅ LLM service restarted with new configuration"
  
  # Show status
  pm2 info llm-service | grep -E "status|restarts"
EOF

echo ""
echo "✅ Configuration update complete!"
echo "🧪 Test with: curl -X POST https://api.resumecast.ai/api/chat -H 'Content-Type: application/json' -d '{\"message\":\"test\",\"slug\":\"jose-blanco-swe\"}'"
