# Company Enrichment - Complete User Flow

This document describes the complete workflow for automatic company enrichment with email notifications.

## User Flow

### 1. Create Interview & Type Company Name
```
User opens InterviewForm → Types "Google" in company field
```

**What happens:**
- After 1 second debounce, frontend checks database for cached company info
- If found → displays enriched data immediately
- If NOT found → queues background enrichment job

### 2. Background Enrichment (10-30 seconds)
```
BullMQ Queue → Worker → LangChain Agent → Google Search → vLLM extraction
```

**What happens:**
- Job queued in Redis with unique jobId
- Worker picks up job and calls LLM service
- LangChain agent performs 7 specialized Google searches
- vLLM extracts structured data (industry, employees, salary, etc.)
- Results saved to CompanyInfo table
- **Auto-links to any existing interviews** with matching company name
- **Sends email notification** to user

### 3. User Receives Email
```
Subject: ✅ Company Research Complete: Google
```

**Email content:**
- Company logo (if found)
- Company description
- Key details (industry, size, employees, salary, Glassdoor rating)
- **"View Interview Tracker"** button → links to dashboard

### 4. User Opens Interview Tracker
```
User clicks email link → Dashboard → Interview Detail
```

**What happens:**
- Interview now has `companyInfo` relation populated
- Details page shows full enriched data:
  - Company logo, website, social links
  - Description and industry
  - Size metrics (employees, revenue)
  - Compensation (avg salary, Glassdoor rating, benefits)
  - Funding info (total funding, investors)
- Card view shows compact version (logo, badges, salary)

## Architecture Diagram

```
┌─────────────────┐
│                 │
│  InterviewForm  │  User types "Google"
│   (Frontend)    │
│                 │
└────────┬────────┘
         │
         │ 1. Check cache
         ▼
┌─────────────────┐
│                 │
│  GET /companies │  Cache lookup (instant)
│     /:name      │
│                 │
└────────┬────────┘
         │
         │ 404 Not Found
         ▼
┌─────────────────┐
│                 │
│ POST /companies │  Queue job (returns jobId)
│  /enrich/queue  │
│                 │
└────────┬────────┘
         │
         │ Queue job
         ▼
┌─────────────────┐
│                 │
│   Redis Queue   │  Job waiting
│    (BullMQ)     │
│                 │
└────────┬────────┘
         │
         │ Worker picks job
         ▼
┌─────────────────┐
│                 │
│ CompaniesWorker │  Process enrichment
│    Service      │
│                 │
└────────┬────────┘
         │
         │ Call enrichment
         ▼
┌─────────────────┐
│                 │
│ CompaniesService│  Orchestrate research
│  .enrichCompany │
│                 │
└────────┬────────┘
         │
         │ HTTP POST
         ▼
┌─────────────────┐
│                 │
│  LLM Service    │  Flask + LangChain
│ /companies/enrich│
│                 │
└────────┬────────┘
         │
         │ Research agent
         ▼
┌─────────────────┐
│                 │
│ LangChain Agent │  ReAct pattern
│ + Google Search │
│                 │
└────────┬────────┘
         │
         │ 7 specialized searches
         ▼
┌─────────────────┐
│                 │
│   vLLM Model    │  Extract structured data
│  (3x RTX 3090)  │
│                 │
└────────┬────────┘
         │
         │ Enriched data
         ▼
┌─────────────────┐
│                 │
│   PostgreSQL    │  Save to CompanyInfo table
│  CompanyInfo    │
│                 │
└────────┬────────┘
         │
         │ Auto-link
         ▼
┌─────────────────┐
│                 │
│ InterviewProcess│  Update companyInfoId
│  .updateMany()  │
│                 │
└────────┬────────┘
         │
         │ Send notification
         ▼
┌─────────────────┐
│                 │
│  EmailService   │  AWS SES
│  .sendCompany   │
│   Enrichment()  │
│                 │
└────────┬────────┘
         │
         │ Email sent
         ▼
┌─────────────────┐
│                 │
│  User's Inbox   │  ✅ Company Research Complete
│                 │
└─────────────────┘
```

## Key Features

### ✅ Non-blocking UI
- User doesn't wait 10-30 seconds
- Can save interview immediately
- Continue working while research happens in background

### ✅ Auto-linking
- If user saves interview before enrichment completes:
  1. Interview created with `companyInfoId: null`
  2. Worker completes enrichment
  3. **Worker automatically links** company info to all matching interviews
  4. User opens interview → sees enriched data

### ✅ Email Notifications
- User informed when research completes
- Rich HTML email with company details
- Direct link to interview tracker
- Works even if user closed the app

### ✅ Polling Fallback
- If user keeps form open:
  - Frontend polls job status every 3 seconds
  - Shows enriched data immediately when ready
  - No need to wait for email

### ✅ Graceful Degradation
- If enrichment fails → job retries (3 attempts)
- If all retries fail → user gets error in UI
- Interview still works without company data
- Email only sent on success

## Database Schema

### CompanyInfo Table
```prisma
model CompanyInfo {
  id              String   @id @default(cuid())
  companyName     String   @unique
  description     String?  @db.Text
  industry        String?
  founded         Int?
  headquarters    String?
  website         String?  @db.Text
  employeeCount   String?
  revenue         String?
  companySize     String?
  fundingTotal    String?
  lastFunding     String?
  investors       String[]
  logoUrl         String?  @db.Text
  avgSalary       String?
  glassdoorRating Float?
  benefits        String[]
  linkedinUrl     String?  @db.Text
  twitterHandle   String?
  githubUrl       String?  @db.Text
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  source          String?
  
  interviews      InterviewProcess[]
}
```

### InterviewProcess Relation
```prisma
model InterviewProcess {
  // ... existing fields
  
  companyInfoId String?
  companyInfo   CompanyInfo? @relation(fields: [companyInfoId], references: [id], onDelete: SetNull)
  
  @@index([companyInfoId])
}
```

## API Endpoints

### Queue Enrichment (Non-blocking)
```bash
POST /companies/enrich/queue
Authorization: Bearer <token>
Content-Type: application/json

{
  "companyName": "Google"
}

Response:
{
  "jobId": "enrich-google-1234567890",
  "companyName": "Google",
  "status": "queued",
  "message": "Company enrichment job queued successfully"
}
```

### Check Job Status
```bash
GET /companies/enrich/status/:jobId
Authorization: Bearer <token>

Response (in progress):
{
  "jobId": "enrich-google-1234567890",
  "companyName": "Google",
  "status": "active",
  "progress": null,
  "result": null
}

Response (completed):
{
  "jobId": "enrich-google-1234567890",
  "companyName": "Google",
  "status": "completed",
  "result": {
    "success": true,
    "companyName": "Google",
    "data": { /* CompanyInfo object */ }
  }
}
```

### Synchronous Enrichment (Fallback)
```bash
POST /companies/enrich
Authorization: Bearer <token>
Content-Type: application/json

{
  "companyName": "Google"
}

# Blocks for 10-30 seconds, returns enriched data directly
```

## Setup Instructions

### 1. Install Dependencies

**Backend (API Service):**
```bash
cd apps/api-service
npm install bullmq ioredis
```

**LLM Service (Python with Poetry):**
```bash
cd apps/llm-service
poetry install --no-root
```

**Note:** All dependencies including LangChain are already in `pyproject.toml`.

### 2. Install Redis
```bash
# macOS
brew install redis
brew services start redis

# Docker
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

### 3. Configure Environment Variables

**apps/api-service/.env:**
```env
# Redis for BullMQ
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# LLM Service
LLM_SERVICE_URL=http://localhost:5000

# Email (AWS SES)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
SES_FROM_EMAIL=noreply@resumecast.ai

# Frontend URL (for email links)
FRONTEND_URL=https://resumecast.ai
```

### 4. Apply Database Migration
```bash
cd apps/api-service
npx prisma migrate deploy
npm run prisma:generate
```

### 5. Restart Services
```bash
# API Service
cd apps/api-service
npm run start:dev

# LLM Service
cd apps/llm-service
python app.py
```

## Testing the Flow

### 1. Create Interview
```bash
# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Save token
TOKEN="<access_token>"

# Create interview (company not enriched yet)
curl -X POST http://localhost:3000/interviews \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"company":"xAI","position":"ML Engineer","status":"APPLIED"}'
```

### 2. Watch Logs
```bash
# API service logs
tail -f apps/api-service/logs/app.log

# Expected output:
# [CompaniesWorkerService] Processing enrichment job enrich-xai-123 for company: xAI
# [CompaniesService] Enriching company: xAI
# [CompaniesService] Fetching fresh data from LLM service for: xAI
# [CompaniesWorkerService] Successfully enriched company: xAI
# [CompaniesWorkerService] Auto-linked 1 interview(s) to xAI
# [EmailService] Sending enrichment notification email to test@example.com
```

### 3. Check Email
- Check inbox for "✅ Company Research Complete: xAI"
- Click "View Interview Tracker" button

### 4. Verify Data
```bash
# Check database
psql -d resumecast -c "SELECT * FROM \"CompanyInfo\" WHERE \"companyName\" = 'xAI';"

# Check linked interview
psql -d resumecast -c "SELECT id, company, \"companyInfoId\" FROM \"InterviewProcess\" WHERE company = 'xAI';"
```

## Monitoring

### Redis Queue Stats
```bash
redis-cli

# Queue length
LLEN bull:company-enrichment:wait

# Active jobs
LLEN bull:company-enrichment:active

# Completed count
GET bull:company-enrichment:completed

# Failed count
GET bull:company-enrichment:failed
```

### BullMQ Board (Web UI)
```bash
npm install -g @bull-board/cli
bull-board
# Open http://localhost:3000
```

## Troubleshooting

### Job Stuck in "active"
**Cause:** Worker crashed while processing
**Solution:** Restart API service

### Email Not Sent
**Cause:** AWS SES credentials missing or email not verified
**Solution:** 
1. Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env
2. Verify sender email in AWS SES console

### LangChain Import Error
**Cause:** Dependencies not installed in LLM service
**Solution:**
```bash
cd apps/llm-service
poetry install --no-root
```

### Auto-linking Not Working
**Cause:** Company names don't match exactly
**Solution:** Check case-insensitive matching in CompaniesService.linkToInterviews()

## Performance Notes

- **Cache hit:** <100ms (instant)
- **Cache miss (queue):** <50ms (returns jobId)
- **Enrichment time:** 10-30 seconds (background)
- **Email delivery:** 1-3 seconds (AWS SES)
- **Worker concurrency:** 2 jobs in parallel (rate limit friendly)

## Future Enhancements

1. **WebSocket notifications**: Real-time updates instead of polling
2. **Batch enrichment**: Queue multiple companies at once
3. **Smart priorities**: Premium users get higher priority
4. **Pre-warming**: Auto-enrich popular companies (FAANG, etc.)
5. **Better tools**: Add Crunchbase API, LinkedIn API to LangChain agent
6. **Enrichment status field**: Track in InterviewProcess table (pending/complete/failed)
