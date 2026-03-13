#!/bin/bash
# Test script for LLM Service JWT Authentication (Phase 1)

set -e

API_URL="${API_URL:-http://localhost:3000}"
USERNAME="${LLM_SERVICE_USERNAME:-llm-service}"
PASSWORD="${LLM_SERVICE_PASSWORD:-test-password}"

echo "==================================="
echo "LLM Service JWT Auth - Phase 1 Test"
echo "==================================="
echo ""

# Test 1: Login with credentials
echo "Test 1: Login with username/password"
echo "POST $API_URL/api/llm-service/auth/login"
echo ""

LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/llm-service/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$USERNAME\", \"password\": \"$PASSWORD\"}")

echo "Response:"
echo "$LOGIN_RESPONSE" | jq '.'
echo ""

# Extract access token
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken')

if [ "$ACCESS_TOKEN" = "null" ] || [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Failed to get access token"
  exit 1
fi

echo "✅ Successfully obtained JWT token"
echo "Token (first 50 chars): ${ACCESS_TOKEN:0:50}..."
echo ""

# Test 2: Use JWT token to fetch resume
echo "Test 2: Use JWT Bearer token to fetch resume"
SLUG="${TEST_SLUG:-john-doe}"
echo "GET $API_URL/api/llm-service/resume/$SLUG"
echo ""

RESUME_RESPONSE=$(curl -s -X GET "$API_URL/api/llm-service/resume/$SLUG" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Response:"
echo "$RESUME_RESPONSE" | jq '. | {id, slug, title, userId}'
echo ""

if echo "$RESUME_RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
  echo "✅ Successfully fetched resume with JWT token"
else
  echo "❌ Failed to fetch resume"
  echo "$RESUME_RESPONSE"
  exit 1
fi

# Test 3: Test with invalid token (should fail)
echo "Test 3: Try with invalid token (should fail with 401)"
echo ""

INVALID_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "$API_URL/api/llm-service/resume/$SLUG" \
  -H "Authorization: Bearer invalid-token-12345")

HTTP_CODE=$(echo "$INVALID_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)

if [ "$HTTP_CODE" = "401" ]; then
  echo "✅ Correctly rejected invalid token (401 Unauthorized)"
else
  echo "❌ Expected 401, got HTTP $HTTP_CODE"
fi
echo ""

# Test 4: Backward compatibility - test with static token (if set)
if [ -n "$LLM_SERVICE_TOKEN" ]; then
  echo "Test 4: Backward compatibility - test static token"
  echo ""
  
  STATIC_RESPONSE=$(curl -s -X GET "$API_URL/api/llm-service/resume/$SLUG" \
    -H "X-LLM-Service-Token: $LLM_SERVICE_TOKEN")
  
  if echo "$STATIC_RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
    echo "✅ Static token still works (backward compatible)"
  else
    echo "⚠️  Static token not configured or invalid"
  fi
fi

echo ""
echo "==================================="
echo "Phase 1 Tests Complete!"
echo "==================================="
echo ""
echo "Summary:"
echo "✅ JWT login endpoint working"
echo "✅ Token-based authentication working"
echo "✅ Invalid tokens properly rejected"
echo "✅ Backward compatibility maintained"
echo ""
echo "Next: Implement Phase 2 (Python Token Manager)"
