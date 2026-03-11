# Company Name Normalization Feature

## Overview

The interview tracker now automatically normalizes company names to use official enriched company names. This ensures consistency across all interviews and prevents issues with name variations.

## How It Works

### Automatic Normalization Flow

```
User Input → System Check → Normalization → Storage
   ↓              ↓             ↓              ↓
"google"    → Find enriched → "Google LLC" → Saved
"GOOGLE"      company info     (official)      with
"Google Inc"  (case-insens.)                  link
```

### When Normalization Happens

1. **On Interview Create:**
   - System searches for matching enriched company data (case-insensitive)
   - If found, uses the official company name instead of user input
   - Automatically links interview to company info

2. **On Interview Update:**
   - If company name changes, checks for enriched data
   - Normalizes to official name if match found
   - Re-links to correct company info

3. **On Enrichment Complete:**
   - Worker automatically links interviews with matching company names
   - Normalizes all linked interview names to official name

4. **On Manual Re-link:**
   - Admin can trigger re-linking of all interviews
   - Normalizes all linked interview names

## Benefits

✅ **Consistency:** All interviews for "Google" use the same official name
✅ **No duplicates:** Prevents separate company info records for "google", "Google", "Google Inc"
✅ **Better grouping:** All interviews for the same company appear together
✅ **Accurate analytics:** Company statistics are accurate
✅ **User-friendly:** Users don't need to match exact capitalization

## API Endpoints

### 1. Link All Interviews (with normalization)
```bash
POST /api/companies/link-all-interviews
```

Response:
```json
{
  "message": "Re-linking and normalization completed",
  "companiesProcessed": 15,
  "interviewsLinked": 8,
  "interviewsNormalized": 12,
  "companiesNormalized": ["Google LLC", "Meta Platforms, Inc.", "Amazon.com, Inc."]
}
```

### 2. Normalize Company Names Only
```bash
POST /api/companies/normalize-company-names
```

Response:
```json
{
  "message": "Company name normalization completed",
  "interviewsUpdated": 12,
  "companies": ["Google LLC", "Meta Platforms, Inc."]
}
```

## Frontend Usage

```typescript
import { apiClient } from '@/shared/api/client';

// Re-link and normalize all interviews
const result = await apiClient.relinkAllInterviews();
console.log(`Linked: ${result.interviewsLinked}`);
console.log(`Normalized: ${result.interviewsNormalized}`);
console.log(`Companies: ${result.companiesNormalized.join(', ')}`);

// Or just normalize already-linked interviews
const normalizeResult = await apiClient.normalizeCompanyNames();
console.log(`Normalized ${normalizeResult.interviewsUpdated} interviews`);
```

## Database Schema

### Before Normalization
```sql
SELECT company FROM "InterviewProcess";
-- Results:
--   google
--   Google
--   Google Inc
--   GOOGLE
-- (4 different variations!)
```

### After Normalization
```sql
SELECT company FROM "InterviewProcess";  
-- Results:
--   Google LLC
--   Google LLC
--   Google LLC
--   Google LLC
-- (All normalized to official name)
```

## Checking Normalization Status

### Quick Check
```bash
# Run SQL diagnostic
psql $DATABASE_URL -f check-normalization.sql
```

### Manual Check
```sql
-- See which interviews need normalization
SELECT 
    ip.company as current,
    ci."companyName" as should_be,
    ip.position
FROM "InterviewProcess" ip
JOIN "CompanyInfo" ci ON ip."companyInfoId" = ci.id
WHERE ip.company != ci."companyName"
  AND ip."archivedAt" IS NULL;
```

## Examples

### Example 1: Creating Interview

**Before normalization:**
```typescript
await apiClient.createInterview({
  company: "google",  // User types this
  position: "Software Engineer"
});

// Stored as: { company: "google", companyInfoId: null }
```

**After normalization:**
```typescript
await apiClient.createInterview({
  company: "google",  // User types this
  position: "Software Engineer"  
});

// System looks up enriched data...
// Stored as: { company: "Google LLC", companyInfoId: "xyz123" }
```

### Example 2: Bulk Normalization

```typescript
// You have existing interviews with varied names:
// - "google", "GOOGLE", "Google Inc."
// All linked to the same enriched company "Google LLC"

// Run normalization:
const result = await apiClient.normalizeCompanyNames();

// Result:
// {
//   interviewsUpdated: 3,
//   companies: ["Google LLC"]
// }

// Now all interviews show: "Google LLC"
```

## Testing

### Manual Test Flow

1. **Create enriched company:**
   ```bash
   curl -X POST http://localhost:3000/api/companies/enrich/queue \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"companyName": "Google"}'
   ```
   Wait for enrichment to complete (official name: "Google LLC")

2. **Create interview with variation:**
   ```bash
   curl -X POST http://localhost:3000/api/interviews \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{
       "company": "google",
       "position": "Engineer"
     }'
   ```

3. **Verify normalization:**
   ```sql
   SELECT company FROM "InterviewProcess" ORDER BY "createdAt" DESC LIMIT 1;
   -- Should return: "Google LLC" (not "google")
   ```

### Automated Test Scenarios

✅ Test case-insensitive matching
✅ Test exact name preservation (if no enriched data)
✅ Test bulk normalization
✅ Test update flow with name change
✅ Test enrichment worker auto-normalization

## Migration Guide

### For Existing Deployments

1. **Deploy updated code:**
   ```bash
   cd apps/api-service
   npm run build
   pm2 restart api-service
   ```

2. **Run normalization:**
   ```bash
   # Option A: Via API
   curl -X POST http://localhost:3000/api/companies/link-all-interviews \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   
   # Option B: Via SQL
   psql $DATABASE_URL -f check-normalization.sql
   ```

3. **Verify results:**
   ```sql
   -- Should show all interviews normalized
   SELECT 
     COUNT(*) FILTER (WHERE company = ci."companyName") as normalized,
     COUNT(*) FILTER (WHERE company != ci."companyName") as not_normalized
   FROM "InterviewProcess" ip
   JOIN "CompanyInfo" ci ON ip."companyInfoId" = ci.id;
   ```

## Configuration

### Disable Normalization (if needed)

To disable automatic normalization while keeping linking:

```typescript
// In interviews.service.ts
async create(userId: string, dto: CreateInterviewDto) {
  const companyInfo = await this.prisma.companyInfo.findFirst({...});
  
  return this.prisma.interviewProcess.create({
    data: {
      company: dto.company, // Use original input
      companyInfoId: companyInfo?.id, // Still link
    }
  });
}
```

## Troubleshooting

### Issue: Names not normalizing

**Check:**
1. Is enriched data available?
   ```sql
   SELECT "companyName" FROM "CompanyInfo";
   ```

2. Are interviews linked?
   ```sql
   SELECT COUNT(*) FROM "InterviewProcess" WHERE "companyInfoId" IS NOT NULL;
   ```

3. Restart API service to load new code

**Fix:**
```bash
# Re-link and normalize
curl -X POST http://localhost:3000/api/companies/link-all-interviews
```

### Issue: Wrong official name

If the enriched company name is incorrect (e.g., "Google Inc." instead of "Google LLC"):

1. Update enriched data:
   ```sql
   UPDATE "CompanyInfo" 
   SET "companyName" = 'Google LLC'
   WHERE "companyName" = 'Google Inc.';
   ```

2. Re-normalize interviews:
   ```bash
   curl -X POST http://localhost:3000/api/companies/normalize-company-names
   ```

## Performance Considerations

- **Create/Update:** +1 DB query per operation (cached by Prisma)
- **Bulk normalization:** Processes all companies sequentially
- **Large datasets:** Consider batching (100 companies at a time)

## Future Enhancements

- [ ] Add fuzzy matching for company names
- [ ] UI to preview/approve normalization before applying
- [ ] Company name aliases table for better matching
- [ ] Automatic normalization on enrichment webhook
- [ ] Analytics dashboard showing normalization impact
