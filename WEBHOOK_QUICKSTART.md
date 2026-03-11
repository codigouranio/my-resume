# Webhook Architecture - Quick Reference

## What Was Implemented

✅ **API Service (Complete)**
- Webhook endpoint: `POST /api/webhooks/llm-result`
- HMAC-SHA256 signature verification
- Company enrichment handler (saves to DB, links interviews, sends email)
- Position scoring handler (updates fitScore and analysis)
- Feature flag: `USE_LLM_WEBHOOKS` (true/false)
- Backward compatible with sync mode

## Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| Webhook endpoint | ✅ Complete | [webhooks.controller.ts](apps/api-service/src/features/companies/webhooks.controller.ts) |
| Async enrichment | ✅ Complete | enrichCompanyAsync() method |
| Worker webhook support | ✅ Complete | Both workers support callbacks |
| Feature flag | ✅ Complete | USE_LLM_WEBHOOKS env var |
| Type safety | ✅ Complete | All interfaces updated |
| Security | ✅ Complete | HMAC signatures |
| LLM service webhook | ⏳ Pending | Needs Python implementation |

## Quick Start

### 1. Configure Environment

```bash
# Run setup script
./setup-webhooks.sh
```

This generates a webhook secret and configures both services.

### 2. Test Webhook Endpoint

```bash
# Start API service
cd apps/api-service
npm run start:dev

# In another terminal, test webhook
cd ../..
./test-webhook.sh
```

Expected output:
```
✅ SUCCESS
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

### 3. Implement LLM Service Webhooks

See [LLM_WEBHOOK_IMPLEMENTATION.md](LLM_WEBHOOK_IMPLEMENTATION.md) for detailed Python implementation guide.

## Architecture Overview

### Sync Mode (Old - Deprecated)
```
API Worker → HTTP POST (blocks 30s-3min) → LLM → Response → Worker
```

### Webhook Mode (New - Recommended)
```
API Worker → HTTP POST + callbackUrl → LLM (returns immediately)
   ↓
Job complete ✅

Later... LLM → HTTP POST callback → API Webhook → Process & Save
```

## Environment Variables

### API Service (.env)

```bash
# Feature flag
USE_LLM_WEBHOOKS=true         # Use webhook mode (recommended)
# USE_LLM_WEBHOOKS=false      # Use sync mode (deprecated)

# Webhook configuration
API_BASE_URL=http://localhost:3000              # Local development
# API_BASE_URL=https://api.yourdomain.com      # Production
LLM_WEBHOOK_SECRET=<generated-by-setup-script>  # Shared secret

# LLM service endpoint
LLM_SERVICE_URL=http://localhost:5000
```

### LLM Service (.env)

```bash
# Webhook secret (must match API service)
LLM_WEBHOOK_SECRET=<same-as-api-service>
```

## Files Modified

### New Files
- [webhooks.controller.ts](apps/api-service/src/features/companies/webhooks.controller.ts) - Webhook endpoint
- [LLM_WEBHOOK_IMPLEMENTATION.md](LLM_WEBHOOK_IMPLEMENTATION.md) - Implementation guide
- [setup-webhooks.sh](setup-webhooks.sh) - Configuration script
- [test-webhook.sh](test-webhook.sh) - Testing script

### Modified Files
- [companies.service.ts](apps/api-service/src/features/companies/companies.service.ts)
  - Added `enrichCompanyAsync()` method
  - Marked `fetchFromLLMService()` as deprecated
  
- [companies.worker.ts](apps/api-service/src/features/companies/companies.worker.ts)
  - Added webhook mode support with feature flag
  - Backward compatible with sync mode
  
- [position-scoring.worker.ts](apps/api-service/src/features/companies/position-scoring.worker.ts)
  - Added webhook mode support
  - Conditional callbackUrl inclusion
  
- [position-scoring.queue.ts](apps/api-service/src/features/companies/position-scoring.queue.ts)
  - Extended `PositionScoringResult` interface
  - Added `message` and `llmJobId` fields
  
- [companies.module.ts](apps/api-service/src/features/companies/companies.module.ts)
  - Registered `WebhooksController`

## Webhook Payload Examples

### Company Enrichment Success

```json
{
  "jobId": "job_123",
  "type": "company",
  "status": "completed",
  "data": {
    "companyName": "Google LLC",
    "description": "Technology company...",
    "industry": "Technology",
    "founded": "1998",
    "headquarters": "Mountain View, CA",
    "employeeCount": 150000,
    "revenue": "$280B",
    "logoUrl": "https://logo.clearbit.com/google.com",
    "glassdoorRating": 4.5
  },
  "metadata": {
    "userId": "user_123",
    "jobId": "job_abc",
    "companyName": "google"
  }
}
```

### Position Scoring Success

```json
{
  "jobId": "job_456",
  "type": "position",
  "status": "completed",
  "data": {
    "fitScore": 8.5,
    "analysis": {
      "strengths": ["Strong Python", "Leadership"],
      "gaps": ["Limited cloud experience"],
      "recommendations": ["Highlight AWS projects"],
      "summary": "Excellent fit..."
    }
  },
  "metadata": {
    "userId": "user_123",
    "interviewId": "interview_789",
    "jobId": "job_456"
  }
}
```

### Failure

```json
{
  "jobId": "job_789",
  "type": "company",
  "status": "failed",
  "error": "Rate limit exceeded",
  "metadata": {
    "userId": "user_123",
    "companyName": "google"
  }
}
```

## Security

### HMAC Signature

**Generate (LLM Service - Python):**
```python
import hmac
import hashlib
import json

payload_json = json.dumps(payload, sort_keys=True)
signature = hmac.new(
    os.environ['LLM_WEBHOOK_SECRET'].encode(),
    payload_json.encode(),
    hashlib.sha256
).hexdigest()
```

**Verify (API Service - TypeScript):**
```typescript
const expectedSignature = crypto
  .createHmac('sha256', webhookSecret)
  .update(payloadString)
  .digest('hex');

// Timing-safe comparison prevents timing attacks
crypto.timingSafeEqual(
  Buffer.from(signature),
  Buffer.from(expectedSignature)
);
```

## Troubleshooting

### Webhook Returns 401 Unauthorized

**Cause:** Invalid signature

**Solutions:**
1. Verify same secret in both `.env` files
2. Check JSON payload formatting (no extra spaces)
3. Ensure encoding is UTF-8
4. Use `sort_keys=True` in Python's `json.dumps()`

### Webhook Not Received

**Check:**
1. API service is running: `curl http://localhost:3000/health`
2. Network connectivity from LLM service
3. Correct callback URL in request
4. LLM service logs for delivery errors

### Data Not Saved

**Check:**
1. API service logs: `tail -f logs/api-service.log | grep webhook`
2. Database connection working
3. Data format matches expected schema
4. Check for validation errors in logs

## Testing Checklist

- [ ] Environment configured (`./setup-webhooks.sh`)
- [ ] API service running (`npm run start:dev`)
- [ ] Webhook endpoint responds (`./test-webhook.sh`)
- [ ] Company enrichment webhook works
- [ ] Position scoring webhook works
- [ ] Invalid signature returns 401
- [ ] Data saved to CompanyInfo table
- [ ] Interviews linked and normalized
- [ ] Email notifications sent

## Next Steps

1. **Implement LLM Service Webhooks** (Python)
   - See [LLM_WEBHOOK_IMPLEMENTATION.md](LLM_WEBHOOK_IMPLEMENTATION.md)
   - Accept `callbackUrl` in requests
   - Call webhook when research completes
   - Sign with HMAC-SHA256
   - Implement retry logic

2. **Test End-to-End Flow**
   ```bash
   # Trigger enrichment
   curl -X POST http://localhost:3000/api/companies/enrich/queue \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"companyName": "google"}'
   
   # Watch logs
   tail -f apps/api-service/logs/application.log | grep -E "webhook|enrichment"
   ```

3. **Monitor Webhook Deliveries**
   - Track success rate
   - Monitor delivery times
   - Alert on failures

4. **Documentation for SaaS Customers**
   - API key management
   - Rate limits
   - Webhook retry policy
   - Signature verification examples

## Benefits

✅ **No Timeouts** - Research takes as long as needed
✅ **Service Independence** - No shared infrastructure
✅ **SaaS Ready** - Multi-tenant architecture
✅ **Standard Pattern** - Like Stripe, Twilio, SendGrid
✅ **Scalable** - Each service scales independently
✅ **Secure** - HMAC signatures prevent spoofing
✅ **Backward Compatible** - Sync mode still works

## Support

- **Implementation Guide:** [LLM_WEBHOOK_IMPLEMENTATION.md](LLM_WEBHOOK_IMPLEMENTATION.md)
- **Architecture Docs:** [.github/copilot-instructions.md](.github/copilot-instructions.md)
- **API Docs:** [apps/api-service/README.md](apps/api-service/README.md)
- **Test Webhook:** `./test-webhook.sh`
