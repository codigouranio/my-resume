# API Key Authentication - Implementation Summary

## ✅ COMPLETED (All Tasks Done)

### 1. LLM Service Protection
**Created:** `apps/llm-service/api_key_auth.py` (145 lines)

**Features:**
- `APIKeyManager` class - loads keys from `LLM_API_KEYS` JSON env var
- `validate_key()` - returns (bool, service_name) tuple
- `@require_api_key` decorator - protects Flask routes
- Logs service name for each authenticated request
- Returns 401 with clear error message if invalid
- Backward compatible (no keys configured = allow all + warn)

**Protected Endpoints (8 total):**
- ✅ `/api/chat` - Chat with AI about resume
- ✅ `/api/resume` - Get resume content
- ✅ `/api/improve-text` - Improve resume text
- ✅ `/api/embed` - Generate embeddings
- ✅ `/api/embed/batch` - Batch embedding generation
- ✅ `/api/reload-resume` - Reload resume from database
- ✅ `/api/companies/enrich` - Enrich company information
- ✅ `/api/positions/score` - Score position match

**Unprotected Endpoints:**
- `/health` - Intentionally public for monitoring

### 2. Configuration Templates Updated
**Updated:** `apps/llm-service/.env.example`
```bash
LLM_API_KEYS='{
  "api-service": "sk_prod_change_me_api_service_key_here",
  "admin-dashboard": "sk_prod_change_me_admin_dashboard_key_here"
}'
```

**Updated:** `apps/api-service/.env.example`
```bash
LLM_API_KEY="sk_prod_change_me_api_service_key_here"
```

### 3. API Service Updated (6 Files)

All modules that call LLM service now send `X-API-Key` header:

**✅ companies.service.ts**
- Added: `llmApiKey` property
- Added: `getLLMHeaders()` method
- Updated: `enrichCompanyAsync()` - uses API key
- Updated: `fetchFromLLMService()` - uses API key

**✅ search.service.ts**
- Added: `llmApiKey` property
- Added: `getLLMHeaders()` method
- Updated: `generateEmbedding()` - axios call uses API key

**✅ embedding.processor.ts**
- Added: `llmApiKey` property
- Added: `getLLMHeaders()` method
- Updated: `generateEmbedding()` - axios call uses API key

**✅ position-scoring.worker.ts**
- Added: `llmApiKey` property
- Added: `getLLMHeaders()` method
- Updated: Position scoring axios call uses API key

**✅ resumes.service.ts**
- Added: `ConfigService` injection (was missing)
- Added: `llmServiceUrl` and `llmApiKey` properties
- Added: `getLLMHeaders()` method
- Updated: `improveText()` - fetch call uses API key
- Removed: Direct `process.env` access (now uses ConfigService)

**✅ interview-created.handler.ts**
- Added: `ConfigService` injection (was missing)
- Added: `llmServiceUrl`, `llmApiKey`, and `apiUrl` properties
- Added: `getLLMHeaders()` method
- Updated: `triggerCompanyEnrichment()` - fetch call uses API key
- Removed: Direct `process.env` access (now uses ConfigService)

### 4. Documentation Created

**✅ LLM_API_KEY_GUIDE.md** (Complete guide with):
- Overview and architecture diagram
- Configuration instructions (JSON format)
- Key generation commands (`openssl rand -hex 32`)
- Testing instructions (3 test scenarios)
- Production deployment (ecosystem.config.js updates)
- Troubleshooting (5 common issues + solutions)
- Security best practices
- Implementation details (code patterns)
- Changelog and future enhancements

## Architecture

### Authentication Flow
```
1. API service loads LLM_API_KEY from config
2. Creates headers with X-API-Key header
3. Sends request to LLM service
4. LLM service @require_api_key decorator validates
5. If valid → logs service name, processes request
6. If invalid → returns 401 with error message
```

### Multi-Service Support
```
LLM Service Configuration:
LLM_API_KEYS='{
  "api-service": "key1",
  "admin-dashboard": "key2",
  "mobile-app": "key3"
}'

Each service gets its own key:
- API Service: LLM_API_KEY="key1"
- Admin Dashboard: LLM_API_KEY="key2"
- Mobile App: LLM_API_KEY="key3"

Benefits:
- Track which service made each request (logged)
- Revoke individual service access
- Add new services without code changes
```

## Files Modified/Created

### Created (1 file):
- ✅ `apps/llm-service/api_key_auth.py` - Authentication module (145 lines)
- ✅ `LLM_API_KEY_GUIDE.md` - Complete documentation (500+ lines)
- ✅ `API_KEY_IMPLEMENTATION_SUMMARY.md` - This file

### Modified (9 files):
- ✅ `apps/llm-service/app_remote.py` - Protected 8 endpoints
- ✅ `apps/llm-service/.env.example` - Added LLM_API_KEYS
- ✅ `apps/api-service/.env.example` - Added LLM_API_KEY
- ✅ `apps/api-service/src/features/companies/companies.service.ts`
- ✅ `apps/api-service/src/features/embeddings/search.service.ts`
- ✅ `apps/api-service/src/features/embeddings/embedding.processor.ts`
- ✅ `apps/api-service/src/features/companies/position-scoring.worker.ts`
- ✅ `apps/api-service/src/features/resumes/resumes.service.ts`
- ✅ `apps/api-service/src/features/interviews/events/handlers/interview-created.handler.ts`

## Testing Status

### ⚠️ NOT YET TESTED (Next Steps)

**Runtime Testing Required:**
```bash
# 1. Generate API keys
openssl rand -hex 32  # For api-service

# 2. Configure both services
# apps/llm-service/.env:
LLM_API_KEYS='{"api-service": "<generated-key>"}'

# apps/api-service/.env:
LLM_API_KEY="<same-generated-key>"

# 3. Start LLM service
cd apps/llm-service
USE_POETRY=true ./run.sh

# 4. Start API service
cd apps/api-service
npm run start:dev

# 5. Test without API key (should fail 401)
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "test", "slug": "test"}'

# 6. Test with invalid key (should fail 401)
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: invalid" \
  -d '{"message": "test", "slug": "test"}'

# 7. Test end-to-end through API service (should work)
# - Create resume
# - Call improve-text endpoint
# - Call company enrichment
# - Call position scoring
# - Call embedding generation
# - Call chat endpoint

# 8. Verify service name logging
# Check LLM service logs for:
"✅ Authenticated request from service: api-service to /api/chat"
```

**Compilation Status:**
- ✅ All 6 TypeScript files: No errors (verified with get_errors)
- ✅ Python module: Syntax correct (no imports failing)

## Production Deployment

### Steps Required

**1. Update ecosystem.config.js:**
```javascript
{
  name: 'api-service',
  env: {
    LLM_API_KEY: 'prod_key_here',  // ← Add
    // ... other vars
  }
},
{
  name: 'llm-service',
  env: {
    LLM_API_KEYS: '{"api-service": "prod_key_here"}',  // ← Add
    // ... other vars
  }
}
```

**2. Generate production keys:**
```bash
openssl rand -hex 32
```

**3. Deploy:**
```bash
# Option 1: Full deployment
./ansible/deploy_with_conda.sh

# Option 2: Quick update (code only)
./ansible/update-quick.sh

# Option 3: Manual PM2 restart
pm2 restart api-service
pm2 restart llm-service
```

**4. Verify:**
```bash
pm2 logs api-service | grep "LLM_API_KEY"
pm2 logs llm-service | grep "API key"
```

## Security Improvements

**Before:**
- ❌ LLM service publicly accessible
- ❌ Anyone with URL can call endpoints
- ❌ No tracking of who made requests
- ❌ No way to revoke access

**After:**
- ✅ LLM service protected by API key
- ✅ Only services with valid keys can access
- ✅ Service name logged for each request
- ✅ Can revoke individual service keys
- ✅ Can add new services without code changes
- ✅ Industry-standard X-API-Key header

## Key Features

1. **Multiple Independent Keys**
   - Each service gets its own key
   - Keys are named (know which service made request)
   - JSON configuration in environment variable

2. **Named Keys for Tracking**
   - Logs: "✅ Authenticated request from service: api-service to /api/chat"
   - Easy to identify which service is calling
   - Monitor usage per service

3. **Backward Compatible**
   - If no keys configured → allow all requests (with warning)
   - Gradual migration possible
   - No breaking changes

4. **Clear Error Messages**
   - Missing key: "X-API-Key header is required"
   - Invalid key: "The provided API key is not valid"
   - Returns 401 Unauthorized with JSON error

5. **Health Check Excluded**
   - `/health` endpoint intentionally not protected
   - Monitoring tools can check status
   - No credentials needed for health checks

## Pattern Established

All API service modules follow same pattern:

```typescript
@Injectable()
export class SomeService {
  private readonly llmServiceUrl: string;
  private readonly llmApiKey: string;

  constructor(
    private configService: ConfigService,
  ) {
    this.llmApiKey = this.configService.get<string>('LLM_API_KEY', '');
    if (!this.llmApiKey) {
      this.logger.warn('LLM_API_KEY not configured');
    }
  }

  private getLLMHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': this.llmApiKey,
    };
  }

  async someLLMCall() {
    const response = await fetch(`${this.llmServiceUrl}/api/endpoint`, {
      method: 'POST',
      headers: this.getLLMHeaders(),  // ← Always use this
      body: JSON.stringify({...})
    });
  }
}
```

## Common Issues & Solutions

**Issue 1: 401 Unauthorized**
- Check: `LLM_API_KEY` configured in API service
- Check: Key matches one in LLM service `LLM_API_KEYS`
- Check: No typos or extra whitespace

**Issue 2: Service Name Not Logged**
- Check: `LLM_API_KEYS` JSON format is correct
- Check: Service name in JSON matches expected name

**Issue 3: LLM Service Allows All Requests**
- Cause: `LLM_API_KEYS` not configured
- Solution: Add to `.env` and restart

**Issue 4: JSON Parse Error**
- Cause: Invalid JSON in `LLM_API_KEYS`
- Solution: Validate with `jq` or online JSON validator
- Use single quotes around entire JSON string

**Issue 5: API Service Can't Load Key**
- Cause: `ConfigService` not injected
- Solution: Add to constructor (already done in all 6 files)

## Next Steps

### Immediate (Required for Production)
1. ⬜ Generate production API keys
2. ⬜ Update `.env` files (both services)
3. ⬜ Test locally (without key → 401, with key → 200)
4. ⬜ Update `ecosystem.config.js` with prod keys
5. ⬜ Deploy to production
6. ⬜ Verify end-to-end authentication works
7. ⬜ Check logs for service name tracking

### Optional (Future Enhancements)
8. ⬜ Add API key rotation mechanism
9. ⬜ Add admin endpoint to list/revoke keys
10. ⬜ Add metrics for API key usage
11. ⬜ Add rate limiting per API key
12. ⬜ Add API key expiration dates
13. ⬜ Create separate key for admin dashboard
14. ⬜ Create separate key for mobile app (if needed)

## Related Documentation

- [LLM_API_KEY_GUIDE.md](./LLM_API_KEY_GUIDE.md) - Complete setup guide
- [JWT_AUTH_COMPLETE.md](./JWT_AUTH_COMPLETE.md) - LLM→API authentication
- [ansible/DEPLOYMENT.md](./ansible/DEPLOYMENT.md) - Production deployment
- [apps/llm-service/OPERATIONS.md](./apps/llm-service/OPERATIONS.md) - LLM operations

## Summary

**What was done:**
- ✅ Created API key authentication system for LLM service
- ✅ Protected all 8 LLM service endpoints
- ✅ Updated all 6 API service modules to send API keys
- ✅ Created comprehensive documentation
- ✅ No compilation errors

**What's needed:**
- ⬜ Generate production keys
- ⬜ Test locally
- ⬜ Deploy to production

**Security benefit:**
- LLM service no longer publicly accessible
- Only authorized services can call endpoints
- Track which service made each request
- Can revoke individual service access
