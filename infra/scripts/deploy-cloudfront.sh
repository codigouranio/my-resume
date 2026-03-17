#!/bin/bash
# Automated deployment script for CloudFront
# This script builds the frontend and deploys to AWS S3 + CloudFront

set -e

echo "🚀 Starting CloudFront Deployment"
echo "=================================="

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
FRONTEND_DIR="apps/my-resume"
INFRA_DIR="infra"
STACK_NAME="MyResumeCloudFrontStack"

# Check if we're in the right directory
if [ ! -d "$FRONTEND_DIR" ] || [ ! -d "$INFRA_DIR" ]; then
    echo -e "${RED}❌ Error: Must run from project root${NC}"
    exit 1
fi

# Function to get stack output
get_stack_output() {
    local output_key=$1
    aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query "Stacks[0].Outputs[?OutputKey=='$output_key'].OutputValue" \
        --output text 2>/dev/null || echo ""
}

# Step 1: Update environment variables for production
echo ""
echo -e "${YELLOW}📝 Step 1/5: Updating environment variables${NC}"

read -p "Enter your root domain (e.g., resumecast.ai): " ROOT_DOMAIN

if [ -z "$ROOT_DOMAIN" ]; then
    echo -e "${RED}❌ Root domain is required${NC}"
    exit 1
fi

API_DOMAIN="api.$ROOT_DOMAIN"
echo "API domain will be: $API_DOMAIN"

# Create production .env
cat > "$FRONTEND_DIR/.env.production" <<EOF
# Environment variables for React app (Rsbuild) - Production
# In Rsbuild, environment variables must be prefixed with PUBLIC_ to be accessible in the browser

# Backend API URL (via Cloudflare Tunnel)
PUBLIC_API_URL=https://$API_DOMAIN/api

# LLM Service URL (via API service)
PUBLIC_LLM_API_URL=https://$API_DOMAIN/llm
EOF

echo -e "${GREEN}✅ Environment variables updated${NC}"

# Step 2: Build frontend
echo ""
echo -e "${YELLOW}📦 Step 2/5: Building frontend${NC}"
cd "$FRONTEND_DIR"

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

echo "Building production bundle..."
npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Build failed - dist directory not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Frontend built successfully${NC}"
cd ../..

# Step 3: Bootstrap CDK (if not already done)
echo ""
echo -e "${YELLOW}☁️  Step 3/5: Checking CDK bootstrap${NC}"
cd "$INFRA_DIR"

if ! aws cloudformation describe-stacks --stack-name CDKToolkit &>/dev/null; then
    echo "Bootstrapping CDK..."
    cdk bootstrap
    echo -e "${GREEN}✅ CDK bootstrapped${NC}"
else
    echo -e "${GREEN}✅ CDK already bootstrapped${NC}"
fi

# Step 4: Deploy or update stack
echo ""
echo -e "${YELLOW}🚀 Step 4/5: Deploying to AWS${NC}"

STACK_EXISTS=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" 2>/dev/null || echo "")

if [ -z "$STACK_EXISTS" ]; then
    echo "Creating new CloudFront stack..."
    cdk deploy --require-approval never
else
    echo "Updating existing CloudFront stack..."
    cdk deploy --require-approval never
fi

echo -e "${GREEN}✅ Stack deployed${NC}"

# Step 5: Get outputs and invalidate cache
echo ""
echo -e "${YELLOW}🔄 Step 5/5: Invalidating CloudFront cache${NC}"

DISTRIBUTION_ID=$(get_stack_output "DistributionId")
CLOUDFRONT_URL=$(get_stack_output "DistributionDomainName")

if [ -n "$DISTRIBUTION_ID" ]; then
    echo "Creating cache invalidation for distribution: $DISTRIBUTION_ID"
    INVALIDATION_ID=$(aws cloudfront create-invalidation \
        --distribution-id "$DISTRIBUTION_ID" \
        --paths "/*" \
        --query 'Invalidation.Id' \
        --output text)
    
    echo -e "${GREEN}✅ Cache invalidation created: $INVALIDATION_ID${NC}"
else
    echo -e "${YELLOW}⚠️  Could not find distribution ID${NC}"
fi

cd ..

# Display results
echo ""
echo "=================================="
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "=================================="
echo ""
echo "📊 Deployment Details:"
echo "  CloudFront URL: https://$CLOUDFRONT_URL"
echo "  Your Domain:    https://$ROOT_DOMAIN"
echo "  API Endpoint:   https://$API_DOMAIN"
echo ""
echo "📝 Next Steps:"
echo "  1. Configure Cloudflare DNS:"
echo "     - CNAME @ (root) -> $CLOUDFRONT_URL (Proxied 🟠)"
echo "     - CNAME www -> $CLOUDFRONT_URL (Proxied 🟠)"
echo "     - CNAME api -> (Cloudflare Tunnel)"
echo ""
echo "  2. Test your deployment:"
echo "     - Frontend: https://$CLOUDFRONT_URL (temporary)"
echo "     - After DNS: https://$ROOT_DOMAIN"
echo "     - API: https://$API_DOMAIN/health"
echo ""
echo "  3. Monitor cache invalidation:"
echo "     aws cloudfront get-invalidation --distribution-id $DISTRIBUTION_ID --id $INVALIDATION_ID"
echo ""
