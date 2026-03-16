# Company Enrichment Troubleshooting Guide

## Quick Deploy

```bash
# 1. Commit changes
cd /Users/joseblanco/data/dev/my-resume
git add -A
git commit -m "feat: add comprehensive logging for LLM company enrichment troubleshooting"

# 2. Apply Terraform changes (LLM_API_KEY)
cd infra/gcp
terraform apply -auto-approve

# 3. Build and deploy  
cd ../..
gcloud builds submit --config=cloudbuild-api.yaml --timeout=15m

# 4. Restart LLM service (to pick up logging changes)
ssh your-server "pm2 restart llm-service"
```

## Real-Time Log Monitoring

### Watch API Service Logs (Cloud Run)
```bash
# Follow all logs
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=api-service" \
  --format=json --project=resume-cast-ai-prod | \
  jq -r '.textPayload // .jsonPayload.message // .jsonPayload | 
  if type=="string" then . else tostring end' | \
  grep --line-buffered -i -E "(company|enrich|llm|error)"

# Or simpler version
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=api-service" \
  --project=resume-cast-ai-prod
```

### Watch LLM Service Logs (Home Server)
```bash
# Via SSH
ssh your-server
pm2 logs llm-service --lines 100

# Or from local (if you have access)
tail -f ~/path/to/llm-service/logs/*.log
```

## Test the Flow End-to-End

### Step 1: Get JWT Token
```bash
# Replace with your actual credentials
export API_URL="https://api.resumecast.ai"

LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"youremail@example.com","password":"yourpassword"}')

export TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token')
echo "Token: $TOKEN"
```

### Step 2: Test Async Queue Mode (RECOMMENDED)
```bash
# This should return immediately with a job ID
curl -X POST "$API_URL/api/companies/enrich/queue" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"companyName":"Tesla"}' | jq .

# Expected response:
# {
#   "jobId": "123",
#   "companyName": "Tesla",
#   "status": "queued",
#   "message": "Company enrichment job queued successfully"
# }
```

### Step 3: Check Job Status
```bash
# Replace with actual job ID from step 2
JOB_ID="your-job-id"
curl -s "$API_URL/api/companies/enrich/status/$JOB_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Step 4: Test Sync Mode (Slow - 30-120s)
```bash
# This will block until complete
curl -X POST "$API_URL/api/companies/enrich" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"companyName":"Microsoft"}' | jq .
```

## Expected Log Flow

### When Request Arrives at API Service:
```
[CompaniesController] POST /companies/enrich called by user abc123 for company: Tesla
[enrichCompany] START: Tesla
[enrichCompany] Checking cache for: Tesla
[enrichCompany] No cached data found, fetching from LLM service
[enrichCompany] Calling LLM service for: Tesla
[fetchFromLLMService] Calling LLM service at https://llm-service.paskot.com/api/companies/enrich for: Tesla
```

### At LLM Service:
```
[AUTH] Verifying API key (present: True)
[AUTH] ✅ Valid API key for service: api-service
[SYNC MODE] Starting synchronous enrichment for: Tesla
[SYNC MODE] Initializing research agent...
[SYNC MODE] Research agent ready, starting research...
Starting LangChain research for company: Tesla
[SYNC MODE] Research complete for Tesla, got 15 result fields
[SYNC MODE] Result keys: ['companyName', 'legalName', 'website', ...]
```

### Back at API Service:
```
[fetchFromLLMService] LLM service responded in 45823ms with status 200
[fetchFromLLMService] LLM response data keys: company_data, sources
[fetchFromLLMService] Sync response: company_data present
[enrichCompany] LLM service returned data with 15 fields
Company enrichment complete: Tesla → Tesla, Inc.
[CompaniesController] Enrichment successful for Tesla, returned 20 fields
```

## Common Issues & Solutions

### ❌ No logs appearing at all
**Problem:** Request not reaching your endpoint
**Check:**
```bash
# Verify frontend is calling correct endpoint
# Check browser dev tools → Network → XHR

# Check if JWT auth is failing
gcloud logging read "resource.type=cloud_run_revision AND \
  resource.labels.service_name=api-service AND \
  severity>=ERROR" --limit=10 --project=resume-cast-ai-prod
```

### ❌ "LLM_API_KEY not configured"
**Problem:** Terraform not applied or wrong environment
**Solution:**
```bash
cd infra/gcp
terraform apply
# Verify deployment
gcloud run services describe api-service --region=us-central1 \
  --format=json | jq '.spec.template.spec.containers[0].env[] | select(.name=="LLM_API_KEY")'
```

### ❌ "Invalid or missing API key" (from LLM service)
**Problem:** API key mismatch between services
**Check:**
```bash
# Check API service has key
gcloud run services describe api-service --region=us-central1 \
  --format=json | jq '.spec.template.spec.containers[0].env[] | select(.name=="LLM_API_KEY")'

# Compare with LLM service config
ssh your-server
cat ~/apps/llm-service/.env | grep ADMIN_TOKEN
```

### ❌ Timeout after 60-120 seconds
**Problem:** LLM research takes too long
**Solution:**
- Use `/api/companies/enrich/queue` (async mode) instead
- Or wait for sync mode (now has 120s timeout)

### ❌ LLM service unreachable
**Problem:** Network issue or service down
**Check:**
```bash
# Test from your machine
curl -s https://llm-service.paskot.com/health | jq .

# Check if Ollama is running
ssh your-server
curl localhost:11434/api/tags
pm2 status
```

## Check Bull Board Queue Status

Open in browser: https://api.resumecast.ai/api/admin/queues

You should see:
- company-enrichment queue with jobs waiting/active/completed
- If empty → jobs not being queued (check controller logs)
- If stuck in "active" → worker crashed (check worker logs)
- If failed → see error in job details

## Manual Database Check

```bash
# SSH to your server or use Cloud SQL proxy
psql $DATABASE_URL

# Check if data exists
SELECT "companyName", "website", "updatedAt", "source" 
FROM "CompanyInfo" 
ORDER BY "updatedAt" DESC 
LIMIT 10;

# Check specific company
SELECT * FROM "CompanyInfo" 
WHERE "companyName" ILIKE '%tesla%';
```

## Performance Metrics

Normal timing:
- Queue endpoint: < 100ms (returns immediately)
- Sync endpoint: 30-90 seconds (full research)
- LLM service research: 25-60 seconds
- Database cache hit: < 50ms

If slower than these, check:
- Ollama model loaded (`ollama list`)
- Server CPU/RAM usage (`htop`)
- Network latency (`ping llm-service.paskot.com`)
