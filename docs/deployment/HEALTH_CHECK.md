# System Health Check Guide

Comprehensive health check scripts for monitoring all systems and services.

## Quick Start

### Local Environment

```bash
# Basic health check
node scripts/health-check.js

# Detailed output
node scripts/health-check.js --detailed

# Using bash wrapper
chmod +x scripts/health-check.sh
./scripts/health-check.sh
```

### Remote Server

```bash
# Check remote production server
node scripts/health-check.js --remote

# Detailed remote check
node scripts/health-check.js --remote --detailed
```

## What Gets Checked

### Frontend
- ✓ Build directory exists
- ✓ index.html file present
- ✓ JavaScript bundles compiled
- ✓ package.json configuration

### Dependencies
- ✓ Node modules installed (root, API, Frontend)
- ✓ Environment files configured (.env)

### Git Repository
- ✓ Git directory exists
- ✓ Current branch tracking

### API Service (Port 3000)
- ✓ Connectivity
- ✓ Core endpoints responsive:
  - `/api/auth/profile` (protected)
  - `/api/users` (protected)
  - `/api/resumes` (protected)
  - `/api/templates` (public)

### LLM Service (Port 5000)
- ✓ Connectivity
- ✓ Health status
- ✓ Ollama server reachability
- ✓ Chat endpoint availability

### Ollama (Port 11434)
- ✓ Connectivity
- ✓ Loaded models
- ✓ LLaMA model availability
- ✓ Model sizes

### PostgreSQL Database
- ✓ Connection to database
- ✓ Required tables present:
  - User
  - Resume
  - ChatInteraction
  - ChatAnalytics
  - RecruiterInterest
- ✓ Row counts for key tables

## Output Example

```
════════════════════════════════════════════════════════════
          System Health Check - Local Environment
════════════════════════════════════════════════════════════

Timestamp: 2026-02-04T15:45:30.123Z
Mode: Summary
Environment: Local

════════════════════════════════════════════════════════════
Frontend Build
════════════════════════════════════════════════════════════

  ✓ Frontend Build Directory
  ✓ Frontend HTML File
  ✓ Frontend JavaScript Bundles
  ✓ Frontend Package Config

════════════════════════════════════════════════════════════
API Service (Local)
════════════════════════════════════════════════════════════

  ✓ API Service Connectivity
  ✓ API Endpoint: /api/auth/profile
  ✓ API Endpoint: /api/users
  ✓ API Endpoint: /api/resumes
  ✓ API Endpoint: /api/templates

════════════════════════════════════════════════════════════
LLM Service (Local)
════════════════════════════════════════════════════════════

  ✓ LLM Service Health
  ✓ LLM Service Status
  ✓ Ollama Server Reachable
  ✓ LLM Chat Endpoint

════════════════════════════════════════════════════════════
Ollama (Local)
════════════════════════════════════════════════════════════

  ✓ Ollama Connectivity
  ✓ Ollama Models Available
  ✓ LLaMA Model Available

════════════════════════════════════════════════════════════
PostgreSQL Database (Local)
════════════════════════════════════════════════════════════

  ✓ Database Connectivity
  ✓ Database Tables
  ✓ Required Tables

════════════════════════════════════════════════════════════
Summary
════════════════════════════════════════════════════════════

Total Checks: 27
Passed: 27
Failed: 0
Success Rate: 100.0%
```

## API Health Endpoints

The API service also provides dedicated health check endpoints:

### GET `/health/live` (Liveness)
```bash
curl http://localhost:3000/health/live
# { "status": "alive" }
```

For load balancers to verify the service is running.

### GET `/health/ready` (Readiness)
```bash
curl http://localhost:3000/health/ready
# { "status": "ready" } or { "status": "not-ready" }
```

For Kubernetes to determine if the service can accept traffic.

### GET `/health/system` (Full System Health)
```bash
curl http://localhost:3000/health/system
```

Response:
```json
{
  "timestamp": "2026-02-04T15:45:30.123Z",
  "environment": "production",
  "overall": "healthy",
  "services": [
    {
      "service": "API Service",
      "status": "healthy",
      "responseTime": 0,
      "details": {
        "node": "v20.10.0",
        "uptime": 3600
      }
    },
    {
      "service": "PostgreSQL Database",
      "status": "healthy",
      "responseTime": 25,
      "details": {
        "host": "localhost",
        "port": 5432
      }
    },
    {
      "service": "LLM Service",
      "status": "healthy",
      "responseTime": 45,
      "details": {
        "url": "http://localhost:5000",
        "statusCode": 200
      }
    }
  ],
  "uptime": 1240
}
```

## Command Line Options

### `--remote`
Check production/remote server at `172.16.23.127` instead of localhost

```bash
node scripts/health-check.js --remote
```

### `--detailed`
Show detailed output including:
- Response times for each endpoint
- Table names in database
- Model names and sizes
- File listings

```bash
node scripts/health-check.js --detailed
```

### Combine Options
```bash
node scripts/health-check.js --remote --detailed
```

## Integration with Monitoring

### Cron Job (Unix/Linux)
Schedule regular health checks:

```bash
# Check every 5 minutes
*/5 * * * * cd /opt/my-resume && node scripts/health-check.js >> /var/log/health-check.log 2>&1

# Check remote server every 10 minutes
*/10 * * * * cd /opt/my-resume && node scripts/health-check.js --remote >> /var/log/health-check-remote.log 2>&1
```

### PM2 Integration
```bash
# Create a PM2 monitoring job
pm2 start scripts/health-check.js --name "health-check" --cron "0 */6 * * *"

# View logs
pm2 logs health-check
```

### Docker/Kubernetes
Use as a liveness/readiness probe:

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5
```

## Exit Codes

- `0`: All checks passed (healthy)
- `1`: One or more checks failed (unhealthy)

## Troubleshooting

### "pg module not installed"
```bash
cd apps/api-service
npm install pg
```

### Database checks fail
- Verify DATABASE_URL environment variable is set
- Check database credentials in `.env`
- Ensure PostgreSQL service is running

### LLM Service checks fail
- Verify LLM_SERVICE_URL environment variable
- Check Flask service is running: `ps aux | grep app_remote.py`
- Check Ollama is running: `systemctl status ollama`

### API Service checks fail
- Verify API_SERVICE is running on port 3000
- Check logs: `tail -f /tmp/api.log`
- Verify NODE_ENV is set correctly

## Performance Baseline

Typical response times on a healthy system:

| Service | Expected Time |
|---------|----------------|
| API Endpoints | 5-50ms |
| Database Query | 10-100ms |
| LLM Service | 30-200ms |
| Ollama | 50-500ms |
| Total Check Time | 500-2000ms |

## Next Steps

1. **Integrate with monitoring**: Set up alerts for unhealthy states
2. **Track metrics**: Log results to see trends over time
3. **Automated recovery**: Create scripts to restart failed services
4. **Dashboard**: Display results in a web dashboard
5. **Alerting**: Send notifications when health degrades

## Implementation Notes

The health check system is designed to be:

- **Lightweight**: Minimal dependencies, fast execution
- **Comprehensive**: Checks all critical systems
- **Flexible**: Works locally and remotely
- **Production-ready**: Suitable for CI/CD and monitoring
- **Extensible**: Easy to add new checks

See `scripts/health-check.js` for implementation details and customization options.
