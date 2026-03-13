# Enrichment Cleanup Service

## Purpose
Automatically resets stuck company enrichment processes that have been in `PROCESSING` status for too long.

## How It Works

### Problem
When the LLM service fails or crashes before completing an enrichment:
1. Database status set to `PROCESSING`
2. LLM service never calls the webhook callback
3. Status **stuck forever** in `PROCESSING`
4. User sees "⏳ Processing..." indefinitely

### Solution
Background service that runs every 5 minutes:
1. Finds companies with `enrichmentStatus = 'PROCESSING'`
2. Checks if `updatedAt` is older than 5 minutes
3. Resets status to `PENDING` (will retry when queue picks it up)

## Configuration

```typescript
// Threshold: Consider stuck after 5 minutes
private readonly STUCK_THRESHOLD_MS = 5 * 60 * 1000;

// Interval: Run cleanup every 5 minutes  
private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
```

## Deployment

### 1. Add to Module
Already added to [companies.module.ts](./companies.module.ts):
```typescript
providers: [
  // ...
  EnrichmentCleanupService, // Auto-starts on module init
]
```

### 2. Service Auto-Starts
- Runs first cleanup immediately on startup
- Then runs every 5 minutes automatically
- No additional configuration needed

### 3. Monitoring Logs

**Normal operation (no stuck processes):**
```
[EnrichmentCleanupService] Enrichment cleanup service initialized
[EnrichmentCleanupService] No stuck enrichment processes found
```

**When finding stuck processes:**
```
[EnrichmentCleanupService] Found 2 stuck enrichment process(es), resetting to PENDING
[EnrichmentCleanupService] Reset 2 stuck enrichment process(es) to PENDING. Companies: Google, Amazon
[EnrichmentCleanupService]   - Google (stuck for 12 minutes)
[EnrichmentCleanupService]   - Amazon (stuck for 8 minutes)
```

## Manual Trigger (Optional)

Add admin endpoint to manually trigger cleanup:

```typescript
// In companies.controller.ts
@Post('enrichment/cleanup')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
async triggerCleanup() {
  const pendingCount = await this.enrichmentCleanupService.triggerManualCleanup();
  return {
    success: true,
    message: 'Cleanup triggered',
    pendingCount,
  };
}
```

## Testing

### 1. Create a Stuck Process
```sql
-- Manually set a company to PROCESSING with old timestamp
UPDATE "CompanyInfo" 
SET "enrichmentStatus" = 'PROCESSING',
    "updatedAt" = NOW() - INTERVAL '10 minutes'
WHERE "companyName" = 'TestCompany';
```

### 2. Wait 5 Minutes or Restart API Service  
Service will detect and reset it automatically.

### 3. Check Logs
```bash
ssh prod-host "pm2 logs api-service --lines 50 | grep -i cleanup"
```

## Benefits

✅ **Automatic Recovery**: No manual intervention needed  
✅ **Self-Healing**: System recovers from LLM service failures  
✅ **No User Impact**: Retries happen transparently  
✅ **Observable**: Clear logs show when cleanup occurs  
✅ **Configurable**: Easy to adjust thresholds

## Alternative Approaches Considered

### ❌ Database Triggers
- More complex to maintain
- Harder to debug
- Requires database migrations

### ❌ Cron Job Outside App
- External dependency
- No access to application context
- Harder to test

### ✅ In-App Background Service (Current)
- Simple, maintainable
- Part of application lifecycle
- Easy to test and monitor
- Leverages existing Prisma service

## Future Enhancements

1. **Metrics**: Track cleanup frequency with Prometheus
2. **Alerting**: Send alerts if too many stuck processes
3. **Configurable**: Move thresholds to environment variables
4. **Retry Backoff**: Increase threshold exponentially for repeated failures
