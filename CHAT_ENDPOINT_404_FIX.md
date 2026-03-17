# Chat Endpoint 404 Fix - Status and Next Steps

## Problem
The chat endpoint `/api/chat` returns 404 "LLM service error: Not Found".

## Root Cause
The Cloud Run API service and home server LLM service are using **different databases**:
- **CloudRun API service**: Cloud SQL (Google Cloud) - has resume data ✅  
- **Home LLM service**: Local PostgreSQL - doesn't have the same data ❌

The LLM service is trying to load resume data from its local database, which doesn't match the Cloud SQL database.

## Architecture Flow
```
Frontend (resumecast.ai)
  ↓ POST /api/chat
API Service (Cloud Run - api-service-00015-pfj)
  ↓ Proxies with X-API-Key
  ↓ POST https://llm-service.paskot.com/api/chat
LLM Service (home server)
  ↓ Tries to load resume from local database
  ↓ Returns 404 "Resume not found" ❌
```

## What's Already Fixed ✅

### 1. API Service Configuration (Cloud Run)
- ✅ `LLM_SERVICE_URL=https://llm-service.paskot.com` (was localhost)
- ✅ `LLM_SERVICE_USERNAME=llm-service` (added)
- ✅ `LLM_SERVICE_PASSWORD=change_me_in_production` (added)
- ✅ Deployed as revision `api-service-00015-pfj`

### 2. API Service Endpoints
- ✅ `/api/llm-service/resume/:slug` - Returns resume with llmContext
- ✅ `/api/llm-service/resume/:slug/user` - Returns user info
- ✅ `/api/llm-service/auth/login` - JWT authentication
- ✅ All endpoints use `@Public()` decorator with custom auth

### 3. Authentication Verified
```bash
# Login works:
curl -X POST https://api.resumecast.ai/api/llm-service/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"llm-service","password":"change_me_in_production"}'

# Resume endpoint works with JWT:
curl https://api.resumecast.ai/api/llm-service/resume/jose-blanco-swe \
  -H "Authorization: Bearer <TOKEN>"
```

## What Needs to Be Fixed ❌

### Home Server LLM Service Configuration

The **LLM service on resumecast.ai** needs to use the API service URL instead of local database.

**File**: `/opt/my-resume/ecosystem.config.js`

**Current (WRONG)**:
```javascript
env: {
  API_SERVICE_URL: 'http://localhost:3000',  // ← Points to itself
  // ... other vars
}
```

**Should be (CORRECT)**:
```javascript
env: {
  API_SERVICE_URL: 'https://api.resumecast.ai',  // ← Points to Cloud Run API
  LLM_SERVICE_USERNAME: 'llm-service',
  LLM_SERVICE_PASSWORD: 'change_me_in_production',
  // ... other vars
}
```

## How to Fix

### Option 1: Run Ansible Playbook (Recommended)
```bash
cd ansible
ansible-playbook -i inventory.yml update-services.yml --ask-vault-pass
```

This will:
1. Regenerate `ecosystem.config.js` from template (already has correct values)
2. Restart PM2 services with new environment variables

### Option 2: Manual Fix
```bash
ssh jose@resumecast.ai

# Backup config
cd /opt/my-resume
cp ecosystem.config.js ecosystem.config.js.backup

# Edit the file
nano ecosystem.config.js

# Find the llm-service section and update:
#   API_SERVICE_URL: 'https://api.resumecast.ai',

# Save and restart
pm2 restart llm-service --update-env

# Verify environment
pm2 env llm-service | grep API_SERVICE_URL
# Should show: API_SERVICE_URL=https://api.resumecast.ai

# Check logs
pm2 logs llm-service --lines 20
```

## Testing After Fix

### 1. Test LLM service can authenticate
```bash
curl -X POST https://llm-service.paskot.com/api/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: 54728f0532ae29140b925faf99d9b00b6d9b9102c83c882e75ea2ece5d6c6951" \
  -d '{"message":"What is your name?","slug":"jose-blanco-swe"}'

# Should return error about Ollama not running (that's OK)
# Should NOT return "Resume not found"
```

### 2. Test end-to-end chat flow
```bash
curl -X POST https://api.resumecast.ai/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is your AWS experience?","slug":"jose-blanco-swe"}'

# Should return AI response (if Ollama is running)
# OR return error about Ollama not reachable (separate issue)
# Should NOT return 404
```

### 3. Start Ollama (if needed)
```bash
ssh jose@resumecast.ai
sudo systemctl start ollama
sudo systemctl enable ollama

# Verify
curl http://localhost:11434/api/tags
```

## Code Reference

### LLM Service API Client
File: `apps/llm-service/api_client.py`

```python
API_SERVICE_URL = os.getenv("API_SERVICE_URL", "http://localhost:3000")

def get_headers() -> Dict[str, str]:
    """Uses JWT token (preferred) or static token"""
    # Tries token_manager first, falls back to LLM_SERVICE_TOKEN
    
def load_resume_from_api(slug: str) -> Tuple[Optional[str], Optional[str]]:
    url = f"{API_SERVICE_URL}/api/llm-service/resume/{slug}"
    response = requests.get(url, headers=get_headers(), timeout=10)
    # Returns (fullContext, resume_id)
```

### API Service LLM Controller  
File: `apps/api-service/src/features/llm-service-api/llm-service-api.controller.ts`

```typescript
@Controller('llm-service')
export class LlmServiceApiController {
  @Get('resume/:slug')
  @Public()  // Bypasses JWT guard
  async getResume(@Param('slug') slug: string,
                  @Headers('authorization') authHeader: string,
                  @Headers('x-llm-service-token') staticToken: string) {
    // Validates JWT or static token
    return this.llmServiceApiService.getResumeForLlm(slug);
  }
}
```

## Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| Cloud Run API Service | ✅ Ready | Has correct credentials and URL |
| Cloud Run Frontend | ✅ Working | Calls `/api/chat` correctly |
| Home LLM Service | ❌ Needs config | Must update API_SERVICE_URL |
| Ollama Server | ⚠️  Not running | Separate issue, start with systemctl |

## Summary

The chat endpoint will work once the LLM service on `resumecast.ai` is configured to call the Cloud Run API service for resume data, instead of trying to read from its local database.

**Required action**: Update `/opt/my-resume/ecosystem.config.js` on the home server and restart PM2.
