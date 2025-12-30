#!/bin/bash
# Fix frontend .env and rebuild

set -e

echo "🔧 Fixing frontend .env and rebuilding..."
read -sp "Enter sudo password: " SUDO_PASS
echo ""

ssh -t jose@172.16.23.127 << 'ENDSSH'
# Update .env file
cat > /opt/my-resume/apps/my-resume/.env << 'EOF'
PUBLIC_API_URL=/api
PUBLIC_LLM_API_URL=/llm
EOF

echo "✅ .env file updated"

# Rebuild frontend
cd /opt/my-resume/apps/my-resume
source /opt/miniconda3/etc/profile.d/conda.sh
conda activate /opt/my-resume/apps/my-resume/conda-env

echo "📦 Building frontend..."
npm run build

echo "✅ Frontend rebuilt successfully"
ENDSSH

echo "🎉 Done! The site should now work correctly."
