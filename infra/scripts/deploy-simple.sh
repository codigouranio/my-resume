#!/bin/bash
# Simple deployment script - just pull, build, restart

set -e

SERVER="jose@172.16.23.127"

echo "🚀 Deploying to production..."

# Pull latest code
echo "📥 Pulling latest code..."
ssh $SERVER "cd /opt/my-resume && git pull"

# Build frontend
echo "🔨 Building frontend..."
ssh $SERVER << 'ENDSSH'
source /opt/miniconda3/etc/profile.d/conda.sh
cd /opt/my-resume/apps/my-resume
npm run build
ENDSSH

# Rebuild API service if needed
echo "🔨 Rebuilding API service..."
ssh $SERVER << 'ENDSSH'
source /opt/miniconda3/etc/profile.d/conda.sh
cd /opt/my-resume/apps/api-service
npm run build
ENDSSH

# Restart services
echo "🔄 Restarting services..."
ssh $SERVER << 'ENDSSH'
source /opt/miniconda3/etc/profile.d/conda.sh
cd /opt/my-resume
$(npm root -g)/pm2/bin/pm2 restart all
ENDSSH

# Wait for services
echo "⏳ Waiting for services to start..."
sleep 5

# Check status
echo "✅ Deployment complete!"
ssh $SERVER << 'ENDSSH'
source /opt/miniconda3/etc/profile.d/conda.sh
$(npm root -g)/pm2/bin/pm2 status
ENDSSH

