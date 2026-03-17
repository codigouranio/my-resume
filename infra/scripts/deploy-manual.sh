#!/bin/bash
# Manual deployment script for chat analytics feature
# Run this on the production server (172.16.23.127)

set -e

echo "=== Deploying Chat Analytics to Production ==="
echo

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

step() {
    echo -e "${YELLOW}▶ $1${NC}"
}

success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# 1. Pull latest code
step "Pulling latest code from GitHub..."
cd /opt/my-resume
git pull origin main
success "Code updated"

# 2. Update API Service
step "Updating API service..."
cd /opt/my-resume/apps/api-service
source /opt/miniconda3/etc/profile.d/conda.sh
conda activate /opt/my-resume/apps/api-service/conda-env

# Install dependencies (if any new)
npm install
success "Dependencies installed"

# Push database schema changes
step "Applying database migrations..."
npx prisma db push
npx prisma generate
success "Database schema updated"

# Rebuild API
step "Rebuilding API service..."
npm run build
success "API service built"

# 3. Update LLM Service
step "LLM service already updated (Python, no build needed)"

# 4. Update Frontend
step "Rebuilding frontend..."
cd /opt/my-resume/apps/my-resume
npm install
npm run build
success "Frontend built"

# 5. Restart services
step "Restarting PM2 services..."
pm2 restart api-service
pm2 restart llm-service
success "Services restarted"

# 6. Verify services
step "Checking service status..."
pm2 status

echo
echo -e "${GREEN}=== Deployment Complete! ===${NC}"
echo
echo "Chat Analytics Dashboard is now live!"
echo
echo "Next steps:"
echo "  1. Login to your dashboard: https://resumecast.ai/dashboard"
echo "  2. Click 'Analytics' on any resume"
echo "  3. Switch to '💬 Chat Analytics' tab"
echo "  4. View recruiter question insights!"
echo
echo "To test with sample data, run on server:"
echo "  ./test-chat-analytics.sh"
