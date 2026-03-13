# Service Interactions & Authentication

**Status:** ✅ Production Ready  
**Last Updated:** March 2026

## Overview

The My Resume platform uses a **two-way authentication model** between API Service and LLM Service:

1. **API → LLM:** API Key Authentication (X-API-Key header)
2. **LLM → API:** JWT Authentication (Bearer token)

This dual authentication ensures secure bi-directional communication while maintaining backward compatibility.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Service Interaction Flow                     │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐                    ┌──────────────────────┐
│   API Service        │                    │   LLM Service        │
│   (NestJS/Cloud)     │                    │   (Flask/Home GPU)   │
└──────────────────────┘                    └──────────────────────┘
          │                                            │
          │  1. JWT Login (username/password)         │
          │────────────────────────────────────────────>│
          │                                            │
          │  2. JWT Token (expires in 1 hour)         │
          │<────────────────────────────────────────────│
          │                                            │
          │  3. API Request with X-API-Key header     │
          │────────────────────────────────────────────>│
          │     (Improve text, company enrichment)    │
          │                                            │
          │  4. Validate API Key                      │
          │                                            │
          │  5. Response with improvements            │
          │<────────────────────────────────────────────│
          │                                            │
          │                                            │
          │  6. API Call with Authorization: Bearer   │
          │<────────────────────────────────────────────│
          │     (Load resume data, company search)    │
          │                                            │
          │  7. Validate JWT Token                    │
          │                                            │
          │  8. Response with resume data             │
          │────────────────────────────────────────────>│
          │                                            │
          │  9. Auto-refresh JWT before expiry        │
          │<───────────────────────────────────────────>│
          │     (Background thread every 5 min)       │
          │                                            │
```

## Authentication Methods

### 1. API Key Authentication (API → LLM)

**Purpose:** API Service authenticates when calling LLM Service endpoints

**Endpoints Protected:**
- `POST /api/chat` - Chat with AI
- `POST /api/improve-text` - Text improvement
- `POST /api/company-enrichment` - Company data enrichment
- `POST /api/reload-resume` - Reload resume data
- `POST /api/analyze-chat` - Chat analytics
- `POST /api/recruiter-interest` - Recruiter notifications
- `POST /api/webhooks/celery/*` - Celery task webhooks
- All future API endpoints

**How it Works:**

1. **API Service Configuration:**
   ```bash
   # apps/api-service/.env
   LLM_API_KEY="sk_prod_abc123..."  # Single key to send
   ```

2. **LLM Service Configuration:**
   ```bash
   # apps/llm-service/.env
   LLM_API_KEYS='{
     "api-service": "sk_prod_abc123...",
     "admin-dashboard": "sk_prod_def456..."
   }'  # JSON of authorized keys
   ```

3. **API Service sends requests:**
   ```typescript
   // TypeScript (API Service)
   const response = await axios.post(
     `${LLM_SERVICE_URL}/api/improve-text`,
     { text: "..." },
     {
       headers: {
         'Content-Type': 'application/json',
         'X-API-Key': process.env.LLM_API_KEY
       }
     }
   );
   ```

4. **LLM Service validates:**
   ```python
   # Python (LLM Service)
   from api_key_auth import require_api_key
   
   @app.route('/api/improve-text', methods=['POST'])
   @require_api_key  # Validates X-API-Key header
   def improve_text():
       # Only reached if API key is valid
       return jsonify({"improved": "..."})
   ```

**Key Generation:**
```bash
openssl rand -hex 32
# Output: 64-character hex string
```

**Security Features:**
- ✅ Constant-time comparison (prevents timing attacks)
- ✅ Multiple service support (each service gets unique key)
- ✅ Easy key rotation (update JSON and redeploy)
- ✅ No tokens in URLs or logs
- ✅ HTTP 401 on invalid/missing keys

**Files Modified:**
- `apps/llm-service/api_key_auth.py` - API key validation decorator
- `apps/llm-service/app_remote.py` - Applied to 8 endpoints
- `apps/api-service/src/features/llm-service-api/*` - Added X-API-Key header to 6 files

---

### 2. JWT Authentication (LLM → API)

**Purpose:** LLM Service authenticates when calling API Service endpoints

**Endpoints Used:**
- `POST /auth/login` - Get JWT token
- `GET /api/resumes/llm/:slug` - Load resume for chat (with hidden context)
- `GET /api/companies/search` - Search companies for enrichment
- Any future LLM→API calls

**How it Works:**

1. **Shared Credentials:**
   ```bash
   # apps/api-service/.env AND apps/llm-service/.env
   LLM_SERVICE_USERNAME="llm-service"
   LLM_SERVICE_PASSWORD="<same-secure-password>"
   ```

2. **LLM Service authenticates on startup:**
   ```python
   # Python (LLM Service)
   def authenticate():
       response = requests.post(
           f"{API_SERVICE_URL}/auth/login",
           json={
               "username": os.getenv("LLM_SERVICE_USERNAME"),
               "password": os.getenv("LLM_SERVICE_PASSWORD")
           }
       )
       token = response.json()["access_token"]
       # Store in memory (expires in 1 hour)
       return token
   ```

3. **LLM Service makes API calls with JWT:**
   ```python
   response = requests.get(
       f"{API_SERVICE_URL}/api/resumes/llm/jose-blanco-swe",
       headers={
           "Authorization": f"Bearer {jwt_token}"
       }
   )
   ```

4. **API Service validates JWT:**
   ```typescript
   // TypeScript (API Service)
   @UseGuards(JwtAuthGuard)  // Validates JWT
   @Get('llm/:slug')
   async getResumeForLLM(@Param('slug') slug: string) {
       // Only reached if JWT is valid
       return this.resumesService.getResumeWithContext(slug);
   }
   ```

5. **Background auto-refresh:**
   ```python
   # Refresh thread runs every 5 minutes
   # Auto-refreshes token if < 5 minutes until expiry
   def refresh_jwt_token():
       if time_until_expiry() < 300:  # 5 minutes
           jwt_token = authenticate()
   ```

**Password Generation:**
```bash
openssl rand -base64 32
# Output: 44-character base64 string
```

**Security Features:**
- ✅ Timing-safe password comparison
- ✅ Automatic token refresh (zero-downtime)
- ✅ 1-hour token expiry
- ✅ Thread-safe token management
- ✅ Tokens stored only in memory (never disk)
- ✅ Graceful degradation if auth fails

**Files Modified:**
- `apps/api-service/src/features/llm-service-api/llm-service-api.service.ts` - JWT validation
- `apps/llm-service/jwt_manager.py` - JWT authentication client (auto-refresh)

---

## Environment Variable Summary

### API Service (.env)

```bash
# Core Settings
DATABASE_URL="postgresql://user:password@localhost:5432/resume_db"
JWT_SECRET="your-jwt-signing-secret-32-chars-min"
PORT=3000
LLM_SERVICE_URL="http://localhost:5000"

# API → LLM Authentication (API Key)
LLM_API_KEY="sk_prod_abc123..."  # Generate: openssl rand -hex 32

# LLM → API Authentication (JWT)
LLM_SERVICE_USERNAME="llm-service"
LLM_SERVICE_PASSWORD="secure-password-here"  # Generate: openssl rand -base64 32
```

### LLM Service (.env)

```bash
# Core Settings
PORT=5000
LLAMA_SERVER_URL=http://localhost:11434
LLAMA_API_TYPE=ollama
LLAMA_MODEL=llama3.1:latest
API_SERVICE_URL=http://localhost:3000

# API → LLM Authentication (API Key)
LLM_API_KEYS='{
  "api-service": "sk_prod_abc123...",
  "admin": "sk_prod_def456..."
}'

# LLM → API Authentication (JWT)
LLM_SERVICE_USERNAME="llm-service"
LLM_SERVICE_PASSWORD="secure-password-here"  # MUST match API service
```

**Critical:** `LLM_API_KEY` (API service) must exist in `LLM_API_KEYS` JSON (LLM service)  
**Critical:** `LLM_SERVICE_PASSWORD` must be identical in both services

---

## Ansible Vault Configuration

For production deployments, all credentials are managed via Ansible Vault:

### Vault Variables (ansible/inventory-production.yml)

```yaml
vault_llm_api_key: !vault |
  $ANSIBLE_VAULT;1.1;AES256...

vault_llm_authorized_api_keys: !vault |
  $ANSIBLE_VAULT;1.1;AES256...
  # JSON: {"api-service": "key1", "admin": "key2"}

vault_llm_service_username: !vault |
  $ANSIBLE_VAULT;1.1;AES256...

vault_llm_service_password: !vault |
  $ANSIBLE_VAULT;1.1;AES256...
```

### Encrypt Secrets

```bash
# Generate credentials
API_KEY=$(openssl rand -hex 32)
JWT_PASSWORD=$(openssl rand -base64 32)

# Encrypt for Ansible Vault
ansible-vault encrypt_string "$API_KEY" --name 'vault_llm_api_key'
ansible-vault encrypt_string '{"api-service": "'$API_KEY'"}' --name 'vault_llm_authorized_api_keys'
ansible-vault encrypt_string 'llm-service' --name 'vault_llm_service_username'
ansible-vault encrypt_string "$JWT_PASSWORD" --name 'vault_llm_service_password'
```

### Deployment

```bash
ansible-playbook -i ansible/inventory-production.yml \
  ansible/playbooks/03-application-deploy.yml \
  --vault-password-file ~/.ansible/vault_password
```

See: [ANSIBLE_VAULT_API_KEYS_QUICKSTART.md](ANSIBLE_VAULT_API_KEYS_QUICKSTART.md)

---

## Testing Authentication

### 1. Test API Key Authentication (API → LLM)

```bash
# Without API key (should fail with 401)
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "test", "slug": "jose-blanco-swe"}'

# Expected: {"error": "Missing API key"}

# With valid API key (should work)
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sk_prod_abc123..." \
  -d '{"message": "What technologies does Jose know?", "slug": "jose-blanco-swe"}'

# Expected: {"response": "Jose has experience with..."}
```

### 2. Test JWT Authentication (LLM → API)

```bash
# 1. Get JWT token
TOKEN=$(curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "llm-service", "password": "your-password"}' \
  | jq -r '.access_token')

# 2. Use token to access protected endpoint
curl -X GET http://localhost:3000/api/resumes/llm/jose-blanco-swe \
  -H "Authorization: Bearer $TOKEN"

# Expected: Full resume JSON with hidden context
```

### 3. Test End-to-End Flow

```python
# Python test script
import requests

API_URL = "http://localhost:3000"
LLM_URL = "http://localhost:5000"

# 1. LLM authenticates with API
token_response = requests.post(f"{API_URL}/auth/login", json={
    "username": "llm-service",
    "password": "your-password"
})
jwt_token = token_response.json()["access_token"]

# 2. API calls LLM with API key
improve_response = requests.post(f"{LLM_URL}/api/improve-text", 
    headers={"X-API-Key": "sk_prod_abc123..."},
    json={"text": "This is a test"}
)

# 3. LLM calls API with JWT (loads resume data)
resume_response = requests.get(
    f"{API_URL}/api/resumes/llm/jose-blanco-swe",
    headers={"Authorization": f"Bearer {jwt_token}"}
)

print("✅ End-to-end authentication working!")
```

---

## Security Best Practices

### Key Rotation

**Rotate every:**
- Quarterly (routine)
- When team member leaves
- If credentials potentially exposed

**Process:**
1. Generate new keys: `openssl rand -hex 32`
2. Encrypt with Ansible Vault
3. Update inventory-production.yml
4. Deploy with `ansible-playbook`
5. Old keys automatically invalid

### Production Checklist

- [ ] Use strong random keys (32+ bytes)
- [ ] Store in Ansible Vault (never git)
- [ ] Different keys per environment (dev/staging/prod)
- [ ] Rotate keys quarterly
- [ ] Monitor failed auth attempts
- [ ] Use HTTPS in production
- [ ] Keep JWT_SECRET separate from passwords
- [ ] Backup vault password securely (1Password, etc.)

### Common Issues

**Issue:** LLM service returns 401 "Missing API key"  
**Fix:** Check `LLM_API_KEY` in API service .env matches a key in LLM's `LLM_API_KEYS` JSON

**Issue:** LLM service can't authenticate with API (JWT)  
**Fix:** Verify `LLM_SERVICE_PASSWORD` is identical in both .env files

**Issue:** JWT token expires during long operations  
**Fix:** Background refresh thread automatically handles this (check logs)

**Issue:** Ansible deploy fails with "vault_llm_api_key not defined"  
**Fix:** Run `ansible-vault encrypt_string` commands and update inventory

---

## Related Documentation

- [LLM_API_KEY_GUIDE.md](LLM_API_KEY_GUIDE.md) - Detailed API key implementation
- [JWT_AUTH_GUIDE.md](JWT_AUTH_GUIDE.md) - JWT authentication deep dive
- [ANSIBLE_VAULT_API_KEYS_QUICKSTART.md](ANSIBLE_VAULT_API_KEYS_QUICKSTART.md) - Vault setup
- [SECRETS_MANAGEMENT.md](SECRETS_MANAGEMENT.md) - General secrets management
- [ansible/README-DEPLOYMENT.md](ansible/README-DEPLOYMENT.md) - Deployment guide

---

## Migration Notes

### From No Authentication (Pre-2026)

1. Generate credentials
2. Update both .env files
3. Restart services
4. Test with curl commands above

### From Static Token Only

JWT authentication is backward compatible. Both work simultaneously:

```bash
# Old way (still works)
LLM_SERVICE_TOKEN="static-token"

# New way (recommended)
LLM_SERVICE_USERNAME="llm-service"
LLM_SERVICE_PASSWORD="secure-password"
```

Migrate by:
1. Add JWT credentials
2. Test JWT authentication
3. Remove `LLM_SERVICE_TOKEN`
4. Redeploy

---

**Last Verified:** March 13, 2026  
**Status:** ✅ Production Ready  
**Version:** 2.0 (Dual Authentication)
