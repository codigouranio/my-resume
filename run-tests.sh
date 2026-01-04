#!/bin/bash
# Comprehensive Test Suite for My Resume Platform
set -e

echo "═══════════════════════════════════════════════════════"
echo "  My Resume Platform - Test Suite"
echo "═══════════════════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run and report test results
run_test_suite() {
    local name=$1
    local command=$2
    local path=$3
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Testing: $name"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    cd "$path"
    
    if eval "$command" > /tmp/test_output.log 2>&1; then
        echo -e "${GREEN}✓ PASSED${NC}"
        # Count passed tests
        if grep -q "Tests:.*passed" /tmp/test_output.log; then
            local passed=$(grep "Tests:" /tmp/test_output.log | grep -o "[0-9]* passed" | grep -o "[0-9]*" || echo "0")
            local total=$(grep "Tests:" /tmp/test_output.log | grep -o "[0-9]* total" | grep -o "[0-9]*" || echo "0")
            echo "  Tests: $passed/$total passed"
            PASSED_TESTS=$((PASSED_TESTS + passed))
            TOTAL_TESTS=$((TOTAL_TESTS + total))
        elif grep -q "passed" /tmp/test_output.log; then
            local passed=$(grep -o "[0-9]* passed" /tmp/test_output.log | grep -o "[0-9]*" | head -1 || echo "1")
            PASSED_TESTS=$((PASSED_TESTS + passed))
            TOTAL_TESTS=$((TOTAL_TESTS + passed))
            echo "  Tests: $passed passed"
        fi
    else
        echo -e "${RED}✗ FAILED${NC}"
        cat /tmp/test_output.log | tail -20
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    echo ""
}

# 1. Backend API Service Tests
run_test_suite \
    "Backend API Service (NestJS)" \
    "npm test -- --testPathPattern='search.service.spec|embedding.processor.spec' --silent" \
    "/Users/joseblanco/data/dev/my-resume/apps/api-service"

# 2. LLM Service Tests (Python)
run_test_suite \
    "LLM Service (Flask/Python)" \
    "python -m pytest test_app_remote.py -v --tb=short -q" \
    "/Users/joseblanco/data/dev/my-resume/apps/llm-service"

# 3. Integration Tests (Production API)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Testing: Production API Integration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

INTEGRATION_PASSED=0
INTEGRATION_TOTAL=0

# Test 1: API Reachable (check Express is running - 401 is good, means it's up)
RESPONSE=$(curl -s 'http://172.16.23.127:3000/api/resumes')
if echo "$RESPONSE" | grep -q "Unauthorized\|message"; then
    echo -e "${GREEN}✓${NC} API Service Running"
    INTEGRATION_PASSED=$((INTEGRATION_PASSED + 1))
else
    echo -e "${RED}✗${NC} API Service Running"
fi
INTEGRATION_TOTAL=$((INTEGRATION_TOTAL + 1))

# Test 2: LLM Service Health
if curl -s http://172.16.23.127:5000/health | grep -q "healthy"; then
    echo -e "${GREEN}✓${NC} LLM Service Health"
    INTEGRATION_PASSED=$((INTEGRATION_PASSED + 1))
else
    echo -e "${RED}✗${NC} LLM Service Health"
fi
INTEGRATION_TOTAL=$((INTEGRATION_TOTAL + 1))

# Test 3: Search API
SEARCH_RESULT=$(curl -s -X POST http://172.16.23.127:3000/api/embeddings/search \
  -H "Content-Type: application/json" \
  -d '{"query":"Python developer","minSimilarity":0.3,"limit":1}')

if echo "$SEARCH_RESULT" | grep -q "results"; then
    echo -e "${GREEN}✓${NC} Semantic Search API"
    INTEGRATION_PASSED=$((INTEGRATION_PASSED + 1))
else
    echo -e "${RED}✗${NC} Semantic Search API"
fi
INTEGRATION_TOTAL=$((INTEGRATION_TOTAL + 1))

# Test 4: Frontend Loads
if curl -s 'http://172.16.23.127/' | grep -qi "doctype html"; then
    echo -e "${GREEN}✓${NC} Frontend Loading"
    INTEGRATION_PASSED=$((INTEGRATION_PASSED + 1))
else
    echo -e "${RED}✗${NC} Frontend Loading"
fi
INTEGRATION_TOTAL=$((INTEGRATION_TOTAL + 1))

# Test 5: Search Page Loads
if curl -s 'http://172.16.23.127/search' | grep -qi "doctype html"; then
    echo -e "${GREEN}✓${NC} Search Page Loading"
    INTEGRATION_PASSED=$((INTEGRATION_PASSED + 1))
else
    echo -e "${RED}✗${NC} Search Page Loading"
fi
INTEGRATION_TOTAL=$((INTEGRATION_TOTAL + 1))

echo "  Tests: $INTEGRATION_PASSED/$INTEGRATION_TOTAL passed"
PASSED_TESTS=$((PASSED_TESTS + INTEGRATION_PASSED))
TOTAL_TESTS=$((TOTAL_TESTS + INTEGRATION_TOTAL))

echo ""

# Summary
echo "═══════════════════════════════════════════════════════"
echo "  Test Summary"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$((TOTAL_TESTS - PASSED_TESTS))${NC}"

if [ $((TOTAL_TESTS - PASSED_TESTS)) -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo ""
    echo -e "${YELLOW}⚠️  Some tests failed${NC}"
    exit 1
fi
