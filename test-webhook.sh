#!/bin/bash
# Test webhook endpoint manually

set -e

# Configuration
API_URL="${API_BASE_URL:-http://localhost:3000}"
WEBHOOK_ENDPOINT="$API_URL/api/webhooks/llm-result"

# Load secret from .env
if [ -f "apps/api-service/.env" ]; then
    export $(grep "^LLM_WEBHOOK_SECRET=" apps/api-service/.env | xargs)
else
    echo "❌ Error: apps/api-service/.env not found"
    echo "   Run ./setup-webhooks.sh first"
    exit 1
fi

if [ -z "$LLM_WEBHOOK_SECRET" ]; then
    echo "❌ Error: LLM_WEBHOOK_SECRET not set in .env"
    exit 1
fi

echo "🧪 Testing Webhook Endpoint"
echo ""
echo "   Endpoint: $WEBHOOK_ENDPOINT"
echo "   Secret: ${LLM_WEBHOOK_SECRET:0:10}..."
echo ""

# Test payload - Company enrichment success
PAYLOAD=$(cat <<EOF
{
  "jobId": "test_$(date +%s)",
  "type": "company",
  "status": "completed",
  "data": {
    "companyName": "Test Corporation",
    "description": "A test company for webhook validation",
    "industry": "Technology",
    "founded": "2020",
    "headquarters": "San Francisco, CA",
    "employeeCount": 500,
    "revenue": "\$50M",
    "logoUrl": "https://via.placeholder.com/150",
    "glassdoorRating": 4.2,
    "website": "https://test.com"
  },
  "metadata": {
    "userId": "test_user_123",
    "jobId": "test_job_abc",
    "companyName": "test corporation"
  }
}
EOF
)

echo "📤 Payload:"
echo "$PAYLOAD" | jq '.'
echo ""

# Generate HMAC signature
echo "🔐 Generating HMAC signature..."
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$LLM_WEBHOOK_SECRET" | awk '{print $2}')
echo "   Signature: ${SIGNATURE:0:20}..."
echo ""

# Send webhook
echo "🚀 Sending webhook..."
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$WEBHOOK_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -H "X-Job-Id: test_$(date +%s)" \
  -d "$PAYLOAD")

# Parse response
HTTP_BODY=$(echo "$RESPONSE" | sed -e 's/HTTP_STATUS\:.*//g')
HTTP_STATUS=$(echo "$RESPONSE" | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')

echo ""
echo "📥 Response (HTTP $HTTP_STATUS):"
if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ SUCCESS"
    echo "$HTTP_BODY" | jq '.' 2>/dev/null || echo "$HTTP_BODY"
elif [ "$HTTP_STATUS" = "401" ]; then
    echo "❌ UNAUTHORIZED - Invalid signature"
    echo "$HTTP_BODY"
    echo ""
    echo "💡 Troubleshooting:"
    echo "   - Verify LLM_WEBHOOK_SECRET matches in both .env files"
    echo "   - Check payload JSON formatting (no extra spaces)"
    echo "   - Ensure signature calculation uses same payload"
else
    echo "❌ ERROR"
    echo "$HTTP_BODY" | jq '.' 2>/dev/null || echo "$HTTP_BODY"
fi

echo ""

# Test position scoring webhook
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🧪 Testing Position Scoring Webhook"
echo ""

POSITION_PAYLOAD=$(cat <<EOF
{
  "jobId": "test_position_$(date +%s)",
  "type": "position",
  "status": "completed",
  "data": {
    "fitScore": 8.5,
    "analysis": {
      "strengths": [
        "Strong technical background in Python and TypeScript",
        "Good leadership experience",
        "Excellent problem-solving skills"
      ],
      "gaps": [
        "Limited cloud infrastructure experience",
        "No Kubernetes experience"
      ],
      "recommendations": [
        "Highlight AWS projects in interview",
        "Prepare examples of distributed systems design"
      ],
      "summary": "Excellent fit for this senior engineering role with strong technical skills and leadership experience."
    }
  },
  "metadata": {
    "userId": "test_user_123",
    "interviewId": "test_interview_456",
    "jobId": "test_job_xyz"
  }
}
EOF
)

echo "📤 Payload:"
echo "$POSITION_PAYLOAD" | jq '.'
echo ""

POSITION_SIGNATURE=$(echo -n "$POSITION_PAYLOAD" | openssl dgst -sha256 -hmac "$LLM_WEBHOOK_SECRET" | awk '{print $2}')
echo "🔐 Signature: ${POSITION_SIGNATURE:0:20}..."
echo ""

echo "🚀 Sending webhook..."
POSITION_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$WEBHOOK_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $POSITION_SIGNATURE" \
  -H "X-Job-Id: test_position_$(date +%s)" \
  -d "$POSITION_PAYLOAD")

HTTP_BODY=$(echo "$POSITION_RESPONSE" | sed -e 's/HTTP_STATUS\:.*//g')
HTTP_STATUS=$(echo "$POSITION_RESPONSE" | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')

echo ""
echo "📥 Response (HTTP $HTTP_STATUS):"
if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ SUCCESS"
    echo "$HTTP_BODY" | jq '.' 2>/dev/null || echo "$HTTP_BODY"
else
    echo "❌ ERROR"
    echo "$HTTP_BODY" | jq '.' 2>/dev/null || echo "$HTTP_BODY"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Test Summary:"
echo "   - Company enrichment: $([ "$HTTP_STATUS" = "200" ] && echo "✅" || echo "❌")"
echo "   - Position scoring: $([ "$HTTP_STATUS" = "200" ] && echo "✅" || echo "❌")"
echo ""
echo "📖 Next steps:"
echo "   1. Check API service logs: tail -f logs/api-service.log"
echo "   2. Verify database updated: Check CompanyInfo table"
echo "   3. Implement LLM service webhook sender (see LLM_WEBHOOK_IMPLEMENTATION.md)"
echo ""
