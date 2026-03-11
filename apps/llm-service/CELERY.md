# Celery Integration for LLM Service

## Overview

The LLM service now uses **Celery** with Redis for reliable, scalable async task processing instead of simple threading. This provides production-ready job queuing with monitoring, retries, and horizontal scaling.

## Architecture

```
Flask API (port 5000)
    ↓ task.delay()
Redis Queue (port 6380) ← LLM Service's own Redis
    ↓
Celery Workers (2 concurrent)
    ↓ research/analyze
LLM/Ollama Server
    ↓
Webhook Callback → API Service
```

## Benefits Over Threading

| Feature | Threading (Old) | Celery (New) |
|---------|----------------|--------------|
| Reliability | ❌ Lost on restart | ✅ Persisted in queue |
| Retries | ❌ Manual | ✅ Automatic with backoff |
| Monitoring | ❌ None | ✅ Flower dashboard |
| Scaling | ❌ Single server | ✅ Horizontal scaling |
| Rate limiting | ❌ Manual | ✅ Built-in |
| Task tracking | ❌ None | ✅ Full history |
| Error handling | ❌ Basic | ✅ Comprehensive |

## Prerequisites

### 1. Install Redis

**For MVP/POC: Shared Redis with API service**

This setup uses the same Redis instance as API service (port 6379) but different databases:
- API service: database 0
- LLM Celery: database 1

**macOS:**
```bash
brew install redis
brew services start redis  # Port 6379 (default)
```

**Linux:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis-server  # Port 6379 (default)
```

**Note:** For production scaling, see [REDIS_SHARED_VS_SEPARATE.md](../../ansible/REDIS_SHARED_VS_SEPARATE.md) for separate Redis setup.

### 2. Install Python Dependencies

```bash
cd apps/llm-service

# Option 1: Poetry (recommended)
poetry install

# Option 2: pip
pip install celery redis flower
```

## Configuration

### Environment Variables

Add to `apps/llm-service/.env`:

```bash
# Redis configuration (shared with API service, different database)
REDIS_HOST=localhost
REDIS_PORT=6379              # Same as API service
REDIS_DB=1                   # Database 1 (API uses 0)
REDIS_PASSWORD=              # Optional, leave empty for local dev

# Celery settings
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/1

# Flower monitoring dashboard
FLOWER_PORT=5555

# Webhook secret (must match API service)
LLM_WEBHOOK_SECRET=your-secret-key-here
```

## Running the Services

### Start All Services

You need **3 processes** running:

**Terminal 1 - Flask API:**
```bash
cd apps/llm-service
./run.sh  # or: python3 app_remote.py
```

**Terminal 2 - Celery Worker:**
```bash
cd apps/llm-service
./start-celery-worker.sh
```

**Terminal 3 - Flower Dashboard (optional but recommended):**
```bash
cd apps/llm-service
./start-flower.sh
```

### Access Points

- **Flask API**: http://localhost:5000
- **Flower Dashboard**: http://localhost:5555
- **Redis**: localhost:6380

## Monitoring with Flower

Flower provides a beautiful web dashboard for monitoring Celery tasks:

```bash
# Open in browser
open http://localhost:5555
```

**Features:**
- ✅ Real-time task progress
- ✅ Task history and success rates
- ✅ Worker status and resource usage
- ✅ Task arguments and results
- ✅ Retry attempts
- ✅ Execution time statistics

## Task Configuration

### Company Research Task

- **Max retries**: 2 (total 3 attempts)
- **Retry delay**: 60 seconds (exponential backoff)
- **Time limit**: 10 minutes hard limit
- **Rate limit**: 10 requests per minute
- **Webhook retries**: 3 attempts with exponential backoff

### Position Analysis Task

- Same configuration as company research
- Dedicated queue for prioritization

## Graceful Fallback

The service **automatically falls back to threading** if Celery isn't available:

```python
# In app_remote.py
try:
    from celery_config import celery_app
    CELERY_AVAILABLE = True
except ImportError:
    CELERY_AVAILABLE = False
    # Falls back to threading
```

This allows:
- ✅ Development without Redis
- ✅ Gradual migration
- ✅ Testing without infrastructure

Response includes `"backend": "celery"` or `"backend": "threading"` to indicate mode.

## Scaling

### Horizontal Scaling

Add more workers on different servers:

```bash
# Server 1
celery -A celery_config worker --hostname=worker1@%h

# Server 2  
celery -A celery_config worker --hostname=worker2@%h

# Server 3
celery -A celery_config worker --hostname=worker3@%h
```

All workers connect to the same Redis instance.

### Vertical Scaling

Adjust concurrency per worker:

```bash
# More concurrent tasks per worker
celery -A celery_config worker --concurrency=4
```

**Recommendation**: `concurrency = CPU_CORES - 1`

## Task Priority

Create priority queues for different customers:

```python
# High-priority customer
task.apply_async(args=[...], queue='priority')

# Standard queue
task.apply_async(args=[...], queue='default')

# Low-priority (free tier)
task.apply_async(args=[...], queue='low_priority')
```

Start workers for specific queues:

```bash
# Handle only high-priority
celery -A celery_config worker -Q priority

# Handle all queues
celery -A celery_config worker -Q priority,default,low_priority
```

## SaaS Multi-Tenancy

### Per-Customer Rate Limiting

```python
# In tasks.py
@celery_app.task(
    rate_limit=f"{customer_tier_limits[customer_id]}/m"
)
def research_company_task(...):
    pass
```

### Usage Tracking

```python
# Track per customer
@celery_app.task
def research_company_task(self, ...):
    customer_id = metadata.get('customerId')
    
    # Record billable event
    record_usage(
        customer_id=customer_id,
        task_type='company_research',
        status='completed',
    )
```

## Production Deployment

### PM2 Configuration

Add to `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'llm-api',
      script: 'app_remote.py',
      interpreter: 'python3',
      cwd: '/path/to/apps/llm-service',
      instances: 1,
      autorestart: true,
    },
    {
      name: 'llm-celery-worker',
      script: 'celery',
      args: '-A celery_config worker --loglevel=info --concurrency=2',
      interpreter: 'python3',
      cwd: '/path/to/apps/llm-service',
      instances: 1,
      autorestart: true,
    },
    {
      name: 'llm-flower',
      script: 'celery',
      args: '-A celery_config flower --port=5555',
      interpreter: 'python3',
      cwd: '/path/to/apps/llm-service',
      instances: 1,
      autorestart: true,
    },
  ],
};
```

### Systemd Services

**`/etc/systemd/system/llm-celery-worker.service`:**

```ini
[Unit]
Description=LLM Service Celery Worker
After=network.target redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/llm-service
Environment="PATH=/usr/bin:/usr/local/bin"
ExecStart=/usr/local/bin/celery -A celery_config worker --loglevel=info
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable llm-celery-worker
sudo systemctl start llm-celery-worker
sudo systemctl status llm-celery-worker
```

## Troubleshooting

### Worker Not Starting

**Check Redis connection:**
```bash
redis-cli -p 6380 ping
# Should return: PONG
```

**Check Celery can connect:**
```bash
celery -A celery_config inspect ping
```

### Tasks Not Executing

**Check worker status:**
```bash
celery -A celery_config inspect active
celery -A celery_config inspect stats
```

**Check queue length:**
```bash
redis-cli -p 6380
> LLEN celery
```

### Memory Leaks

Workers automatically restart after 50 tasks:

```python
# In celery_config.py
worker_max_tasks_per_child=50
```

Adjust this value based on your memory usage patterns.

### Monitoring Logs

**Worker logs:**
```bash
tail -f celery_worker.log
```

**Flask API logs:**
```bash
tail -f app.log
```

## Testing

### Test Celery Connection

```bash
python3 -c "from celery_config import celery_app; print(celery_app.control.inspect().ping())"
```

### Test Task Execution

```python
from tasks import research_company_task

# Queue a test task
result = research_company_task.delay(
    company_name="Test Company",
    callback_url="http://httpbin.org/post",
    metadata={"test": True},
    job_id="test_123"
)

print(f"Task ID: {result.id}")
print(f"Status: {result.status}")

# Wait for result (blocks)
print(result.get(timeout=60))
```

### Performance Testing

```bash
# Queue 100 tasks
for i in {1..100}; do
  curl -X POST http://localhost:5000/api/companies/enrich \
    -H "Content-Type: application/json" \
    -d "{\"companyName\":\"Company$i\", \"callbackUrl\":\"http://httpbin.org/post\"}"
done

# Watch in Flower dashboard
open http://localhost:5555
```

## Migration from Threading

The transition is **transparent** - no code changes needed in API service!

1. ✅ Install Redis
2. ✅ Install Celery dependencies: `poetry install`
3. ✅ Start Celery worker: `./start-celery-worker.sh`
4. ✅ Restart Flask API: `./run.sh`

If you don't start the worker, it automatically falls back to threading mode.

## Summary

✅ **Installed**: Celery + Redis + Flower  
✅ **Configured**: Task settings, retries, rate limits  
✅ **Scripts**: `start-celery-worker.sh`, `start-flower.sh`  
✅ **Monitoring**: Flower dashboard at http://localhost:5555  
✅ **Fallback**: Automatic threading if Celery unavailable  
✅ **SaaS-ready**: Per-customer queues, rate limits, usage tracking  

**Next Steps:**
1. Install Redis: `brew install redis && brew services start redis`
2. Install dependencies: `cd apps/llm-service && poetry install`
3. Start worker: `./start-celery-worker.sh`
4. Start Flower: `./start-flower.sh`
5. Test: Queue a company enrichment task
6. Monitor: Open http://localhost:5555

🎉 **Production-ready async task processing with monitoring and retries!**
