# Company Enrichment with BullMQ + LangChain

This feature uses **BullMQ** (job queue) + **LangChain** (AI agent framework) to perform background company research.

## Architecture

```
Frontend → API Service → BullMQ Queue → Worker → LLM Service → LangChain Agent → Google Search
                ↓                          ↓
            (immediate)              (background)
              response                processing
```

### Components

1. **LangChain Agent** (`apps/llm-service/company_research_agent.py`)
   - Custom vLLM wrapper implementing LangChain's LLM interface
   - Google Search tool wrapped as LangChain Tool
   - ReAct agent executor (Reason + Act pattern)
   - 7 specialized search queries per company

2. **BullMQ Queue** (`apps/api-service/src/features/companies/companies.queue.ts`)
   - Redis-backed job queue
   - Deduplication (prevents duplicate jobs for same company)
   - Retry logic (3 attempts with exponential backoff)
   - Job lifecycle management

3. **Worker Service** (`apps/api-service/src/features/companies/companies.worker.ts`)
   - NestJS service that processes queued jobs
   - Runs independently (can scale horizontally)
   - Calls CompaniesService.enrichCompany()

4. **REST Endpoints** (`apps/api-service/src/features/companies/companies.controller.ts`)
   - `POST /companies/enrich` - Synchronous (blocks 10-30s)
   - `POST /companies/enrich/queue` - Async (returns job ID immediately)
   - `GET /companies/enrich/status/:jobId` - Check job progress

## Prerequisites

### 1. Install Dependencies

**API Service (Node.js):**
```bash
cd apps/api-service
npm install bullmq ioredis
```

**LLM Service (Python):**
```bash
cd apps/llm-service
pip install langchain==0.1.0 langchain-core==0.1.10 langchain-community==0.0.13
# Or with Poetry:
poetry add langchain langchain-core langchain-community
```

### 2. Install Redis

**macOS:**
```bash
brew install redis
brew services start redis
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

**Docker:**
```bash
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

### 3. Configure Environment Variables

Add to `apps/api-service/.env`:
```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=         # Leave empty for local dev

# LLM Service URL
LLM_SERVICE_URL=http://localhost:5000
```

## Usage

### Option 1: Synchronous (Simple, Blocks UI)

**Frontend:**
```typescript
const companyInfo = await apiClient.enrichCompany("Google");
// Blocks for 10-30 seconds until complete
```

**Backend:**
```bash
POST /companies/enrich
{
  "companyName": "Google"
}
```

### Option 2: Asynchronous (BullMQ, Non-blocking)

**Frontend:**
```typescript
// Queue the job
const { jobId } = await apiClient.queueCompanyEnrichment("Google");

// Poll for status (or use WebSocket for real-time updates)
const checkStatus = async () => {
  const status = await apiClient.getEnrichmentJobStatus(jobId);
  
  if (status.status === 'completed') {
    console.log('Enriched data:', status.result);
    return status.result.data;
  } else if (status.status === 'failed') {
    console.error('Job failed:', status.failedReason);
  } else {
    // Still processing, check again in 2 seconds
    setTimeout(checkStatus, 2000);
  }
};

checkStatus();
```

**Backend:**
```bash
# Queue job
POST /companies/enrich/queue
{
  "companyName": "Google"
}
Response: { "jobId": "enrich-google-1234567890", "status": "queued" }

# Check status
GET /companies/enrich/status/enrich-google-1234567890
Response: {
  "status": "completed",
  "result": { "success": true, "data": {...} }
}
```

## Job Lifecycle

1. **Queued**: Job added to Redis queue
2. **Waiting**: Job waiting for available worker
3. **Active**: Worker processing job
4. **Completed**: Job succeeded, result stored
5. **Failed**: Job failed after 3 attempts

### Job Configuration

```typescript
defaultJobOptions: {
  attempts: 3,                    // Retry 3 times
  backoff: {
    type: 'exponential',
    delay: 5000,                  // 5s, 25s, 125s delays
  },
  removeOnComplete: {
    age: 24 * 3600,               // Keep 24 hours
    count: 100,
  },
  removeOnFail: {
    age: 7 * 24 * 3600,           // Keep 7 days
  },
}
```

## Monitoring

### Redis CLI

```bash
redis-cli

# Check queue length
LLEN bull:company-enrichment:wait

# List all jobs
KEYS bull:company-enrichment:*

# Get job details
HGETALL bull:company-enrichment:job-id
```

### BullMQ Board (Web UI)

Install globally:
```bash
npm install -g bull-board
bull-board
```

Access at `http://localhost:3000` to see:
- Active/waiting/completed/failed jobs
- Job details and logs
- Retry failed jobs
- Clear old jobs

## Frontend Integration

### Update API Client

Add to `apps/my-resume/src/shared/api/client.ts`:

```typescript
async queueCompanyEnrichment(companyName: string) {
  return this.request<{ jobId: string; status: string }>(
    '/companies/enrich/queue',
    {
      method: 'POST',
      body: JSON.stringify({ companyName }),
    }
  );
}

async getEnrichmentJobStatus(jobId: string) {
  return this.request<{
    jobId: string;
    status: string;
    result?: any;
    failedReason?: string;
  }>(`/companies/enrich/status/${jobId}`, {
    method: 'GET',
  });
}
```

### Update InterviewForm

Replace immediate enrichment with queued approach:

```typescript
useEffect(() => {
  if (!company || company.length < 3) return;

  const timer = setTimeout(async () => {
    setIsEnriching(true);
    
    try {
      // Queue enrichment job
      const { jobId } = await apiClient.queueCompanyEnrichment(company);
      
      // Poll for completion
      const pollStatus = async () => {
        const status = await apiClient.getEnrichmentJobStatus(jobId);
        
        if (status.status === 'completed' && status.result?.success) {
          setCompanyInfo(status.result.data);
          setIsEnriching(false);
        } else if (status.status === 'failed') {
          setEnrichmentError('Failed to enrich company');
          setIsEnriching(false);
        } else {
          // Still processing
          setTimeout(pollStatus, 2000);
        }
      };
      
      pollStatus();
    } catch (error) {
      setEnrichmentError(error.message);
      setIsEnriching(false);
    }
  }, 1000);

  return () => clearTimeout(timer);
}, [company]);
```

## Production Deployment

### 1. Redis Setup

Use managed Redis service:
- **AWS**: ElastiCache
- **GCP**: Cloud Memorystore
- **Azure**: Azure Cache for Redis
- **Self-hosted**: Redis cluster with persistence

### 2. Worker Scaling

Run multiple worker instances:

```bash
# Server 1
npm run start:prod

# Server 2 (worker only)
NODE_ENV=production node dist/main.js --workers-only
```

Or with PM2:
```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'api-service',
      script: 'dist/main.js',
      instances: 2,
      exec_mode: 'cluster',
    },
    {
      name: 'company-worker',
      script: 'dist/main.js',
      instances: 4,  // 4 workers for enrichment jobs
      env: {
        WORKER_MODE: 'company-enrichment'
      }
    }
  ]
};
```

### 3. Monitoring

- Use BullMQ metrics (Prometheus/Grafana)
- Set up alerts for failed jobs
- Monitor queue length (alert if > 100)
- Track job processing time

## Troubleshooting

### Redis Connection Failed
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```
**Solution**: Check Redis is running: `redis-cli ping` (should return PONG)

### Jobs Stuck in "Active"
**Solution**: Worker crashed. Restart worker service.

### High Memory Usage
**Solution**: Reduce job retention or clear old jobs:
```typescript
await queue.clean(24 * 3600 * 1000, 'completed');
await queue.clean(7 * 24 * 3600 * 1000, 'failed');
```

### LangChain Import Errors
```
ModuleNotFoundError: No module named 'langchain'
```
**Solution**: Install LangChain packages in LLM service virtualenv

## Benefits of BullMQ Approach

✅ **Non-blocking UI**: Users don't wait 10-30 seconds for enrichment
✅ **Retry logic**: Failed jobs automatically retry with backoff
✅ **Scalable**: Add more workers to process jobs faster
✅ **Deduplication**: Same company queued multiple times = 1 job
✅ **Monitoring**: BullMQ Board provides job visibility
✅ **Rate limiting**: Control Google Search request rate
✅ **LangChain integration**: Standard agent framework, extensible with more tools

## Next Steps

1. **WebSocket updates**: Push job status to frontend in real-time
2. **Job prioritization**: Premium users get higher priority
3. **Batch processing**: Queue multiple companies at once
4. **Caching warm-up**: Pre-enrich popular companies
5. **Advanced tools**: Add Crunchbase API, LinkedIn API to LangChain agent
