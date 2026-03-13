# LLM Service API Key Authentication Guide

## Overview

The LLM service now requires API key authentication for all API endpoints (except `/health`). This prevents unauthorized access and allows tracking which service makes each request.

## Architecture

```
┌─────────────────────────┐         ┌─────────────────────────┐
│   API Service           │         │   LLM Service           │
│ API Key: abc123...      │─────────►│ Valid Keys:             │
└─────────────────────────┘         │  - abc123... (api-svc)  │
                                    │  - def456... (admin)    │
┌─────────────────────────┐         │  - ghi789... (mobile)   │
│   Other Service         │─────────►│                         │
│ API Key: ghi789...      │         │ Validates X-API-Key     │
└─────────────────────────┘         └─────────────────────────┘
```

**Authentication Flow:**
1. Client (API service, admin dashboard, etc.) makes request to LLM service
2. Includes `X-API-Key: <key>` header in request
3. LLM service `@require_api_key` decorator intercepts
4. `APIKeyManager` validates key against configured keys
5. If valid → logs service name, allows request
6. If invalid → returns `401 Unauthorized` with error message

## Configuration

### Generate API Keys

Use OpenSSL to generate secure random keys:

```bash
# Generate API service key
openssl rand -hex 32
# Output: a1b2c3d4e5f6789...

# Generate admin dashboard key
openssl rand -hex 32
# Output: f6e5d4c3b2a19876...

# Generate mobile app key
openssl rand -hex 32
# Output: 9876543210abcdef...
```

### LLM Service Configuration

The LLM service requires `LLM_API_KEYS` environment variable with a **JSON object** mapping service names to their API keys:

**apps/llm-service/.env:**
```bash
# API Key Authentication (Required)
# Multiple services can access LLM service with their own API keys
# Format: JSON object with service names as keys
LLM_API_KEYS='{
  "api-service": "a1b2c3d4e5f6789...",
  "admin-dashboard": "f6e5d4c3b2a19876...",
  "mobile-app": "9876543210abcdef..."
}'
```

**Features:**
- Multiple independent API keys (one per service)
- Named keys for tracking (logs show which service made request)
- Backward compatible: If `LLM_API_KEYS` not configured, allows all requests (warns in logs)

**Protected Endpoints:**
- `/api/chat` - Chat with AI about resume
- `/api/resume` - Get resume content
- `/api/improve-text` - Improve resume text
- `/api/embed` - Generate embeddings
- `/api/embed/batch` - Batch embedding generation
- `/api/reload-resume` - Reload resume from database
- `/api/companies/enrich` - Enrich company information
- `/api/positions/score` - Score position match

**Unprotected Endpoints:**
- `/health` - Health check (intentionally public for monitoring)

### API Service Configuration

The API service requires `LLM_API_KEY` environment variable with the key that matches one of the keys configured in LLM service:

**apps/api-service/.env:**
```bash
# API Key for accessing LLM service (required)
# This key must match one of the keys in LLM service's LLM_API_KEYS
LLM_API_KEY="a1b2c3d4e5f6789..."
```

**Implementation:**
All API service modules that call LLM service have been updated:
- `companies.service.ts` - Company enrichment
- `search.service.ts` - Search embeddings
- `embedding.processor.ts` - Embedding jobs
- `position-scoring.worker.ts` - Position scoring
- `resumes.service.ts` - Text improvement
- `interview-created.handler.ts` - Company enrichment on interview creation

Each service:
1. Loads `LLM_API_KEY` from `ConfigService`
2. Warns if key not configured
3. Uses `getLLMHeaders()` method to add `X-API-Key` header
4. Includes API key in all LLM service requests

## Testing

### Test Without API Key (Should Fail)

```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "test", "slug": "test"}'

# Expected Response:
# HTTP/1.1 401 Unauthorized
# {
#   "error": "Missing API Key",
#   "message": "X-API-Key header is required"
# }
```

### Test With Invalid API Key (Should Fail)

```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: invalid-key-12345" \
  -d '{"message": "test", "slug": "test"}'

# Expected Response:
# HTTP/1.1 401 Unauthorized
# {
#   "error": "Invalid API Key",
#   "message": "The provided API key is not valid"
# }
```

### Test With Valid API Key (Should Work)

```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: a1b2c3d4e5f6789..." \
  -d '{"message": "Hello", "slug": "jose-blanco"}'

# Expected Response:
# HTTP/1.1 200 OK
# {
#   "response": "Hello! How can I help you...",
#   ...
# }
```

### Verify Service Name Logging

Check LLM service logs to verify service names are logged:

```bash
# Start LLM service
cd apps/llm-service
USE_POETRY=true ./run.sh

# Make request with API key
# Check logs for:
INFO:api_key_auth:✅ Authenticated request from service: api-service to /api/chat
```

## Production Deployment

### Update ecosystem.config.js

Add API keys to PM2 configuration:

**ecosystem.config.js:**
```javascript
module.exports = {
  apps: [
    {
      name: 'api-service',
      script: './dist/main.js',
      cwd: './apps/api-service',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        LLM_API_KEY: 'a1b2c3d4e5f6789...',  // ← Add this
        // ... other env vars
      },
    },
    {
      name: 'llm-service',
      script: 'app_remote.py',
      cwd: './apps/llm-service',
      interpreter: '/path/to/conda/envs/resumecast/bin/python',
      instances: 1,
      exec_mode: 'fork',
      env: {
        PYTHONUNBUFFERED: '1',
        FLASK_APP: 'app_remote.py',
        LLM_API_KEYS: JSON.stringify({
          'api-service': 'a1b2c3d4e5f6789...',
          'admin-dashboard': 'f6e5d4c3b2a19876...',
        }),  // ← Add this
        // ... other env vars
      },
    },
  ],
};
```

### Restart Services

```bash
# Restart both services to pick up new configuration
pm2 restart api-service
pm2 restart llm-service

# Verify services are running
pm2 status

# Check logs for API key warnings
pm2 logs api-service | grep "LLM_API_KEY"
pm2 logs llm-service | grep "API key"
```

### Verify End-to-End

```bash
# From API service machine, test that it can call LLM service
curl -X POST http://localhost:3000/api/resumes/improve-text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{"text": "Test resume text", "context": "resume"}'

# Should succeed if API key configured correctly
# Should fail with 401 if API key missing or invalid
```

## Troubleshooting

### 401 Unauthorized - Missing API Key

**Error:**
```json
{
  "error": "Missing API Key",
  "message": "X-API-Key header is required"
}
```

**Cause:** Request to LLM service does not include `X-API-Key` header.

**Solutions:**
1. Check API service has `LLM_API_KEY` configured in `.env`
2. Verify API service is using `getLLMHeaders()` in fetch/axios calls
3. Check API service logs for warning: `LLM_API_KEY not configured`

### 401 Unauthorized - Invalid API Key

**Error:**
```json
{
  "error": "Invalid API Key",
  "message": "The provided API key is not valid"
}
```

**Cause:** The API key sent by client does not match any key in LLM service's `LLM_API_KEYS`.

**Solutions:**
1. Verify `LLM_API_KEY` in API service matches a key in LLM service `LLM_API_KEYS`
2. Check for typos or extra whitespace in keys
3. Regenerate keys if needed and update both services

### LLM Service Allows All Requests (No Authentication)

**Symptom:** Requests without API key are allowed through.

**Cause:** `LLM_API_KEYS` not configured in LLM service.

**Solution:**
1. Add `LLM_API_KEYS` to `apps/llm-service/.env`
2. Restart LLM service: `pm2 restart llm-service`
3. Check logs for: `⚠️ WARNING: API key authentication is DISABLED`

### Service Name Not Logged

**Symptom:** API key validation works but service name not shown in logs.

**Cause:** Key exists in `LLM_API_KEYS` but value doesn't match exactly.

**Solution:**
1. Check `LLM_API_KEYS` JSON format is correct (no trailing commas)
2. Verify service name in JSON matches what you expect
3. Check logs for: `✅ Authenticated request from service: <name>`

### LLM Service Won't Start

**Error:**
```
Failed to load API keys: json.decoder.JSONDecodeError: Expecting property name...
```

**Cause:** Invalid JSON in `LLM_API_KEYS` environment variable.

**Solutions:**
1. Validate JSON format: `echo $LLM_API_KEYS | jq .`
2. Check for:
   - Missing or extra commas
   - Missing quotes around keys/values
   - Missing closing braces
3. Use single quotes around entire JSON string in `.env`:
   ```bash
   LLM_API_KEYS='{"api-service": "key123", "admin": "key456"}'
   ```

## Security Best Practices

### Key Generation
- Use `openssl rand -hex 32` to generate cryptographically secure keys
- Never reuse keys across environments (dev, staging, production)
- Minimum length: 32 characters

### Key Storage
- Store keys in environment variables, never in code
- Use secret management tools (AWS Secrets Manager, HashiCorp Vault) in production
- Add `.env` to `.gitignore` (already done)

### Key Rotation
1. Generate new key: `openssl rand -hex 32`
2. Add new key to LLM service `LLM_API_KEYS` (with new name if needed)
3. Update client service to use new key
4. Test with new key
5. Remove old key from `LLM_API_KEYS`
6. Restart LLM service

### Monitoring
- Monitor for 401 errors (failed authentication attempts)
- Check service name logs to verify legitimate services
- Set up alerts for unusual authentication patterns

## Implementation Details

### LLM Service (Python/Flask)

**api_key_auth.py:**
```python
class APIKeyManager:
    def __init__(self):
        """Load API keys from LLM_API_KEYS environment variable"""
        self.api_keys = self._load_api_keys()
    
    def _load_api_keys(self) -> dict:
        """Parse JSON from environment"""
        # Returns dict: {"service-name": "api-key"}
    
    def validate_key(self, key: str) -> tuple:
        """
        Validate an API key.
        Returns: (is_valid: bool, service_name: str | None)
        """

@require_api_key
def protected_endpoint():
    """Decorator validates X-API-Key header"""
    service_name = request.api_service  # Available in handler
```

**app_remote.py:**
```python
from api_key_auth import require_api_key, get_api_key_manager

# Initialize on startup
api_key_manager = get_api_key_manager()

@app.route('/api/chat', methods=['POST'])
@require_api_key  # ← Decorator protects endpoint
def chat():
    # Service name available via: request.api_service
    return jsonify({"response": "..."})
```

### API Service (TypeScript/NestJS)

**Pattern (all services):**
```typescript
@Injectable()
export class SomeService {
  private readonly llmServiceUrl: string;
  private readonly llmApiKey: string;

  constructor(
    private configService: ConfigService,
    // ... other deps
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

  async callLLM() {
    // Using fetch:
    const response = await fetch(`${this.llmServiceUrl}/api/endpoint`, {
      method: 'POST',
      headers: this.getLLMHeaders(),  // ← Use helper
      body: JSON.stringify({...})
    });

    // Using axios:
    const response = await axios.post(
      `${this.llmServiceUrl}/api/endpoint`,
      {...},
      { headers: this.getLLMHeaders() }  // ← Use helper
    );
  }
}
```

## Related Documentation

- [JWT Authentication](./JWT_AUTH_COMPLETE.md) - LLM→API authentication
- [Deployment Guide](./ansible/DEPLOYMENT.md) - Production deployment
- [LLM Service Operations](./apps/llm-service/OPERATIONS.md) - LLM service documentation
- [API Service Architecture](./apps/api-service/README.md) - API service documentation

## Changelog

### Version 1.0 (Current)
- ✅ Implemented API key authentication for LLM service
- ✅ Updated all 6 API service modules to send API keys
- ✅ Added named keys for service tracking
- ✅ Backward compatible (no keys = allow all + warn)
- ✅ Comprehensive logging and error messages
- ✅ Configuration templates (.env.example)

### Future Enhancements
- [ ] API key rotation endpoint
- [ ] Admin endpoint to list/revoke keys
- [ ] Metrics for API key usage (requests per service)
- [ ] Rate limiting per API key
- [ ] API key expiration dates
