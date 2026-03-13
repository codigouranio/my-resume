# System Health Check - Quick Reference

## Usage

### Local System
```bash
# Basic check
node scripts/health-check.js

# Detailed output
node scripts/health-check.js --detailed

# Using bash wrapper
./scripts/health-check.sh
```

### Remote System (Production)
```bash
# Check production at 172.16.23.127
node scripts/health-check.js --remote

# With details
node scripts/health-check.js --remote --detailed
```

## What Gets Tested

### ✓ Frontend
- Build directory exists
- HTML file compiled
- JavaScript bundles present
- Package configuration valid

### ✓ Dependencies
- Node modules installed (all apps)
- Environment files present (.env files)

### ✓ Git Repository
- Repo exists and initialized
- Current branch tracking

### ✓ API Service (Port 3000)
- Server connectivity
- Core endpoints responding:
  - `/api/auth/profile`
  - `/api/users`
  - `/api/resumes`
  - `/api/templates`

### ✓ LLM Service (Port 5000)
- Server connectivity
- Health status check
- Ollama reachability
- Chat endpoint availability

### ✓ Ollama (Port 11434)
- Server connectivity
- Loaded models list
- LLaMA model availability
- Model sizes

### ✓ PostgreSQL Database
- Database connection
- Required tables present:
  - User
  - Resume
  - ChatInteraction
  - ChatAnalytics
  - RecruiterInterest

## Example Output

```
╔═══════════════════════════════════════════════════════════╗
║          System Health Check - Remote Environment         ║
╚═══════════════════════════════════════════════════════════╝

Timestamp: 2026-02-04T21:34:29.676Z
Mode: Summary
Environment: Remote

✓ Frontend Build Directory
✓ API Service Connectivity
✓ LLM Service Health
✓ Ollama Server Reachable
✗ PostgreSQL Client (needs pg module)

Total Checks: 22
Passed: 19
Failed: 3
Success Rate: 86.4%
```

## Installation (Database Checks)

To enable database connectivity checks, install the `pg` module:

```bash
npm install pg
```

## Files Added

1. **scripts/health-check.js** - Main health check script (Node.js)
   - Comprehensive testing of all services
   - Local and remote modes
   - Detailed output option
   - ~380 lines

2. **scripts/health-check.sh** - Bash wrapper script
   - Easy execution
   - Proper error handling
   - ~15 lines

3. **HEALTH_CHECK.md** - Complete documentation
   - Usage guide
   - Integration examples
   - Troubleshooting
   - API endpoints reference
   - ~300 lines

4. **apps/api-service/src/shared/health/health.controller.ts** - NestJS health endpoints
   - `GET /health/live` - Liveness probe
   - `GET /health/ready` - Readiness probe
   - `GET /health/system` - Full system health
   - ~150 lines

## Key Features

- **Lightweight**: Minimal dependencies, fast execution
- **Comprehensive**: Tests all critical services
- **Flexible**: Works locally and remotely
- **Production-ready**: Exit codes for CI/CD integration
- **Detailed reporting**: Summary and detailed modes
- **Color output**: Easy to read in terminal

## Typical Response Times

| Service | Expected |
|---------|----------|
| API Endpoints | 5-50ms |
| Database Query | 10-100ms |
| LLM Service | 30-200ms |
| Ollama | 50-500ms |
| **Total** | **500-2000ms** |

## Exit Codes

- `0` - All checks passed ✓
- `1` - One or more checks failed ✗

## Next Steps

1. **Schedule checks**: Use cron jobs or PM2
2. **Monitor results**: Log to file for trending
3. **Set up alerts**: Send notifications on failures
4. **Integration**: Add to CI/CD pipeline
5. **Dashboards**: Display results in web UI

---

Created: February 4, 2026  
Status: ✅ Production Ready
