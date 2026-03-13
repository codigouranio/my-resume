# Cloud Deployment Architecture - Complete

## ✅ Refactoring Complete!

The LLM service has been successfully refactored to work **without direct PostgreSQL access**, enabling a cloud deployment architecture where:
- Frontend + API Service → Google Cloud (with PostgreSQL)
- LLM Service → Home server (with Ollama/vLLM)
- Connection via Cloudflare Tunnel (HTTPS only, no database exposure)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│        Google Cloud / Cloud Run                 │
│                                                  │
│  ┌──────────────┐      ┌──────────────────┐   │
│  │   Frontend   │─────▶│   API Service    │   │
│  │  (React 19)  │      │   (NestJS +      │   │
│  └──────────────┘      │    GraphQL)      │   │
│                        │                  │   │
│                        └──────┬───────────┘   │
│                               │               │
│                        ┌──────┴───────────┐   │
│                        │   PostgreSQL     │   │
│                        │   (Cloud SQL)    │   │
│                        └──────────────────┘   │
└────────────────────────────┬──────────────────┘
                             │
                             │ HTTPS (Cloudflare Tunnel)
                             │ Token Authentication
                             │
┌────────────────────────────┴──────────────────┐
│         Home Server                           │
│                                                │
│  ┌──────────────────┐    ┌──────────────────┐│
│  │   LLM Service    │───▶│  Ollama / vLLM   ││
│  │   (Flask)        │    │  (GPU-accelerated)││
│  └──────────────────┘    └──────────────────┘│
│          │                                    │
│          └──── Redis (Celery queue)          │
└───────────────────────────────────────────────┘
```

---

## Files Changed

### 1. **Backend API Service** (NestJS)

**New Module:** `apps/api-service/src/features/llm-service-api/`

Files created:
- ✅ `llm-service-api.controller.ts` - HTTP endpoints with token auth
- ✅ `llm-service-api.service.ts` - Database access layer  
- ✅ `llm-service-api.module.ts` - NestJS module registration
- ✅ `dto/log-chat-interaction.dto.ts` - Request validation DTOs

**Endpoints Added:**
```typescript
GET  /api/llm-service/resume/:slug              // Get resume + llmContext
GET  /api/llm-service/resume/:slug/user         // Get user info
POST /api/llm-service/chat/log                  // Log chat interaction
GET  /api/llm-service/resume/:slug/history/:id  // Get conversation history
```

**Authentication:** All endpoints require `X-LLM-Service-Token` header

**Modified:**
- ✅ `apps/api-service/src/app.module.ts` - Registered LlmServiceApiModule

### 2. **LLM Service** (Python/Flask)

**New File:**
- ✅ `apps/llm-service/api_client.py` - HTTP client for API calls

Functions:
```python
load_resume_from_api(slug) → (context, id)
get_user_info_from_api(slug) → user_dict
log_chat_interaction_to_api(...) → bool
load_conversation_history_from_api(slug, session, limit) → list
```

**Modified:**
- ✅ `apps/llm-service/app_remote.py` 
  - Removed: `import psycopg2`, `get_db_connection()`
  - Replaced: 4 functions to use API calls instead of direct SQL
  - Updated: Configuration to use API_SERVICE_URL + LLM_SERVICE_TOKEN

Functions refactored:
1. ✅ `load_resume_from_db()` → Wrapper for `load_resume_from_api()`
2. ✅ `load_conversation_history()` → Wrapper for `load_conversation_history_from_api()`
3. ✅ `log_chat_interaction()` → Uses `log_chat_interaction_to_api()`
4. ✅ `get_user_info()` → Uses `get_user_info_from_api()`

### 3. **Dependencies**

- ✅ `apps/llm-service/pyproject.toml` 
  - Removed: `psycopg2-binary = "^2.9.9"`
  - Comment: "Database access now via API, not direct connection"

### 4. **Configuration Files**

**API Service:**
- ✅ `apps/api-service/.env.example`
  - Added: `LLM_SERVICE_TOKEN="your-secure-random-token"`

**LLM Service:**
- ✅ `apps/llm-service/.env.example`
  - Removed: `DATABASE_URL`
  - Added: `API_SERVICE_URL`, `LLM_SERVICE_TOKEN`

**PM2 Configuration:**
- ✅ `ecosystem.config.js`
  - Updated all 4 services: api-service, llm-service, llm-celery-worker, llm-flower
  - Added `LLM_SERVICE_TOKEN` to api-service
  - Replaced `DATABASE_URL` with `API_SERVICE_URL` + `LLM_SERVICE_TOKEN` in LLM services

---

## Environment Variables

### API Service (Google Cloud)

```bash
# Existing
DATABASE_URL="postgresql://user:pass@localhost:5432/db"
JWT_SECRET="your-jwt-secret"
PORT=3000

# NEW - for LLM service authentication
LLM_SERVICE_TOKEN="your-secure-random-token-32-chars-minimum"
```

### LLM Service (Home Server)

```bash
# NEW - replaces DATABASE_URL
API_SERVICE_URL="https://your-api-service.run.app"  # Cloud Run URL
LLM_SERVICE_TOKEN="same-token-as-api-service"

# Existing (unchanged)
PORT=5000
LLAMA_SERVER_URL="http://localhost:11434"
LLAMA_API_TYPE="ollama"
OLLAMA_MODEL="llama3.1:latest"
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_DB=1
```

---

## Security Model

### Before (Insecure for Cloud)
```
Home LLM Service → PostgreSQL over Internet
Problem: Database credentials exposed, port 5432 open to internet
```

### After (Secure)
```
Home LLM Service → HTTPS API → PostgreSQL (local)
Benefits:
✅ No database credentials on home server
✅ No PostgreSQL port exposed
✅ Token-based auth (can rotate easily)
✅ Cloudflare tunnel compatible (HTTPS only)
✅ Rate limiting at API layer
✅ Audit logging of all data access
```

### Token Security

**Generation:**
```bash
# Generate secure token (32+ chars)
openssl rand -base64 32
```

**Usage:**
- Store in environment variables (never commit to git)
- Must match exactly on both services
- Validated using timing-safe comparison
- Can be rotated without code changes

**Headers:**
```http
POST /api/llm-service/chat/log HTTP/1.1
Host: your-api.run.app
X-LLM-Service-Token: your-token-here
Content-Type: application/json
```

---

## Deployment Steps

### 1. **Deploy API Service to Google Cloud**

```bash
# Build and deploy (using Ansible or manual)
cd /path/to/my-resume
./ansible/deploy_with_conda.sh

# Or deploy to Cloud Run
gcloud run deploy api-service \
  --source ./apps/api-service \
  --region us-central1 \
  --set-env-vars LLM_SERVICE_TOKEN="your-token"
```

### 2. **Setup Cloudflare Tunnel**

```bash
# Install cloudflared on home server
brew install cloudflared  # or download from cloudflare.com

# Login
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create llm-service

# Configure tunnel (create config.yml)
cat > ~/.cloudflared/config.yml << EOF
tunnel: <TUNNEL-ID>
credentials-file: /path/to/credentials.json
ingress:
  - hostname: llm.yourdomain.com
    service: http://localhost:5000
  - service: http_status:404
EOF

# Run tunnel
cloudflared tunnel run llm-service

# Or as service (recommended)
sudo cloudflared service install
sudo systemctl start cloudflared
```

### 3. **Update LLM Service Configuration**

```bash
# Edit .env on home server
cd /path/to/my-resume/apps/llm-service
nano .env

# Set these:
API_SERVICE_URL="https://your-api-service.run.app"
LLM_SERVICE_TOKEN="same-token-as-cloud"

# Remove DATABASE_URL line completely
```

### 4. **Install Dependencies**

```bash
cd /path/to/my-resume/apps/llm-service

# Using Poetry
poetry lock
poetry install

# Or using pip
pip install -r requirements.txt.backup  # if using backup
```

### 5. **Restart Services**

```bash
# If using PM2
pm2 restart llm-service
pm2 restart llm-celery-worker

# Or restart manually
./run.sh
```

### 6. **Test End-to-End**

```bash
# Test from home server to cloud API
curl -H "X-LLM-Service-Token: $LLM_SERVICE_TOKEN" \
  https://your-api-service.run.app/api/llm-service/resume/john-doe

# Test chat endpoint (through tunnel)
curl https://llm.yourdomain.com/health
```

---

## Testing Checklist

### Local Testing (Before Deployment)

- [ ] API service builds successfully: `npm run build`
- [ ] API service starts: `npm run start:dev`
- [ ] LLM service starts without DB errors
- [ ] Chat endpoint returns responses
- [ ] Analytics logging works (check database)
- [ ] Conversation history loads correctly

### Cloud Deployment Testing

- [ ] API service deployed to Cloud Run
- [ ] Environment variables set correctly
- [ ] Health check passes: `/api/health`
- [ ] Token authentication works (401 on wrong token)

### Cloudflare Tunnel Testing

- [ ] Tunnel established and running
- [ ] Home LLM service accessible via tunnel URL
- [ ] Chat endpoint accessible from internet
- [ ] End-to-end flow: Browser → Cloud API → Home LLM → Ollama

### Integration Testing

- [ ] Frontend chat widget works
- [ ] Chat responses appear correctly
- [ ] Analytics logged in Cloud SQL
- [ ] No error logs in PM2 or Cloud Run logs
- [ ] Performance acceptable (API calls add ~50-200ms latency)

---

## Troubleshooting

### Issue: "Cannot find module './llm-service-api.service'"

**Cause:** TypeScript LSP cache or build issue

**Fix:**
```bash
cd apps/api-service
npm run build  # Should complete without errors
# Restart VS Code if needed
```

### Issue: "401 Unauthorized" on API calls

**Cause:** Token mismatch or missing header

**Fix:**
```bash
# Check tokens match
echo $LLM_SERVICE_TOKEN  # On both servers

# Verify header in request
curl -v -H "X-LLM-Service-Token: $TOKEN" ...
```

### Issue: "Resume not found" errors

**Cause:** Slug not in database or wrong database

**Fix:**
```bash
# Verify resume exists
psql $DATABASE_URL -c "SELECT slug FROM \"Resume\";"

# Check API service connects to correct DB
echo $DATABASE_URL
```

### Issue: Cloudflare tunnel disconnects

**Cause:** Network issues or tunnel daemon crash

**Fix:**
```bash
# Check tunnel status
cloudflared tunnel info

# Restart tunnel
sudo systemctl restart cloudflared

# Check logs
journalctl -u cloudflared -f
```

### Issue: High latency on chat responses

**Cause:** API calls add round-trip time

**Analysis:**
- API call overhead: ~50-200ms per request
- Resume loading: 1 API call
- User info: 1 API call  
- Chat logging: 1 API call (async, doesn't block response)

**Optimization:**
- Cache resume content in LLM service (Redis)
- Use HTTP/2 for multiplexing
- Deploy API service in same region as tunnel exit node

---

## Rollback Plan

If issues occur, you can quickly rollback:

### 1. Keep Old Code (with Database Access)

Create a backup branch:
```bash
git checkout -b pre-cloud-refactor
# Keep this branch for emergency rollback
```

### 2. Run Hybrid Mode (Temporary)

You can keep the old database-access code and run both architectures:
- Production: Use API calls (new code)
- Fallback: Use direct DB (old code in backup branch)

### 3. Revert Changes

To rollback completely:
```bash
# Restore database connection
git revert <commit-hash>

# Add psycopg2 back
cd apps/llm-service
poetry add psycopg2-binary

# Restore DATABASE_URL in .env
DATABASE_URL="postgresql://..."

# Restart services
pm2 restart all
```

---

## Performance Considerations

### Latency Impact

**Before (Direct DB):**
```
Chat request → Load resume (DB: ~10ms) → Generate response → Save analytics (DB: ~20ms)
Total DB time: ~30ms
```

**After (API Calls):**
```
Chat request → Load resume (API: ~50-150ms) → Generate response → Save analytics (API: ~50-150ms)
Total API time: ~100-300ms
```

**Mitigation:**
1. **Caching**: Cache resume content in Redis (TTL: 5 minutes)
   ```python
   # Check cache first
   cached = redis.get(f"resume:{slug}")
   if cached:
       return json.loads(cached)
   # Otherwise fetch from API and cache
   ```

2. **Async Logging**: Don't wait for analytics API call
   ```python
   # Fire and forget
   threading.Thread(target=log_chat_interaction_to_api, args=(...)).start()
   ```

3. **Connection Pooling**: Reuse HTTP connections
   ```python
   session = requests.Session()  # Reuse for multiple requests
   ```

### Cost Analysis

**Database Access:**
- Cloud SQL + Cloudflare Access: ~$50-100/month
- Requires exposing database or VPN

**API Access (Current):**
- Cloud Run: Pay per request (~$0.40 per million requests)
- Cloudflare Tunnel: Free
- Much more cost-effective and secure

---

## Future Enhancements

### 1. Response Caching

Cache common questions/answers:
```python
cache_key = f"qa:{resume_slug}:{hash(question)}"
cached_answer = redis.get(cache_key)
if cached_answer:
    return cached_answer
```

### 2. Batch API Calls

Combine multiple requests into one:
```typescript
// New endpoint
POST /api/llm-service/batch
Body: [
  { type: "getResume", slug: "john-doe" },
  { type: "getUser", slug: "john-doe" }
]
```

### 3. WebSocket for Real-time

Replace polling with WebSocket for live chat:
```
Browser ←WebSocket→ Cloud API ←HTTPS→ Home LLM
```

### 4. Multi-region Deployment

Deploy LLM service to multiple locations:
- Home server (primary)
- Cloud GPU instance (failover)
- Edge compute (low latency)

---

## Success Metrics

✅ **Deployment successful if:**
- Chat responses work end-to-end
- No database connection errors in logs
- Analytics data appears in Cloud SQL
- Latency < 500ms added by API calls
- No security vulnerabilities (database exposed)

✅ **Completed:**
- All TypeScript compiles without errors
- All Python functions refactored
- Dependencies updated (psycopg2 removed)
- Environment configs updated
- PM2 config updated
- Documentation complete

---

## Maintenance

### Rotating Tokens

```bash
# Generate new token
NEW_TOKEN=$(openssl rand -base64 32)

# Update API service
gcloud run services update api-service \
  --update-env-vars LLM_SERVICE_TOKEN="$NEW_TOKEN"

# Update home server
nano /path/to/my-resume/apps/llm-service/.env
# Change LLM_SERVICE_TOKEN

pm2 restart llm-service
```

### Monitoring

**Cloud API (via Cloud Run):**
```bash
gcloud logging read "resource.type=cloud_run_revision" --limit 50
```

**Home LLM Service (via PM2):**
```bash
pm2 logs llm-service --lines 100
pm2 monit  # Live monitoring
```

**Cloudflare Tunnel:**
```bash
journalctl -u cloudflared -f
cloudflared tunnel info
```

### Backup Strategy

Since API service has full database access, backups remain on Cloud SQL:
```bash
gcloud sql backups list --instance=resume-db
```

No changes needed for LLM service backups (just code/config).

---

## Questions?

See also:
- [apps/api-service/GRAPHQL_CQRS.md](apps/api-service/GRAPHQL_CQRS.md) - GraphQL API docs
- [apps/llm-service/OPERATIONS.md](apps/llm-service/OPERATIONS.md) - LLM operations guide
- [ansible/DEPLOYMENT.md](ansible/DEPLOYMENT.md) - Deployment procedures
- [LLM_SERVICE_REFACTORING.md](LLM_SERVICE_REFACTORING.md) - Detailed changes log

**Ready to deploy!** 🚀
