#!/bin/bash
# Setup script for LLM webhook architecture

set -e

echo "🔧 Setting up LLM Webhook Architecture..."
echo ""

# Generate webhook secret
echo "1️⃣ Generating webhook secret..."
WEBHOOK_SECRET=$(openssl rand -hex 32)
echo "   ✅ Generated: $WEBHOOK_SECRET"
echo ""

# API Service .env
API_ENV="apps/api-service/.env"
echo "2️⃣ Configuring API Service ($API_ENV)..."

if [ ! -f "$API_ENV" ]; then
    echo "   ⚠️  .env not found, creating from .env.example..."
    cp apps/api-service/.env.example "$API_ENV" 2>/dev/null || touch "$API_ENV"
fi

# Check if already configured
if grep -q "LLM_WEBHOOK_SECRET" "$API_ENV"; then
    echo "   ⚠️  LLM_WEBHOOK_SECRET already exists, skipping..."
else
    echo "LLM_WEBHOOK_SECRET=$WEBHOOK_SECRET" >> "$API_ENV"
    echo "   ✅ Added LLM_WEBHOOK_SECRET"
fi

if grep -q "USE_LLM_WEBHOOKS" "$API_ENV"; then
    echo "   ⚠️  USE_LLM_WEBHOOKS already exists, skipping..."
else
    echo "USE_LLM_WEBHOOKS=true" >> "$API_ENV"
    echo "   ✅ Added USE_LLM_WEBHOOKS=true"
fi

if grep -q "API_BASE_URL" "$API_ENV"; then
    echo "   ⚠️  API_BASE_URL already exists, skipping..."
else
    echo "API_BASE_URL=http://localhost:3000" >> "$API_ENV"
    echo "   ✅ Added API_BASE_URL"
fi

echo ""

# LLM Service .env
LLM_ENV="apps/llm-service/.env"
echo "3️⃣ Configuring LLM Service ($LLM_ENV)..."

if [ ! -f "$LLM_ENV" ]; then
    echo "   ⚠️  .env not found, creating..."
    touch "$LLM_ENV"
fi

if grep -q "LLM_WEBHOOK_SECRET" "$LLM_ENV"; then
    echo "   ⚠️  LLM_WEBHOOK_SECRET already exists, updating..."
    sed -i.bak "s/^LLM_WEBHOOK_SECRET=.*/LLM_WEBHOOK_SECRET=$WEBHOOK_SECRET/" "$LLM_ENV"
    rm "${LLM_ENV}.bak"
    echo "   ✅ Updated LLM_WEBHOOK_SECRET"
else
    echo "LLM_WEBHOOK_SECRET=$WEBHOOK_SECRET" >> "$LLM_ENV"
    echo "   ✅ Added LLM_WEBHOOK_SECRET"
fi

echo ""
echo "✅ Configuration complete!"
echo ""
echo "📋 Summary:"
echo "   - Webhook secret: $WEBHOOK_SECRET"
echo "   - API Service: USE_LLM_WEBHOOKS=true"
echo "   - LLM Service: Ready to accept callbacks"
echo ""
echo "🚀 Next steps:"
echo "   1. Implement webhook support in LLM service (see LLM_WEBHOOK_IMPLEMENTATION.md)"
echo "   2. Restart API service: cd apps/api-service && npm run start:dev"
echo "   3. Test webhook endpoint: ./test-webhook.sh"
echo ""
echo "📖 Documentation: LLM_WEBHOOK_IMPLEMENTATION.md"
