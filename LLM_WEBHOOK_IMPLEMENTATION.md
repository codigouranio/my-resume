# LLM Service Webhook Implementation Guide

## Overview

The API service now supports **async webhook mode** for completely decoupled communication with the LLM service. The LLM service calls back when research completes instead of blocking HTTP requests.

## Architecture

```
API Service                    LLM Service (SaaS)
   │                                 │
   │ 1. POST /api/companies/enrich  │
   │    {companyName, callbackUrl}  │
   ├────────────────────────────────>│
   │                                 │
   │ 2. Response: {jobId: "123"}    │
   │<────────────────────────────────┤
   │                                 │
   │ Job complete immediately ✅     │ Research in progress...
   │                                 │ (10-30 seconds, no time limit)
   │                                 │
   │ 3. POST callbackUrl             │
   │    {type, data, signature}      │
   │<────────────────────────────────┤
   │                                 │
   │ 4. Process & save to DB         │
   │                                 │
```

## API Service Configuration

### Environment Variables

```bash
# .env
USE_LLM_WEBHOOKS=true           # Enable webhook mode (default: true)
API_BASE_URL=http://localhost:3000  # For local development
# API_BASE_URL=https://yourdomain.com  # For production

LLM_SERVICE_URL=http://localhost:5000  # Your LLM service URL
LLM_WEBHOOK_SECRET=your-secret-key-here  # Shared secret for HMAC signatures
```

### Feature Toggle

The API service supports both modes via feature flag:

- **`USE_LLM_WEBHOOKS=true`** (recommended): Async webhook mode, no timeouts
- **`USE_LLM_WEBHOOKS=false`**: Old synchronous mode (deprecated)

## LLM Service Implementation

### Required Changes

The LLM service needs to:
1. Accept `callbackUrl` in requests
2. Call the webhook when research completes
3. Sign requests with HMAC-SHA256

### Input Contract

**Company Enrichment Endpoint:**
```python
# POST /api/companies/enrich

{
  "companyName": "google",
  "callbackUrl": "http://api-service:3000/api/webhooks/llm-result",  # NEW
  "metadata": {                                                       # NEW
    "userId": "user_123",
    "jobId": "job_abc",
    "companyName": "google"
  }
}
```

**Position Scoring Endpoint:**
```python
# POST /api/positions/score

{
  "company": "Google",
  "position": "Software Engineer",
  "resume": {...},
  "journalEntries": [...],
  "callbackUrl": "http://api-service:3000/api/webhooks/llm-result",  # NEW
  "metadata": {                                                       # NEW
    "userId": "user_123",
    "interviewId": "interview_456",
    "jobId": "job_xyz"
  }
}
```

### Response Contract

**Immediate Response (Async Mode):**
```json
{
  "jobId": "llm_job_789",
  "status": "processing",
  "estimatedTime": "30s"
}
```

**Old Sync Response (Deprecated):**
Returns full data immediately (still supported if no callbackUrl provided).

### Webhook Callback Implementation

#### Python Example (Flask)

```python
import hmac
import hashlib
import requests
import json
from typing import Dict, Any

# Configuration
WEBHOOK_SECRET = os.getenv('LLM_WEBHOOK_SECRET', 'change-me-in-production')

def call_webhook(callback_url: str, payload: Dict[str, Any]):
    """
    Call the API service webhook with research results
    """
    # Serialize payload
    payload_json = json.dumps(payload, sort_keys=True)
    
    # Generate HMAC signature
    signature = hmac.new(
        WEBHOOK_SECRET.encode('utf-8'),
        payload_json.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    # Send webhook
    headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Job-Id': payload.get('jobId', ''),
    }
    
    try:
        response = requests.post(
            callback_url,
            json=payload,
            headers=headers,
            timeout=10  # 10 second timeout for webhook
        )
        
        if response.status_code == 200:
            print(f"Webhook delivered successfully for job {payload['jobId']}")
        else:
            print(f"Webhook failed: {response.status_code} - {response.text}")
            # Implement retry logic here
            
    except requests.exceptions.RequestException as e:
        print(f"Webhook delivery failed: {e}")
        # Implement retry logic here


def enrich_company_webhook(company_name: str, callback_url: str, metadata: dict):
    """
    Company enrichment with webhook callback
    """
    job_id = f"job_{generate_id()}"
    
    # Return immediately
    response = {
        "jobId": job_id,
        "status": "processing",
        "estimatedTime": "30s"
    }
    
    # Process in background (use thread, celery, or async)
    def background_task():
        try:
            # Do the research (can take as long as needed!)
            result = research_company(company_name)
            
            # Prepare webhook payload
            payload = {
                "jobId": metadata.get('jobId', job_id),
                "type": "company",
                "status": "completed",
                "data": result,  # Full company data
                "metadata": metadata
            }
            
            # Call webhook
            call_webhook(callback_url, payload)
            
        except Exception as e:
            # Send failure webhook
            error_payload = {
                "jobId": metadata.get('jobId', job_id),
                "type": "company",
                "status": "failed",
                "error": str(e),
                "metadata": metadata
            }
            call_webhook(callback_url, error_payload)
    
    # Start background task
    threading.Thread(target=background_task).start()
    
    return response
```

#### Webhook Payload Format

**Success - Company Enrichment:**
```json
{
  "jobId": "job_abc",
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
    "glassdoorRating": 4.5,
    ...
  },
  "metadata": {
    "userId": "user_123",
    "jobId": "job_abc",
    "companyName": "google"
  }
}
```

**Success - Position Scoring:**
```json
{
  "jobId": "job_xyz",
  "type": "position",
  "status": "completed",
  "data": {
    "fitScore": 8.5,
    "analysis": {
      "strengths": [
        "Strong Python experience",
        "Leadership in similar roles"
      ],
      "gaps": [
        "Limited cloud infrastructure experience"
      ],
      "recommendations": [
        "Highlight AWS projects in interview"
      ],
      "summary": "Excellent fit overall..."
    }
  },
  "metadata": {
    "userId": "user_123",
    "interviewId": "interview_456",
    "jobId": "job_xyz"
  }
}
```

**Failure:**
```json
{
  "jobId": "job_abc",
  "type": "company",
  "status": "failed",
  "error": "Rate limit exceeded from search API",
  "metadata": {
    "userId": "user_123",
    "companyName": "google"
  }
}
```

### Webhook Retry Logic

If webhook delivery fails, implement exponential backoff:

```python
def retry_webhook(callback_url: str, payload: dict, max_retries: int = 3):
    """
    Retry webhook delivery with exponential backoff
    """
    for attempt in range(max_retries):
        try:
            call_webhook(callback_url, payload)
            return True  # Success
        except Exception as e:
            if attempt < max_retries - 1:
                sleep_time = 2 ** attempt  # 1s, 2s, 4s
                print(f"Webhook failed, retrying in {sleep_time}s...")
                time.sleep(sleep_time)
            else:
                print(f"Webhook failed after {max_retries} attempts")
                # Log to database or error tracking service
                return False
```

## Security

### HMAC Signature Verification

**LLM Service (Signs):**
```python
payload_json = json.dumps(payload, sort_keys=True)
signature = hmac.new(
    WEBHOOK_SECRET.encode('utf-8'),
    payload_json.encode('utf-8'),
    hashlib.sha256
).hexdigest()
```

**API Service (Verifies):**
```typescript
const payloadString = JSON.stringify(payload);
const expectedSignature = crypto
  .createHmac('sha256', webhookSecret)
  .update(payloadString)
  .digest('hex');

// Timing-safe comparison
return crypto.timingSafeEqual(
  Buffer.from(signature),
  Buffer.from(expectedSignature),
);
```

### Best Practices

1. **Always verify signatures** - Prevents spoofed webhooks
2. **Use HTTPS in production** - Encrypt webhook payloads
3. **Rotate secrets periodically** - Update `LLM_WEBHOOK_SECRET`
4. **Log all webhooks** - For debugging and audit trails
5. **Implement retry logic** - Handle temporary failures
6. **Set reasonable timeouts** - Don't block on webhook delivery

## Testing

### Manual Testing

**1. Test webhook endpoint directly:**
```bash
# Generate signature
PAYLOAD='{"jobId":"test","type":"company","status":"completed","data":{"companyName":"Test Inc"}}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "your-secret-key" | cut -d' ' -f2)

# Call webhook
curl -X POST http://localhost:3000/api/webhooks/llm-result \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -H "X-Job-Id: test" \
  -d "$PAYLOAD"
```

**2. Test end-to-end flow:**
```bash
# Trigger enrichment
curl -X POST http://localhost:3000/api/companies/enrich/queue \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"companyName": "google"}'

# Check logs for webhook received
# Verify database updated
# Verify email sent
```

### Integration Tests

```python
# test_webhooks.py
def test_company_enrichment_webhook():
    # Mock API service webhook endpoint
    webhook_calls = []
    
    @app.route('/test-webhook', methods=['POST'])
    def test_webhook():
        webhook_calls.append(request.json)
        return {'success': True}
    
    # Call enrichment with test callback
    response = client.post('/api/companies/enrich', json={
        'companyName': 'Test Company',
        'callbackUrl': 'http://localhost:5000/test-webhook',
        'metadata': {'userId': 'test_user'}
    })
    
    assert response.json['status'] == 'processing'
    
    # Wait for webhook
    time.sleep(35)  # Allow time for research
    
    assert len(webhook_calls) == 1
    assert webhook_calls[0]['type'] == 'company'
    assert webhook_calls[0]['status'] == 'completed'
```

## Monitoring

### LLM Service Metrics

Track:
- Webhook delivery success rate
- Average delivery time
- Retry attempts
- Failed webhooks needing manual intervention

```python
# Example metrics
webhook_delivered_total = Counter('webhook_delivered_total', 'Total webhooks delivered')
webhook_failed_total = Counter('webhook_failed_total', 'Total webhooks failed')
webhook_duration_seconds = Histogram('webhook_duration_seconds', 'Webhook delivery time')
```

### API Service Logs

Look for:
```
[WebhooksController] Received webhook for job xyz (company): completed
[WebhooksController] Saved company info: Google LLC
[WebhooksController] Auto-linked 3 interview(s) to Google LLC
[WebhooksController] Email sent to user@example.com
```

## Migration from Sync to Webhook Mode

### Step 1: Deploy with Feature Flag Off
```bash
USE_LLM_WEBHOOKS=false  # Old behavior
```

### Step 2: Test Webhooks in Parallel
- Verify webhook endpoint works
- Test with sample jobs
- Monitor for errors

### Step 3: Enable for Percentage of Traffic
```bash
USE_LLM_WEBHOOKS=true  # New behavior
```

### Step 4: Monitor and Rollback if Needed
- Watch error rates
- Check webhook delivery success
- Verify emails still sent

### Step 5: Full Migration
- Remove old sync code paths
- Update documentation
- Celebrate! 🎉

## Troubleshooting

### Webhook Not Received

**Check:**
1. Is LLM service calling the correct URL?
2. Is signature being generated correctly?
3. Are there network/firewall issues?
4. Check API service logs for rejected webhooks

### Invalid Signature Error

**Check:**
1. Same secret on both sides (`LLM_WEBHOOK_SECRET`)
2. Payload serialization matches (key order, spacing)
3. Encoding is UTF-8 on both sides

### Data Not Saved

**Check:**
1. Webhook received but handler failed
2. Check API service logs for errors
3. Verify database connection
4. Check data format matches expected schema

## SaaS Considerations

### Multi-Tenancy

Track customers by API key:
```python
@app.route('/api/companies/enrich')
@require_api_key
def enrich_company():
    api_key = request.headers.get('Authorization')
    customer_id = get_customer_from_key(api_key)
    
    # Track usage per customer
    track_usage(customer_id, 'company_enrichment')
    
    # Process with webhook
    # ...
```

### Rate Limiting

```python
from flask_limiter import Limiter

limiter = Limiter(
    app,
    key_func=lambda: request.headers.get('Authorization'),  # By API key
    default_limits=["100 per hour"]  # Per customer
)

@app.route('/api/companies/enrich')
@limiter.limit("10 per minute")  # Burst limit
def enrich_company():
    # ...
```

### Billing

Track webhook deliveries for usage-based billing:
```python
def call_webhook(callback_url, payload):
    # ... deliver webhook ...
    
    # Record billable event
    record_usage(
        customer_id=payload['customerId'],
        event_type=payload['type'],
        timestamp=datetime.now(),
        status='completed'
    )
```

## Summary

**✅ Benefits:**
- No timeouts - research takes as long as needed
- Services completely independent
- SaaS-ready architecture
- Standard webhook pattern (like Stripe, Twilio)
- Scales to unlimited customers

**✅ API Service:**
- Webhook endpoint at `/api/webhooks/llm-result`
- HMAC signature verification
- Feature flag for gradual rollout

**✅ LLM Service:**
- Accept `callbackUrl` in requests
- Return immediately with job ID
- Call webhook when complete
- Sign with HMAC-SHA256
- Implement retry logic

Ready to serve your LLM capabilities as a SaaS product! 🚀
