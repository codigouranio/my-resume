# Redis Configuration: Shared vs Separate

## Quick Answer

**Current Setup: SEPARATE (Recommended for SaaS)**
- API Service: `redis://localhost:6379/0`
- LLM Service: `redis://localhost:6380/0`

**Alternative: SHARED (Valid for dev/single-server)**
- API Service: `redis://localhost:6379/0`
- LLM Service: `redis://localhost:6379/1` (different database)

## Will It Cause Conflicts?

**NO** - Redis databases are completely isolated. Keys in database 0 will NOT interfere with database 1.

### Key Namespace Isolation

```
redis://localhost:6379/0  ← API Service
├── bullmq:queue:email-jobs
├── session:user:123
└── cache:companies:broadridge

redis://localhost:6379/1  ← LLM Celery (if shared)
├── celery-task-meta-abc123
├── _kombu.binding.celery
└── unacked_index
```

Even on the same port, these **never conflict** because they're in different databases.

## Comparison Table

| Aspect | Separate Redis (6379 + 6380) | Shared Redis (6379/db0 + 6379/db1) |
|--------|------------------------------|-------------------------------------|
| **Conflicts** | ❌ None | ❌ None (databases isolated) |
| **Memory Isolation** | ✅ Complete (512MB + 256MB) | ⚠️ Shared pool (needs manual limits) |
| **Service Independence** | ✅ Full independence | ⚠️ Coupled (restart affects both) |
| **Resource Usage** | ⚠️ ~50MB overhead per instance | ✅ Single process |
| **Troubleshooting** | ✅ Easy (separate logs) | ⚠️ Mixed logs |
| **Scaling** | ✅ Can separate to different servers | ❌ Must move together |
| **Dev Setup** | ⚠️ Need two Redis instances | ✅ One `brew install redis` |
| **Production SaaS** | ✅ Best practice | ⚠️ Acceptable for low traffic |
| **Multi-Tenancy** | ✅ Clear service boundaries | ⚠️ Harder to track per-service usage |

## Configuration Examples

### Current Setup (Separate)

**System:**
```bash
# Two Redis instances
systemctl status redis-server  # Port 6379 (API)
systemctl status redis-llm     # Port 6380 (LLM)
```

**API Service (.env):**
```bash
REDIS_URL=redis://localhost:6379/0
BULL_REDIS_HOST=localhost
BULL_REDIS_PORT=6379
```

**LLM Service (.env):**
```bash
REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_DB=0
CELERY_BROKER_URL=redis://localhost:6380/0
CELERY_RESULT_BACKEND=redis://localhost:6380/0
```

**Memory:**
- API Redis: 256MB max
- LLM Redis: 512MB max
- Total: 768MB allocated

### Alternative (Shared)

**System:**
```bash
# Single Redis instance
systemctl status redis-server  # Port 6379 only
```

**API Service (.env):**
```bash
REDIS_URL=redis://localhost:6379/0        # Database 0
BULL_REDIS_HOST=localhost
BULL_REDIS_PORT=6379
BULL_REDIS_DB=0
```

**LLM Service (.env):**
```bash
REDIS_HOST=localhost
REDIS_PORT=6379                            # Same port
REDIS_DB=1                                 # Database 1 (not 0!)
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2  # Can use DB 2 for results
```

**Memory:**
- Single Redis: 1GB max (shared)
- Need to monitor both services don't exceed 1GB combined

## When to Use Shared Redis

### Development/Local Testing ✅
```bash
# Local machine
brew install redis
redis-server  # Port 6379

# API service uses DB 0
# LLM service uses DB 1
# No conflicts, simple setup
```

### Single Small Server ✅
- Combined traffic < 10k requests/hour
- Total Redis memory needed < 512MB
- Not planning to scale horizontally
- Cost optimization priority

### Prototype/MVP ✅
- Faster deployment
- Fewer moving parts
- Can migrate to separate later

## When to Use Separate Redis

### Production SaaS ✅ (Current Setup)
- **Service Independence**: LLM can scale separately
- **Resource Guarantees**: Each service has dedicated memory
- **Multi-Tenancy**: Clear per-service usage tracking
- **Horizontal Scaling**: Easy to move LLM to different server

### High Traffic ✅
- API Redis: High frequency cache reads/writes
- LLM Redis: Long-running task queues
- Separate instances prevent interference

### Different Persistence Needs ✅
- API Redis: AOF (append-only file) for sessions
- LLM Redis: RDB snapshots (tasks can be re-queued)
- Different backup strategies

## Switching from Separate to Shared

If you want to simplify for development:

### 1. Update Ansible Variables

**group_vars/all.yml:**
```yaml
# Change from:
llm_redis_port: 6380

# To:
llm_redis_port: 6379
llm_redis_db: 1  # Use different database
```

### 2. Update Celery Config

**apps/llm-service/celery_config.py:**
```python
# From:
redis_url = f"redis://{redis_host}:{redis_port}/0"

# To:
redis_db = os.getenv("REDIS_DB", "1")  # Database 1
redis_url = f"redis://{redis_host}:{redis_port}/{redis_db}"
```

### 3. Skip redis-llm Setup

**Comment out in 01-system-setup.yml:**
```yaml
# - name: Create Redis LLM instance
#   ... (comment entire section)
```

### 4. Redeploy
```bash
ansible-playbook update-services.yml --ask-vault-pass
```

## Switching from Shared to Separate

If you want production best practices:

### Already configured! ✅

The current Ansible setup already uses separate Redis instances. Just deploy:

```bash
ansible-playbook playbooks/01-system-setup.yml --ask-become-pass
```

## Redis Database Limits

Redis supports **16 databases** (0-15) by default:
- Database 0: API Service
- Database 1: LLM Celery Broker
- Database 2: LLM Celery Results
- Database 3-15: Available for future services

To increase:
```conf
# /etc/redis/redis.conf
databases 32  # Increase to 32 databases
```

## Performance Impact

### Separate Redis
```
API Request → Redis 6379 → 0.1ms lookup
Celery Task → Redis 6380 → 0.1ms lookup
---------------------------------------------
Total: No interference, predictable latency
```

### Shared Redis
```
API Request → Redis 6379/db0 → 0.1ms lookup
Celery Task → Redis 6379/db1 → 0.1ms lookup
---------------------------------------------
Total: Same latency, but shared memory pool

⚠️ If API uses 90% memory:
   Celery might trigger eviction or blocking
```

## Monitoring

### Separate Redis
```bash
# Check API Redis
redis-cli -p 6379 INFO memory
redis-cli -p 6379 DBSIZE

# Check LLM Redis
redis-cli -p 6380 INFO memory
redis-cli -p 6380 DBSIZE

# Independent monitoring, clear metrics
```

### Shared Redis
```bash
# Check all databases
redis-cli INFO memory  # Shows total for ALL databases

# Check specific database
redis-cli -n 0 DBSIZE  # API service
redis-cli -n 1 DBSIZE  # LLM Celery

# Need to track which DB is using memory
```

## Recommendation by Deployment Type

| Deployment | Recommendation | Reason |
|------------|---------------|---------|
| **Local Development** | Shared (6379, different DBs) | Simpler setup, one `redis-server` |
| **Staging/Testing** | Shared (acceptable) | Cost optimization, low traffic |
| **Production (Monolith)** | Shared (acceptable) | If single server and low traffic |
| **Production (Microservices)** | **Separate** ✅ | Service independence, scaling |
| **Production (SaaS)** | **Separate** ✅ | Multi-tenancy, resource isolation |
| **Multi-Region** | **Separate** (required) | Each service in different regions |

## Cost Analysis (AWS ElastiCache Example)

### Separate Redis
```
API Redis: cache.t3.micro ($13/month)
LLM Redis: cache.t3.small ($26/month)
Total: $39/month
```

### Shared Redis
```
Combined: cache.t3.medium ($40/month)
Total: $40/month
```

**Verdict:** Cost is nearly identical, but separate provides better isolation!

## Migration Path

### Phase 1: Development (Shared)
```bash
# Start with shared for simplicity
REDIS_PORT=6379
LLM_REDIS_DB=1
```

### Phase 2: Production (Separate)
```bash
# When moving to production:
ansible-playbook playbooks/01-system-setup.yml --ask-become-pass

# Automatically sets up:
# - Redis 6379 (API)
# - Redis 6380 (LLM)
```

### Phase 3: Multi-Server (Fully Separate)
```bash
# API Server:
REDIS_URL=redis://api-redis.internal:6379/0

# LLM Server (different machine):
REDIS_HOST=llm-redis.internal
REDIS_PORT=6379
```

## Common Pitfalls

### ❌ Using Same Database
```bash
# WRONG - Will cause conflicts!
API Service: redis://localhost:6379/0
LLM Service: redis://localhost:6379/0  # Same DB!
```

**Result:** Celery keys mix with API cache keys, potential data loss.

### ✅ Different Databases
```bash
# CORRECT - No conflicts
API Service: redis://localhost:6379/0
LLM Service: redis://localhost:6379/1  # Different DB
```

### ❌ Exceeding Memory Limit
```bash
# Shared Redis with 512MB maxmemory
API uses: 400MB
Celery needs: 200MB
Total: 600MB > 512MB → Eviction or blocking!
```

### ✅ Proper Memory Allocation
```bash
# Separate Redis
API: 512MB maxmemory
LLM: 512MB maxmemory
Total: 1024MB, independent
```

## TL;DR

**Can they share?** ✅ YES, using different Redis databases (0, 1, 2...)

**Will it conflict?** ❌ NO, databases are isolated

**Should they share?** 
- **Development**: YES (simpler)
- **Production SaaS**: NO (use separate for independence) ← Current setup

**Current Ansible Setup**: Already configured with separate Redis (6379 + 6380) for production best practices! ✅

**To use shared**: Change `llm_redis_port: 6379` and `llm_redis_db: 1` in `group_vars/all.yml`
