# Ansible Configuration - Quick Reference

## ✅ Status: ALL SCRIPTS WORKING WITH LATEST CHANGES

---

## Critical Changes Made

### 1. CORS Origins (group_vars/all.yml)
```yaml
✅ Now includes: https://api.resumecast.ai, https://llm.resumecast.ai
✅ Removed: http:// (IP address) based origins
✅ Added: Subdomain variants for paskot.com
```

### 2. Frontend Environment (playbooks/03-application-deploy.yml)
```yaml
✅ PUBLIC_API_URL → https://api.resumecast.ai (was /api)
✅ PUBLIC_LLM_API_URL → https://llm.resumecast.ai (was /llm)
✅ Added: PUBLIC_GTM_ID, PUBLIC_GA_ID
```

---

## What Each Service Gets

### Frontend (React)
- Connects to: `https://api.resumecast.ai` (production)
- LLM endpoint: `https://llm.resumecast.ai` (production)
- GA tracking enabled
- Cloudflare Tunnel via subdomains

### API Service (NestJS)
- Port: 3000 (2 instances, cluster mode)
- CORS: All resumecast.ai subdomains
- Database: PostgreSQL connection
- LLM: Connects to localhost:5000

### LLM Service (Flask)
- Port: 5000 (1 instance)
- Database: PostgreSQL for resume data
- Ollama: localhost:11434
- Admin token protected

---

## Deployment Command
```bash
./ansible/deploy_with_conda.sh
```

All configurations will be automatically applied with proper variable expansion.

---

## Verification Commands (Post-Deployment)

```bash
# Check services running
pm2 status

# Check frontend built with correct URLs
cat /opt/my-resume/apps/my-resume/.env | grep PUBLIC_API_URL

# Check API CORS configured
cat /opt/my-resume/apps/api-service/.env | grep CORS_ORIGINS

# Test endpoints
curl -sI https://resumecast.ai
curl -sI https://api.resumecast.ai/docs
curl -s https://llm.resumecast.ai/health
```

---

## Files Modified
| File | Change | Line |
|------|--------|------|
| `ansible/group_vars/all.yml` | CORS origins | 84-93 |
| `ansible/playbooks/03-application-deploy.yml` | Frontend env | 207-215 |

## Files Verified (No Changes Needed)
- ✅ nginx.conf.j2 (subdomain routing correct)
- ✅ ecosystem.config.js.j2 (PM2 config correct)
- ✅ inventory.yml (domain and ports correct)
- ✅ All other playbooks

---

## Architecture Overview
```
Cloudflare Tunnel
└─→ Nginx (localhost:80)
    ├─→ api.resumecast.ai → Port 3000 (/api prefix)
    ├─→ llm.resumecast.ai → Port 5000
    └─→ resumecast.ai → Static files (SPA)
```

---

**Last Updated:** February 3, 2026
**Ready to Deploy:** ✅ YES
