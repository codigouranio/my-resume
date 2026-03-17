#!/bin/bash
set -e

echo "🔧 Updating LLM service configuration on home server..."

ssh jose@resumecast.ai 'bash -s' << 'ENDSSH'
cd /opt/my-resume

# Pull latest changes
echo "📥 Pulling latest code..."
git pull origin main

# Regenerate ecosystem.config.js from ansible template
echo "🔧 Regenerating ecosystem.config.js..."
# This requires running ansible playbook, OR manually update the file

# Check current API_SERVICE_URL
echo ""
echo "Current env vars:"
pm2 jlist | jq -r '.[] | select(.name=="llm-service") | .pm2_env.env | "API_SERVICE_URL=\(.API_SERVICE_URL)", "LLM_SERVICE_USERNAME=\(.LLM_SERVICE_USERNAME)"'

echo ""
echo "✅ To apply ansible changes, run:"
echo "   cd ansible && ansible-playbook -i inventory.yml update-services.yml"
echo ""
echo "💡 Or manually update ecosystem.config.js and restart:"
echo "   pm2 restart llm-service --update-env"
ENDSSH

echo ""
echo "✅ Done! Next steps:"
echo "1. Run ansible playbook to update ecosystem.config.js"
echo "2. Or manually edit /opt/my-resume/ecosystem.config.js"
echo "3. Then: ssh jose@resumecast.ai 'pm2 restart llm-service --update-env'"
