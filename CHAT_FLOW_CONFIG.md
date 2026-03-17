# Chat Flow Configuration Guide

## Architecture Overview

The chat system uses a proxy pattern where the frontend calls the API service, which then proxies to the LLM service. This keeps the LLM API key secure on the backend.

### Request Flow

```
┌─────────────┐
│  Frontend   │
│resumecast.ai│
└──────┬──────┘
       │ POST /api/chat
       │ {"message": "...", "slug": "..."}
       ↓
┌──────────────────┐
│  API Service     │
│ Cloud Run or     │
│ localhost:3000   │
└──────┬───────────┘
       │ Proxies with X-API-Key
       │ POST http://localhost:5000/api/chat
       ↓
┌──────────────────┐
│  LLM Service     │
│ localhost:5000   │
└──────┬───────────┘
       │ Needs resume data
       │ GET https://api.resumecast.ai/api/llm-service/resume/:slug
       ↓
┌──────────────────┐
│  API Service     │
│ (external URL)   │
└──────────────────┘
       Returns ↑
```

## Environment Variables

### API Service (NestJS - Node.js)

**Location:** `ecosystem.config.js` → `api-service` section

| Variable | Value (Production) | Purpose |
|----------|-------------------|---------|
| `PORT` | `3000` | API service listening port |
| `LLM_SERVICE_URL` | `http://localhost:5000` | Internal URL to reach LLM service |
| `API_BASE_URL` | `https://api.resumecast.ai` | External URL for webhooks/callbacks |
| `LLM_API_KEY` | `[vault_llm_api_key]` | API key to call LLM service |
| `DATABASE_URL` | `postgresql://...` | Database connection |

**Usage in code:**
- `LLM_SERVICE_URL`: Used by chat proxy (`ChatService`) to forward requests
- `API_BASE_URL`: Used by event handlers to construct callback URLs for webhooks
- `LLM_API_KEY`: Added as `X-API-Key` header when calling LLM service

### LLM Service (FastAPI - Python)

**Location:** `ecosystem.config.js` → `llm-service` section

| Variable | Value (Production) | Purpose |
|----------|-------------------|---------|
| `PORT` | `5000` | LLM service listening port |
| `API_SERVICE_URL` | `https://api.resumecast.ai` | External API URL to load resume data |
| `LLM_API_KEYS` | `[vault_llm_authorized_api_keys]` | Comma-separated list of valid API keys |
| `LLAMA_SERVER_URL` | `http://localhost:11434` | Ollama server URL |
| `DATABASE_URL` | `postgresql://...` | Database connection (for backward compat) |

**Usage in code:**
- `API_SERVICE_URL`: Used by `api_client.py` to call API service endpoints
- `LLM_API_KEYS`: Validated in `api_key_auth.py` for authentication
- `LLAMA_SERVER_URL`: Used to generate AI responses

## Ansible Configuration

### Variable Hierarchy

**Global Variables** (`group_vars/all.yml`):
```yaml
# Service Ports (internal)
api_port: 3000
llm_port: 5000

# External URLs (production)
api_service_url: "https://api.resumecast.ai"
```

**Inventory Variables** (`inventory.yml`):
```yaml
# Override for specific environments
api_service_url: https://api.resumecast.ai  # Production
# OR
api_service_url: http://localhost:3000      # Development
```

### Template Usage (`ecosystem.config.js.j2`)

**API Service:**
```javascript
env: {
  LLM_SERVICE_URL: 'http://localhost:{{ llm_port }}',      // Internal call
  API_BASE_URL: '{{ api_service_url }}',                   // External URL
  LLM_API_KEY: '{{ llm_api_key }}'
}
```

**LLM Service:**
```javascript
env: {
  API_SERVICE_URL: '{{ api_service_url }}',                // External URL
  LLM_API_KEYS: '{{ llm_authorized_api_keys }}'
}
```

## Variable Naming Convention

**Standardized variable:** `api_service_url`

- ✅ Use `api_service_url` in all ansible configs
- ❌ Don't use `api_base_url` (deprecated, causes confusion)

**Why this matters:**
- API service needs `API_BASE_URL` env var for webhook callbacks
- LLM service needs `API_SERVICE_URL` env var to call API endpoints
- **Both point to the same external URL:** `https://api.resumecast.ai`
- Using one ansible variable (`api_service_url`) prevents inconsistencies

## Deployment Checklist

### After Code Changes

1. **Commit changes:**
   ```bash
   git add -A
   git commit -m "fix: update API/LLM configuration"
   git push origin main
   ```

2. **Deploy to production:**
   ```bash
   cd ansible
   ansible-playbook -i inventory-production.yml update-services.yml \
     --ask-vault-pass \
     --tags api-service,llm-service
   ```

3. **Verify configuration on server:**
   ```bash
   ssh jose@resumecast.ai
   cd /opt/my-resume
   
   # Check API service env
   pm2 env api-service | grep -E "API_BASE_URL|LLM"
   
   # Check LLM service env
   pm2 env llm-service | grep -E "API_SERVICE_URL|LLM_API_KEYS"
   ```

### Expected Values (Production)

```bash
# API Service
API_BASE_URL=https://api.resumecast.ai
LLM_SERVICE_URL=http://localhost:5000
LLM_API_KEY=[64-char hash]

# LLM Service
API_SERVICE_URL=https://api.resumecast.ai
LLM_API_KEYS=[64-char hash,another-key,...]
LLAMA_SERVER_URL=http://localhost:11434
```

## Testing

### 1. Test Frontend → API → LLM (Full Flow)

```bash
curl -X POST https://api.resumecast.ai/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is your AWS experience?",
    "slug": "jose-blanco-swe"
  }'
```

**Expected:** JSON response with AI-generated answer

### 2. Test API Service Logs

```bash
# On production server
pm2 logs api-service --lines 50 | grep -i chat
```

**Expected:**
```
[ChatService] Proxying request to LLM service
[ChatService] Calling LLM endpoint: http://localhost:5000/api/chat
[ChatService] Successfully received response
```

### 3. Test LLM Service Logs

```bash
# On production server
pm2 logs llm-service --lines 50 | grep -i "api"
```

**Expected:**
```
[AUTH] ✅ Valid API key for service: api-service
Calling API service at: https://api.resumecast.ai/api/llm-service/resume/jose-blanco-swe
Successfully loaded resume...
```

### 4. Check Ollama Health

```bash
curl https://llm-service.paskot.com/health
```

**Expected:**
```json
{
  "status": "healthy",
  "llama_server": "http://localhost:11434",
  "server_reachable": true,  ← Must be true!
  "model": "llama3.1"
}
```

**If `server_reachable: false`:**
```bash
ssh jose@resumecast.ai
sudo systemctl start ollama  # Or: ollama serve
pm2 restart llm-service
```

## Troubleshooting

### Issue: Chat returns 500 error

**Check 1:** Ollama running?
```bash
curl http://localhost:11434/api/tags
```

**Check 2:** LLM service can reach API service?
```bash
curl -H "Authorization: Bearer [token]" \
  https://api.resumecast.ai/api/llm-service/resume/jose-blanco-swe
```

**Check 3:** API keys match?
```bash
pm2 env api-service | grep LLM_API_KEY
pm2 env llm-service | grep LLM_API_KEYS
# First value in LLM_API_KEYS should equal LLM_API_KEY
```

### Issue: LLM service calls localhost:3000 instead of production

**Root cause:** `API_SERVICE_URL` not updated

**Fix:**
```bash
ssh jose@resumecast.ai
cd /opt/my-resume
nano ecosystem.config.js  # Update API_SERVICE_URL
pm2 restart llm-service --update-env
pm2 env llm-service | grep API_SERVICE_URL  # Verify
```

### Issue: Frontend still calls LLM service directly

**Root cause:** Frontend not rebuilt/redeployed

**Fix:**
```bash
# Rebuild and redeploy frontend
gcloud builds submit --config=apps/my-resume/cloudbuild.yaml
gcloud run deploy frontend --image [image-url]
```

**Verify:** Open browser DevTools → Network tab → Send chat message → Should see `POST /api/chat` not `POST /api/chat` to llm-service domain

## Security Notes

1. **Never expose `LLM_API_KEY` in frontend**
2. **Always use proxy pattern:** Frontend → API Service → LLM Service
3. **API keys stored in ansible-vault:** `vault_llm_api_key`, `vault_llm_authorized_api_keys`
4. **LLM service validates API keys** via `X-API-Key` header
5. **API service adds `X-API-Key`** automatically in proxy

## Related Files

- API Service chat proxy: `apps/api-service/src/features/chat/`
- LLM Service auth: `apps/llm-service/api_key_auth.py`
- LLM Service API client: `apps/llm-service/api_client.py`
- Ansible ecosystem template: `ansible/templates/ecosystem.config.js.j2`
- Variable definitions: `ansible/group_vars/all.yml`
- Environment overrides: `ansible/inventory.yml`
