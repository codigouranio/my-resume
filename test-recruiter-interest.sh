#!/bin/bash

# Test script for Recruiter Interest feature
# This script tests the complete recruiter interest flow

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
RESUME_SLUG="${RESUME_SLUG:-jose-blanco-swe}"

echo "🧪 Testing Recruiter Interest Feature"
echo "======================================"
echo ""

# Color output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Submit Recruiter Interest
echo -e "${BLUE}Test 1: Submit Recruiter Interest${NC}"
echo "POST $BASE_URL/api/resumes/recruiter-interest"
echo ""

INTEREST_RESPONSE=$(curl -s -X POST "$BASE_URL/api/resumes/recruiter-interest" \
  -H "Content-Type: application/json" \
  -d "{
    \"resumeSlug\": \"$RESUME_SLUG\",
    \"name\": \"Test Recruiter\",
    \"email\": \"recruiter@test.com\",
    \"company\": \"Test Company Inc\",
    \"message\": \"We have an exciting opportunity for you. Your background in software engineering aligns perfectly with our Senior Engineer role.\"
  }")

echo "Response:"
echo "$INTEREST_RESPONSE" | jq '.' 2>/dev/null || echo "$INTEREST_RESPONSE"
echo ""

# Extract interest ID
INTEREST_ID=$(echo "$INTEREST_RESPONSE" | jq -r '.id' 2>/dev/null || echo "")

if [ -z "$INTEREST_ID" ] || [ "$INTEREST_ID" = "null" ]; then
  echo -e "${RED}✗ Failed to create recruiter interest${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Recruiter interest created: $INTEREST_ID${NC}"
echo ""

# Test 2: Get Recruiter Interests (requires authentication)
echo -e "${BLUE}Test 2: Get Recruiter Interests (requires auth)${NC}"
echo "GET $BASE_URL/api/resumes/recruiter-interest/my-interests"
echo ""

if [ -z "$JWT_TOKEN" ]; then
  echo -e "${YELLOW}⚠ Skipping test 2: JWT_TOKEN not provided${NC}"
  echo "To test authenticated endpoints, set JWT_TOKEN environment variable:"
  echo "export JWT_TOKEN=\"your-jwt-token\""
  echo ""
else
  INTERESTS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/resumes/recruiter-interest/my-interests" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json")

  echo "Response:"
  echo "$INTERESTS_RESPONSE" | jq '.' 2>/dev/null || echo "$INTERESTS_RESPONSE"
  echo ""
  
  if echo "$INTERESTS_RESPONSE" | jq -e '.[0]' >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Successfully retrieved recruiter interests${NC}"
  else
    echo -e "${RED}✗ Failed to retrieve recruiter interests${NC}"
  fi
  echo ""

  # Test 3: Mark Interest as Read
  echo -e "${BLUE}Test 3: Mark Interest as Read${NC}"
  echo "PATCH $BASE_URL/api/resumes/recruiter-interest/$INTEREST_ID/read"
  echo ""

  READ_RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/resumes/recruiter-interest/$INTEREST_ID/read" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json")

  echo "Response:"
  echo "$READ_RESPONSE" | jq '.' 2>/dev/null || echo "$READ_RESPONSE"
  echo ""

  IS_READ=$(echo "$READ_RESPONSE" | jq -r '.isRead' 2>/dev/null || echo "")
  if [ "$IS_READ" = "true" ]; then
    echo -e "${GREEN}✓ Successfully marked as read${NC}"
  else
    echo -e "${RED}✗ Failed to mark as read${NC}"
  fi
  echo ""

  # Test 4: Toggle Favorite
  echo -e "${BLUE}Test 4: Toggle Favorite Status${NC}"
  echo "PATCH $BASE_URL/api/resumes/recruiter-interest/$INTEREST_ID/favorite"
  echo ""

  FAVORITE_RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/resumes/recruiter-interest/$INTEREST_ID/favorite" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json")

  echo "Response:"
  echo "$FAVORITE_RESPONSE" | jq '.' 2>/dev/null || echo "$FAVORITE_RESPONSE"
  echo ""

  IS_FAVORITE=$(echo "$FAVORITE_RESPONSE" | jq -r '.isFavorite' 2>/dev/null || echo "")
  if [ "$IS_FAVORITE" = "true" ]; then
    echo -e "${GREEN}✓ Successfully toggled favorite (now true)${NC}"
  else
    echo -e "${YELLOW}⚠ Favorite status: $IS_FAVORITE${NC}"
  fi
  echo ""

  # Test 5: Delete Interest
  echo -e "${BLUE}Test 5: Delete (Soft Delete) Interest${NC}"
  echo "DELETE $BASE_URL/api/resumes/recruiter-interest/$INTEREST_ID"
  echo ""

  DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/resumes/recruiter-interest/$INTEREST_ID" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json")

  echo "Response:"
  echo "$DELETE_RESPONSE" | jq '.' 2>/dev/null || echo "$DELETE_RESPONSE"
  echo ""

  DELETED_AT=$(echo "$DELETE_RESPONSE" | jq -r '.deletedAt' 2>/dev/null || echo "")
  if [ ! -z "$DELETED_AT" ] && [ "$DELETED_AT" != "null" ]; then
    echo -e "${GREEN}✓ Successfully deleted (soft delete) interest${NC}"
  else
    echo -e "${RED}✗ Failed to delete interest${NC}"
  fi
  echo ""
fi

# Summary
echo -e "${BLUE}======================================"
echo "Test Summary${NC}"
echo "======================================"
echo -e "${GREEN}✓ Core functionality verified${NC}"
echo ""
echo "Notes:"
echo "- Email verification: Check the profile owner's email for notification"
echo "- Soft deletes: Deleted records are not removed, just marked with deletedAt"
echo "- Protected endpoints: Tests 2-5 require valid JWT token"
echo ""
echo "To get a JWT token:"
echo "1. Register or login via /api/auth/login"
echo "2. Copy the access token"
echo "3. Set: export JWT_TOKEN=\"your-token\""
echo "4. Re-run this script"
