# Position Fit Scoring Feature

## Overview

Automated AI-powered position fit scoring system that analyzes job postings and calculates a 1-10 fit score based on:
- Resume content (public + hidden LLM context)
- Journal posts (last 20 entries marked for AI)
- Job posting requirements (fetched from URL or provided description)
- Skills, experience, and career trajectory alignment

## Architecture

### Components

1. **LLM Service** (`apps/llm-service/`)
   - `position_fit_agent.py` - AI agent that fetches job postings and analyzes fit
   - `/api/positions/score` - REST endpoint for scoring

2. **API Service** (`apps/api-service/`)
   - `position-scoring.queue.ts` - BullMQ queue definition
   - `position-scoring.worker.ts` - Background job processor
   - `companies.controller.ts` - REST endpoints for queuing and status
   - `dto/score-position.dto.ts` - Request validation

3. **Database**
   - `InterviewProcess.fitScore` (Float?) - 1-10 score
   - `InterviewProcess.fitAnalysis` (String?) - JSON with analysis details

4. **Bull Board**
   - `position-scoring` queue visible at `/api/admin/queues`

## Usage

### Queue a Position Scoring Job

**Endpoint:** `POST /api/companies/positions/score/queue`

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request Body:**
```json
{
  "interviewId": "cm123abc456",
  "company": "Google",
  "position": "Senior Software Engineer",
  "jobUrl": "https://careers.google.com/jobs/123456", // optional
  "jobDescription": "We are looking for..." // optional, used if jobUrl not provided
}
```

**Response:**
```json
{
  "jobId": "score-cm123abc456-1678901234567",
  "interviewId": "cm123abc456",
  "status": "queued",
  "message": "Position scoring job queued successfully"
}
```

### Check Job Status

**Endpoint:** `GET /api/companies/positions/score/status/:jobId`

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response (In Progress):**
```json
{
  "jobId": "score-cm123abc456-1678901234567",
  "interviewId": "cm123abc456",
  "position": "Senior Software Engineer",
  "company": "Google",
  "status": "active",
  "progress": 0,
  "result": null,
  "attemptsMade": 0,
  "timestamp": 1678901234567
}
```

**Response (Completed):**
```json
{
  "jobId": "score-cm123abc456-1678901234567",
  "interviewId": "cm123abc456",
  "position": "Senior Software Engineer",
  "company": "Google",
  "status": "completed",
  "progress": 100,
  "result": {
    "success": true,
    "interviewId": "cm123abc456",
    "fitScore": 8.5,
    "analysis": {
      "summary": "Strong technical match with some leadership experience gaps.",
      "strengths": [
        "10+ years Python experience exceeds 5-year requirement",
        "Led team of 5 engineers, demonstrating leadership",
        "Recent work with AWS matches cloud infrastructure needs"
      ],
      "gaps": [
        "No direct experience with Kubernetes at scale",
        "Limited frontend experience (React mentioned but not deep)"
      ],
      "recommendations": [
        "Highlight Python expertise and cloud architecture wins in interview",
        "Prepare examples of learning new technologies quickly (e.g., AWS adoption)",
        "Consider taking Kubernetes course to fill knowledge gap"
      ]
    }
  },
  "failedReason": null,
  "attemptsMade": 1,
  "timestamp": 1678901234567
}
```

## How It Works

### 1. Job Queuing (API Service)

When a scoring request is received:
1. Controller validates the request (DTO validation)
2. Checks for duplicate jobs (same interviewId)
3. Queues job in BullMQ with unique job ID
4. Returns immediately with job ID

### 2. Background Processing (Worker)

Worker picks up job and:
1. Fetches user data:
   - Default resume (content + llmContext)
   - Last 20 journal posts (where `includeInAI: true`)
2. Calls LLM service `/api/positions/score` endpoint
3. Updates `InterviewProcess` with results:
   - `fitScore` (Float 1-10)
   - `fitAnalysis` (JSON string)

### 3. AI Analysis (LLM Service)

Position fit agent:
1. **Fetches job posting** (if URL provided):
   - HTTP request with user agent
   - Parses HTML with BeautifulSoup
   - Extracts text content
2. **Builds analysis prompt**:
   - Job requirements
   - Resume content
   - Hidden LLM context
   - Journal entries (last 10 for brevity)
3. **Calls LLM** (via RemoteLLMWrapper):
   - Analyzes technical skills match
   - Evaluates experience alignment
   - Assesses culture fit indicators
   - Identifies knowledge gaps
4. **Parses response**:
   - Extracts JSON from LLM output
   - Validates score (1-10 range)
   - Returns structured analysis

## Database Schema Changes

```prisma
model InterviewProcess {
  // ... existing fields ...
  
  // AI-powered analysis
  fitScore        Float?   // 1-10 AI-calculated fit score
  fitAnalysis     String?  @db.Text // JSON: {strengths, gaps, recommendations, summary}
  
  // ... rest of fields ...
}
```

**After adding these fields:**
```bash
cd apps/api-service
npm run prisma:generate
npm run prisma:migrate -- --name add_fit_score
```

## BullMQ Configuration

**Queue:** `position-scoring`

**Options:**
- Concurrency: 1 (LLM-intensive, process one at a time)
- Attempts: 2 (less retries than company enrichment)
- Backoff: Exponential, 10s delay
- Timeout: 3 minutes (handled at worker level via axios timeout)
- Retention:
  - Completed jobs: 7 days (200 max)
  - Failed jobs: 30 days

## Monitoring

Access Bull Board: `http://localhost:3000/api/admin/queues`
- View job status (waiting, active, completed, failed)
- See job progress and results
- Retry failed jobs manually
- **Note:** Only accessible from local network (nginx + LocalNetworkGuard)

## Error Handling

### Job Failures

Jobs may fail due to:
1. **User not found** - Invalid userId
2. **No default resume** - User hasn't set default resume
3. **LLM service unavailable** - Service down or timeout
4. **Job posting fetch failed** - Invalid URL, site blocking
5. **LLM parsing error** - LLM output format unexpected

Failed jobs:
- Retry once after 10s
- Maximum 2 attempts
- Error stored in `failedReason`
- Kept in queue for 30 days

### Graceful Degradation

If LLM analysis fails:
```json
{
  "fitScore": 5.0,
  "analysis": {
    "summary": "Analysis failed: [error message]",
    "strengths": [],
    "gaps": [],
    "recommendations": ["Unable to complete analysis. Please try again."]
  }
}
```

## Testing

### Manual Test (Local)

1. **Start services:**
```bash
# Terminal 1: LLM service
cd apps/llm-service
USE_POETRY=true ./run.sh

# Terminal 2: Redis
redis-server

# Terminal 3: API service
cd apps/api-service
npm run start:dev
```

2. **Queue a scoring job:**
```bash
curl -X POST http://localhost:3000/api/companies/positions/score/queue \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "interviewId": "cm123abc456",
    "company": "OpenAI",
    "position": "ML Engineer",
    "jobUrl": "https://careers.openai.com/jobs/123"
  }'
```

3. **Check status:**
```bash
curl http://localhost:3000/api/companies/positions/score/status/JOB_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

4. **Monitor in Bull Board:**
Open http://localhost:3000/api/admin/queues

### Test Directly (LLM Service)

```bash
curl -X POST http://localhost:5000/api/positions/score \
  -H "Content-Type: application/json" \
  -d '{
    "company": "Google",
    "position": "Senior Engineer",
    "jobUrl": "https://careers.google.com/jobs/123",
    "resume": {
      "content": "# John Doe\n\n## Experience\n\n...",
      "llmContext": "Hidden notes about side projects..."
    },
    "journalEntries": [
      {
        "title": "",
        "content": "Today I learned about Kubernetes scaling patterns...",
        "tags": [],
        "date": "2024-01-15T10:00:00Z"
      }
    ]
  }'
```

## Future Enhancements

- [ ] UI button in interview tracker to trigger scoring
- [ ] Real-time progress updates via WebSocket
- [ ] Batch scoring for multiple interviews
- [ ] Score history tracking (re-score over time)
- [ ] Comparative analysis (rank interviews by fit)
- [ ] Email notifications when scoring completes
- [ ] Integration with interview timeline
- [ ] Export analysis to PDF

## Dependencies

**Python (LLM Service):**
- `beautifulsoup4` - HTML parsing for job postings
- `requests` - HTTP client for fetching URLs
- `langchain` - LLM framework (already in pyproject.toml)

**TypeScript (API Service):**
- `bullmq` - Queue management
- `axios` - HTTP client for LLM service calls
- `@bull-board/*` - Queue monitoring UI

## Configuration

**Environment Variables:**

**API Service (.env):**
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
LLM_SERVICE_URL=http://localhost:5000
```

**LLM Service (.env):**
```env
LLAMA_SERVER_URL=http://localhost:11434
LLAMA_API_TYPE=ollama
DATABASE_URL=postgresql://user:pass@localhost:5432/resume_db
```

## Troubleshooting

### Issue: "fitScore does not exist in type"

**Cause:** TypeScript server hasn't picked up Prisma client regeneration

**Fix:**
```bash
cd apps/api-service
npm run prisma:generate
# Restart VS Code TypeScript server: Cmd+Shift+P → "TypeScript: Restart TS Server"
```

### Issue: Job stuck in "waiting" state

**Cause:** Worker not running or Redis connection failed

**Fix:**
1. Check Redis: `redis-cli ping` → Should return `PONG`
2. Check worker logs: API service logs show "Position scoring worker initialized"
3. Check Bull Board: Any jobs in "active" state?

### Issue: LLM service returns 500 error

**Cause:** 
- Ollama/LLAMA server not running
- Invalid resume data
- Timeout (job taking > 3 minutes)

**Fix:**
1. Check LLM service health: `curl http://localhost:5000/health`
2. Check Ollama: `curl http://localhost:11434/api/tags`
3. Review LLM service logs for specifics

### Issue: Job posting fetch fails

**Cause:**
- Site blocks automated requests
- Invalid URL
- Site requires authentication

**Fix:**
- Provide `jobDescription` instead of `jobUrl`
- Manual copy-paste of job posting text

## Migration Guide

### Deploying to Production

1. **Update Prisma schema:**
```bash
cd apps/api-service
git pull
npm run prisma:migrate -- --name add_fit_score
```

2. **Deploy LLM service:**
```bash
cd apps/llm-service
git pull
poetry install --no-root
pm2 restart llm-service
```

3. **Deploy API service:**
```bash
cd apps/api-service
npm install
npm run build
pm2 restart api-service
```

4. **Verify Bull Board:**
- SSH tunnel: `ssh -L 3000:localhost:3000 user@server`
- Open: http://localhost:3000/api/admin/queues
- Should see "position-scoring" queue

5. **Test:**
```bash
# On production server
curl -X POST http://localhost:3000/api/companies/positions/score/queue \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"interviewId":"ID","company":"Test","position":"Test"}'
```

## Support

For issues:
1. Check Bull Board for job status
2. Review API service logs: `pm2 logs api-service`
3. Review LLM service logs: `pm2 logs llm-service`
4. Check Redis: `redis-cli monitor` (watch commands)

---

**Created:** March 2026  
**Author:** AI Resume Platform Team  
**Version:** 1.0
