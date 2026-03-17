# Chat Proxy Implementation

## Overview

The frontend chat widget now calls the API service as a proxy instead of calling the LLM service directly. This improves security by keeping the LLM_API_KEY server-side.

## Architecture

**Before:**
```
Frontend (ChatWidget) → LLM Service (https://llm-service.paskot.com/api/chat)
                        [Required: X-API-Key header in frontend - INSECURE]
```

**After:**
```
Frontend (ChatWidget) → API Service (/api/chat) → LLM Service (https://llm-service.paskot.com/api/chat)
[No auth needed]        [Adds X-API-Key header]  [Protected]
```

## Changes Made

### 1. API Service (Backend)

Created new `chat` feature module:

**Files:**
- `apps/api-service/src/features/chat/chat.module.ts` - Module definition
- `apps/api-service/src/features/chat/chat.controller.ts` - Proxy endpoint
- `apps/api-service/src/features/chat/chat.service.ts` - LLM service client
- `apps/api-service/src/features/chat/dto/chat.dto.ts` - Request/response DTOs

**Endpoint:**
```
POST /api/chat
{
  "message": "What is your experience with AWS?",
  "slug": "jose-blanco",
  "conversationId": "uuid" // optional
}

Response:
{
  "response": "I have extensive experience...",
  "conversationId": "uuid"
}
```

**Features:**
- Public endpoint (no authentication required)
- Proxies requests to LLM service
- Automatically adds `X-API-Key` header
- Comprehensive logging
- Error handling with proper HTTP status codes

### 2. Frontend

**Modified:**
- `apps/my-resume/src/features/chat/ChatWidget.tsx`

**Changes:**
```typescript
// Before
const API_URL = import.meta.env.PUBLIC_LLM_API_URL || '/llm';
fetch(`${API_URL}/api/chat`, ...)

// After
const API_URL = import.meta.env.PUBLIC_API_URL || '/api';
fetch(`${API_URL}/chat`, ...)
```

**Benefits:**
- Uses existing `PUBLIC_API_URL` environment variable
- No need for separate LLM service URL in frontend
- No API key needed in frontend configuration
- Consistent with other API calls

## Configuration

### Environment Variables

**API Service** (`.env` or Cloud Run):
```bash
LLM_SERVICE_URL=https://llm-service.paskot.com
LLM_API_KEY=your-api-key-here
```

**Frontend** (already configured):
```bash
PUBLIC_API_URL=https://api.resumecast.ai
```

No changes needed to existing production environment variables!

## Testing

### Local Development

1. **Start services:**
   ```bash
   # Terminal 1: API Service
   cd apps/api-service
   npm run start:dev
   
   # Terminal 2: LLM Service
   cd apps/llm-service
   USE_POETRY=true ./run.sh
   
   # Terminal 3: Frontend
   cd apps/my-resume
   yarn dev
   ```

2. **Test chat:**
   - Open http://localhost:3000
   - Open chat widget
   - Send a message
   - Check API service logs for:
     ```
     [chat] Request received - slug: jose-blanco
     [chat] Calling LLM endpoint: https://llm-service.paskot.com/api/chat
     [chat] Successfully received response from LLM service (1234ms)
     ```

### Production Testing

```bash
# Test API proxy endpoint
curl -X POST https://api.resumecast.ai/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is your experience with AWS?",
    "slug": "jose-blanco"
  }'

# Expected response
{
  "response": "I have extensive experience with AWS...",
  "conversationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Monitor Production Logs

```bash
# Watch API service logs
gcloud logging tail \
  "resource.labels.service_name=api-service" \
  --project=resume-cast-ai-prod \
  --format=json | \
  jq -r '.textPayload // .jsonPayload.msg // empty' | \
  grep -iE "chat"
```

## Security Benefits

1. **API Key Protection**: LLM_API_KEY never exposed to frontend
2. **Centralized Auth**: Single point for LLM service authentication
3. **Rate Limiting**: Can add rate limiting at API gateway level
4. **Monitoring**: All LLM calls logged through API service
5. **Future Flexibility**: Can add caching, transformation, or switch LLM providers without frontend changes

## Deployment

### Changes Required

**API Service:**
```bash
cd apps/api-service
npm run build
# Deploy api-service with new chat module
```

**Frontend:**
```bash
cd apps/my-resume
yarn build
# Deploy frontend with updated chat widget
```

**No Infrastructure Changes:**
- No new environment variables needed
- No new services to deploy
- Uses existing LLM_API_KEY and LLM_SERVICE_URL

### Deployment Commands

**Full deployment:**
```bash
# From project root
cd /Users/joseblanco/data/dev/my-resume
gcloud builds submit --config=cloudbuild-api.yaml --timeout=20m
gcloud run deploy api-service \
  --image us-central1-docker.pkg.dev/resume-cast-ai-prod/resumecast-images/api-service:latest \
  --platform managed \
  --region us-central1
```

## Rollback Plan

If issues occur, rollback is simple:

1. **Revert frontend:**
   ```bash
   git revert <commit-hash>
   cd apps/my-resume
   yarn build && deploy
   ```

2. **API service:** Old chat endpoints don't exist, so API service can stay as-is

The change is backward compatible - if frontend still had old code, it would still work with LLM service directly.

## Future Enhancements

1. **Caching**: Add Redis caching for common questions
2. **Rate Limiting**: Request throttling per user/IP
3. **Analytics**: Track chat usage patterns
4. **A/B Testing**: Compare different LLM models
5. **Streaming**: SSE support for real-time responses
6. **Authentication**: Require user login for personalized context

## Maintenance

- Monitor API service logs for proxy errors
- Track latency between API service and LLM service
- Update LLM_API_KEY rotation in API service environment only
- Consider caching frequently asked questions

## Related Files

- API Service: `apps/api-service/src/features/chat/`
- Frontend: `apps/my-resume/src/features/chat/ChatWidget.tsx`
- Terraform: `infra/gcp/main.tf` (LLM_API_KEY environment variable)
- Documentation: This file

## Questions?

Contact the team or check:
- `.github/copilot-instructions.md` - Architecture overview
- `apps/api-service/README.md` - API service documentation
- `apps/llm-service/OPERATIONS.md` - LLM service operations
