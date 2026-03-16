#!/bin/bash
# Test company enrichment endpoints

API_URL="https://api.resumecast.ai"
LLM_URL="https://llm-service.paskot.com"
LLM_API_KEY="54728f0532ae29140b925faf99d9b00b6d9b9102c83c882e75ea2ece5d6c6951"

echo "=== Testing Company Enrichment ==="
echo ""

# Get JWT token (you need to replace with actual credentials)
echo "1. Get JWT token from API service"
echo "   LOGIN_RESPONSE=\$(curl -s -X POST \"$API_URL/api/auth/login\" -H \"Content-Type: application/json\" -d '{\"email\":\"your@email.com\",\"password\":\"yourpassword\"}')"
echo "   TOKEN=\$(echo \$LOGIN_RESPONSE | jq -r '.access_token')"
echo ""

# Test direct LLM service (sync mode)
echo "2. Test LLM service directly (sync - will timeout after 5s)"
curl -v -X POST "$LLM_URL/api/companies/enrich" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $LLM_API_KEY" \
  -d '{"companyName":"Google"}' \
  --max-time 5 2>&1 | grep -E "(Connected|HTTP|timeout|error)"
echo ""

# Test async mode with callback
echo "3. Test LLM service (async mode with callbackUrl)"
curl -s -X POST "$LLM_URL/api/companies/enrich" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $LLM_API_KEY" \
  -d '{
    "companyName":"Google",
    "callbackUrl":"https://webhook.site/unique-id-here",
    "metadata":{"test":true}
  }' | jq .
echo ""

echo "4. Test API service queue endpoint (requires JWT)"
echo "   curl -X POST \"$API_URL/api/companies/enrich/queue\" \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -H \"Authorization: Bearer \$TOKEN\" \\"
echo "     -d '{\"companyName\":\"Google\"}' | jq ."
echo ""

echo "5. Check Bull Board queues at:"
echo "   $API_URL/api/admin/queues"
echo ""

echo "6. Check LLM service health:"
curl -s "$LLM_URL/health" | jq .
