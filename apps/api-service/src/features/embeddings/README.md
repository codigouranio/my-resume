# Embeddings Feature

## Overview

Automatic background generation of vector embeddings for resume semantic search using Bull queue, Redis, and Ollama's nomic-embed-text model.

## Architecture

```
Resume Create/Update
    ↓
ResumesService
    ↓ (queue job)
EmbeddingQueueService
    ↓ (Redis Queue)
EmbeddingProcessor
    ↓ (HTTP call)
LLM Service (/api/embed)
    ↓ (Ollama)
nomic-embed-text model
    ↓ (768-dimensional vectors)
ResumeEmbedding table (PostgreSQL + pgvector)
```

## Features

### 1. Automatic Embedding Generation

**When:**
- Resume created → Queue `CREATE` job
- Resume updated with content/llmContext changes → Queue `UPDATE` job

**How:**
- MD5 hashing detects actual content changes (avoids re-embedding on metadata updates)
- Background processing via Bull queue (non-blocking)
- 3 retry attempts with exponential backoff

**What Gets Embedded:**
- `content` → contentEmbedding (768 dims)
- `llmContext` → llmContextEmbedding (768 dims)
- Combined → combinedEmbedding (70% content + 30% llmContext)

### 2. Manual Embedding Trigger

**Endpoints:**

```bash
# Single resume
POST /api/embeddings/generate/:resumeId
Authorization: Bearer <token>

Response:
{
  "message": "Embedding generation queued",
  "jobId": "123",
  "resumeId": "clx..."
}

# Bulk (all user resumes)
POST /api/embeddings/generate-bulk
Authorization: Bearer <token>

Response:
{
  "message": "Bulk embedding generation queued",
  "totalResumes": 5,
  "jobIds": ["123", "124", "125", "126", "127"]
}
```

### 3. Job Status Monitoring

```bash
# Check job progress
GET /api/embeddings/job/:jobId
Authorization: Bearer <token>

Response:
{
  "id": "123",
  "state": "active",
  "progress": 60,
  "data": {
    "resumeId": "clx...",
    "type": "create",
    "userId": "user123"
  },
  "attemptsMade": 1
}

# Queue statistics
GET /api/embeddings/queue/stats
Authorization: Bearer <token>

Response:
{
  "waiting": 2,
  "active": 1,
  "completed": 45,
  "failed": 3,
  "delayed": 0,
  "total": 51
}
```

### 4. Queue Maintenance

```bash
# Clear failed jobs
DELETE /api/embeddings/queue/failed
Authorization: Bearer <token>

Response:
{
  "message": "Cleared 3 failed jobs"
}
```

## Environment Variables

```bash
# Redis Configuration
REDIS_HOST=localhost       # Redis server host
REDIS_PORT=6379           # Redis server port
REDIS_PASSWORD=           # Optional password
REDIS_DB=0                # Redis database number

# LLM Service
LLM_SERVICE_URL=http://localhost:5000
```

## Database Schema

```prisma
model ResumeEmbedding {
  id                   String   @id @default(cuid())
  resumeId             String   @unique
  resume               Resume   @relation(fields: [resumeId], references: [id], onDelete: Cascade)
  
  contentEmbedding     Unsupported("vector(768)")
  llmContextEmbedding  Unsupported("vector(768)")?
  combinedEmbedding    Unsupported("vector(768)")
  
  embeddingModel       String   @default("nomic-embed-text")
  contentHash          String   // MD5 hash for change detection
  llmContextHash       String?  // MD5 hash for llmContext
  
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
}
```

## Job Processing Flow

1. **Queue Job:** ResumesService → EmbeddingQueueService
2. **Fetch Resume:** EmbeddingProcessor queries database
3. **Generate Embeddings:** Parallel HTTP calls to LLM service
4. **Calculate Combined:** Weighted average (70/30)
5. **Calculate Hashes:** MD5 for change detection
6. **Store in DB:** Upsert to ResumeEmbedding table
7. **Job Complete:** Result returned, retries on failure

## Performance

- **Single embedding:** ~100ms
- **Batch (3 texts):** ~300ms
- **Queue throughput:** ~10 jobs/second (depends on Ollama performance)
- **Retry policy:** 3 attempts, exponential backoff starting at 2s

## Error Handling

**Automatic Retries:**
- Network timeouts
- LLM service temporarily down
- Ollama model loading

**Permanent Failures (no retry):**
- Resume not found (deleted during processing)
- Invalid embedding response format

**Logging:**
- Job start: `Processing embedding job <id> for resume <resumeId>`
- Job complete: `Successfully generated embeddings...`
- Job failed: `Failed embedding job <id>: <error>`

## Testing Locally

### 1. Start Redis

```bash
# Install Redis (if not already)
brew install redis  # macOS
sudo apt install redis-server  # Linux

# Start Redis
redis-server

# Or as background service
brew services start redis  # macOS
sudo systemctl start redis-server  # Linux
```

### 2. Start API Service

```bash
cd apps/api-service
npm run start:dev
```

### 3. Start LLM Service

```bash
cd apps/llm-service
./run.sh
```

### 4. Create a Resume

```bash
curl -X POST http://localhost:3000/api/resumes \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test-resume",
    "title": "Test Resume",
    "content": "# John Doe\n\n## Experience\n\nSoftware Engineer at Acme Inc...",
    "llmContext": "Detailed metrics: increased performance by 40%..."
  }'
```

**Expected:** Resume created, embedding job queued automatically

### 5. Check Job Status

```bash
# Get job ID from logs or initial response
curl http://localhost:3000/api/embeddings/queue/stats \
  -H "Authorization: Bearer <token>"
```

### 6. Verify Embeddings

```bash
# Check database
psql -U resume_user -d resume_db -c "
  SELECT 
    r.slug, 
    e.embeddingModel, 
    vector_dims(e.combinedEmbedding) as dimensions,
    e.contentHash,
    e.updatedAt
  FROM \"Resume\" r
  JOIN \"ResumeEmbedding\" e ON e.\"resumeId\" = r.id
  WHERE r.slug = 'test-resume';
"
```

Expected output:
```
    slug     | embeddingModel  | dimensions |           contentHash            |         updatedAt
-------------+-----------------+------------+----------------------------------+---------------------------
 test-resume | nomic-embed-text|        768 | a1b2c3d4e5f6... (32 chars)      | 2025-01-02 10:30:45.123
```

## Production Deployment

### Ansible Updates

**01-system-setup.yml:**
- Installs Redis server
- Configures 256MB memory limit
- Sets LRU eviction policy
- Enables Redis service

**03-application-deploy.yml:**
- No changes needed (already pulls nomic-embed-text model)

### Deploy

```bash
cd ansible
./deploy_with_conda.sh
```

### Post-Deployment Checks

```bash
# Check Redis
ssh user@server 'redis-cli ping'
# Expected: PONG

# Check queue stats
curl https://api.your-domain.com/embeddings/queue/stats \
  -H "Authorization: Bearer <token>"
```

## Troubleshooting

### No embeddings generated after resume creation

**Check:**
```bash
# Is Redis running?
redis-cli ping

# Are jobs being queued?
curl http://localhost:3000/api/embeddings/queue/stats -H "Authorization: Bearer <token>"

# Check API logs
npm run start:dev
# Look for: "Queueing embedding job for resume..."
```

### Embeddings fail with "LLM service error"

**Check:**
```bash
# Is LLM service running?
curl http://localhost:5000/health

# Is Ollama running?
curl http://localhost:11434/api/tags

# Is nomic-embed-text model pulled?
ollama list | grep nomic-embed-text
```

### Queue stuck with jobs in "active" state

**Cause:** Worker process crashed mid-job

**Solution:**
```bash
# Restart API service
npm run start:dev

# Or in production
pm2 restart api-service
```

### High memory usage

**Cause:** Too many completed/failed jobs retained

**Solution:** Configure Bull to clear old jobs more aggressively

```typescript
// In embeddings.module.ts
defaultJobOptions: {
  removeOnComplete: 50,  // Reduce from 100
  removeOnFail: 200,     // Reduce from 500
}
```

## Future Enhancements

- **Phase 3:** Semantic search API endpoint
- **Phase 4:** Search UI in frontend
- **Vector indexes:** HNSW for fast similarity search
- **Batch optimization:** Process multiple resumes in single Ollama call
- **Delta updates:** Only re-embed changed sections
- **Monitoring:** Prometheus metrics for queue health
- **Admin dashboard:** Bull Board integration

## References

- [Bull Queue Documentation](https://github.com/OptimalBits/bull)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [nomic-embed-text Model](https://ollama.com/library/nomic-embed-text)
