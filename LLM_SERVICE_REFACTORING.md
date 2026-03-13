# LLM Service - Removing PostgreSQL Dependency

## Changes Made

### 1. Created API Client Module (`api_client.py`)

New module that handles all API communication with the API service. Functions:
- `load_resume_from_api(slug)` - Get resume content + llmContext
- `get_user_info_from_api(slug)` - Get user info by resume slug
- `log_chat_interaction_to_api(...)` - Log chat analytics
- `load_conversation_history_from_api(slug, session_id)` - Get chat history

### 2. Backend API Endpoints Created

Created `/apps/api-service/src/features/llm-service-api/` module with:

**Controller** (`llm-service-api.controller.ts`):
- `GET /api/llm-service/resume/:slug` - Get resume with fullContext
- `GET /api/llm-service/resume/:slug/user` - Get user info
- `POST /api/llm-service/chat/log` - Log chat interaction
- `GET /api/llm-service/resume/:slug/history/:sessionId` - Get conversation history

All endpoints require `X-LLM-Service-Token` header for authentication.

**Service** (`llm-service-api.service.ts`):
- Handles database operations via Prisma
- Returns data in format expected by LLM service

**DTO** (`dto/log-chat-interaction.dto.ts`):
- Validates chat interaction data
- Includes ChatSentiment enum

### 3. Changes Needed in `app_remote.py`

**Remove:**
```python
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.getenv("DATABASE_URL", "...")

def get_db_connection():
    return psycopg2.connect(DATABASE_URL)
```

**Add:**
```python
from api_client import (
    load_resume_from_api,
    get_user_info_from_api,
    log_chat_interaction_to_api,
    load_conversation_history_from_api,
)

API_SERVICE_URL = os.getenv("API_SERVICE_URL", "http://localhost:3000")
LLM_SERVICE_TOKEN = os.getenv("LLM_SERVICE_TOKEN", "")
```

**Replace functions:**
1. `load_resume_from_db(slug)` → calls `load_resume_from_api(slug)`
2. `get_user_info(slug)` → calls `get_user_info_from_api(slug)`  
3. `log_chat_interaction(...)` → calls `log_chat_interaction_to_api(...)`
4. `load_conversation_history(session_id, resume_id, limit)` → calls `load_conversation_history_from_api(slug, session_id, limit)`

**Note:** `load_conversation_history` signature changes from `resume_id` to `resume_slug` parameter.

### 4. Changes Needed in `tasks.py` (Celery)

Similar changes:
- Import `api_client` functions
- Remove `psycopg2` imports
- Remove `get_db_connection()`
- Replace database queries with API calls

### 5. Environment Variables

**API Service** (`.env`):
```bash
# New variable for LLM service auth
LLM_SERVICE_TOKEN="your-secure-random-token-here"
```

**LLM Service** (`.env`):
```bash
# Replace DATABASE_URL with:
API_SERVICE_URL="http://localhost:3000"  # or Cloud Run URL
LLM_SERVICE_TOKEN="same-token-as-api-service"

# Keep these:
LLAMA_SERVER_URL="http://localhost:11434"
LLAMA_MODEL="llama3.1"
LLM_WEBHOOK_SECRET="your-webhook-secret"
```

### 6. Dependencies

**Remove from `requirements.txt`:**
```
psycopg2-binary
```

**Keep:**
```
requests  # Already present, used for API calls
```

### 7. Deployment Architecture

**Before (Monolithic):**
```
┌─────────────────┐
│  All Services   │
│  (Same Server)  │
│  - Frontend     │
│  - API          │
│  - LLM          │
│  - PostgreSQL   │
└─────────────────┘
```

**After (Distributed):**
```
┌─────────────────────────────┐
│  Google Cloud Run           │
│  ┌────────────┐             │
│  │  Frontend  │             │
│  └────────────┘             │
│  ┌────────────┐             │
│  │ API Service│◄──┐         │
│  │ (NestJS)   │   │         │
│  └────────────┘   │         │
│  ┌────────────┐   │         │
│  │ PostgreSQL │   │         │
│  │ (Cloud SQL)│   │         │
│  └────────────┘   │         │
└────────────────────┼─────────┘
                     │
                     │ HTTPS
                     │ (Cloudflare Tunnel)
                     │
┌────────────────────┼─────────┐
│  Home Server       │         │
│  ┌────────────┐   │         │
│  │ LLM Service├───┘         │
│  │ (Flask)    │             │
│  └────────────┘             │
│  ┌────────────┐             │
│  │  Ollama    │             │
│  │  (GPU)     │             │
│  └────────────┘             │
└─────────────────────────────┘
```

### 8. Security Considerations

1. **Token Authentication:** All API calls require `X-LLM-Service-Token` header
2. **HTTPS Only:** Cloudflare tunnel provides TLS encryption
3. **No Public DB:** PostgreSQL never exposed to internet
4. **Rate Limiting:** Applied at API service level
5. **IP Whitelisting:** Optional - can restrict API endpoints to CF tunnel IPs

### 9. Testing

**Test API endpoints:**
```bash
# Set token
export LLM_TOKEN="your-token-here"

# Test resume loading
curl -H "X-LLM-Service-Token: $LLM_TOKEN" \
  http://localhost:3000/api/llm-service/resume/john-doe

# Test user info
curl -H "X-LLM-Service-Token: $LLM_TOKEN" \
  http://localhost:3000/api/llm-service/resume/john-doe/user

# Test chat logging
curl -X POST \
  -H "X-LLM-Service-Token: $LLM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resumeSlug": "john-doe",
    "question": "What skills?",
    "answer": "Python, TypeScript",
    "responseTime": 850,
    "sentiment": "POSITIVE"
  }' \
  http://localhost:3000/api/llm-service/chat/log
```

### 10. Migration Steps

1. ✅ Create `api-client.py` in LLM service
2. ✅ Create LLM service API module in API service
3. ⏳ Update `app_remote.py` to use API calls
4. ⏳ Update `tasks.py` to use API calls  
5. ⏳ Remove `psycopg2` from requirements
6. ⏳ Update environment variables
7. ⏳ Test locally
8. ⏳ Deploy to Cloud Run + home server
9. ⏳ Configure Cloudflare tunnel
10. ⏳ Update documentation

## Next Steps

To complete the refactoring, I need to:
1. **Finish updating app_remote.py** - Replace all DB function calls
2. **Update tasks.py** - Same changes for Celery worker
3. **Remove psycopg2 dependency** - Update requirements.txt
4. **Test the changes** - Ensure chat, logging, history all work
5. **Update deployment docs** - Document new architecture

**Should I proceed with completing these changes?**
