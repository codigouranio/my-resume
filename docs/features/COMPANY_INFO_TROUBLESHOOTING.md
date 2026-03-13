# Company Info Enrichment - Troubleshooting Guide

## Problem
Company information is being enriched successfully, but it's not showing up in the interview tracker.

## Root Cause
The interviews weren't being automatically linked to the enriched company info. This happened because:
1. The `create` and `update` methods in `interviews.service.ts` didn't check for existing company info
2. The `linkToInterviews` function only ran during the enrichment worker process
3. If you created an interview **after** enrichment completed, it wasn't automatically linked

## New Feature: Company Name Normalization 🎉

The system now automatically normalizes company names to match the official enriched names. For example:
- User types: "google", "Google Inc", or "GOOGLE"
- System normalizes to: "Google" (official enriched name)

This ensures:
- ✅ Consistent company names across all interviews
- ✅ All interviews for the same company are grouped together
- ✅ Prevents duplicate company info records
- ✅ Better analytics and reporting

## Solution Applied

### 1. Automatic Linking on Create/Update ✅
Updated `apps/api-service/src/features/interviews/interviews.service.ts`:
- When creating an interview, it now automatically searches for matching company info
- When updating an interview's company name, it re-links to the correct company info
- Uses case-insensitive matching
- **NEW:** Automatically uses official enriched company name

### 2. Company Name Normalization ✅
The system now normalizes company names to official enriched names:
- **On create:** If enriched data exists, uses official name (e.g., "Google LLC" instead of "google")
- **On update:** If company matches enriched data, normalizes to official name
- **On re-link:** Updates all interview names to match enriched company names

**Example:**
```javascript
// User creates interview with:
{ company: "google", position: "Engineer" }

// System saves:
{ company: "Google LLC", position: "Engineer", companyInfoId: "123" }
```

### 3. Manual Re-linking Endpoint ✅
Added new endpoints:
- `POST /api/companies/link-all-interviews` - Links AND normalizes all interviews
- `POST /api/companies/normalize-company-names` - Only normalizes already-linked interviews
- Scans ALL enriched companies
- Links them to any matching interviews
- Returns count of interviews linked

## How to Fix Existing Interviews

### Option 1: Use the Re-linking Endpoint (Recommended)

```bash
# From your terminal (with API running)
curl -X POST http://localhost:3000/api/companies/link-all-interviews \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Or use the frontend:
```javascript
// Re-link AND normalize all interviews
const result = await apiClient.relinkAllInterviews();
console.log(`Linked: ${result.interviewsLinked}, Normalized: ${result.interviewsNormalized}`);

// Or just normalize (for already-linked interviews)
const normalizeResult = await apiClient.normalizeCompanyNames();
console.log(`Normalized ${normalizeResult.interviewsUpdated} interviews`);
```

### Option 2: Run the Diagnostic Script

```bash
# Make it executable
chmod +x check-company-linkage.sh

# Run it
./check-company-linkage.sh
```

This will show you:
1. All enriched companies in the database
2. All interviews and their linkage status
3. Interviews that should be linked but aren't

### Option 3: Manual Database Query

```sql
-- Check the issue
SELECT 
    ip.company as interview_company,
    ip.position,
    CASE WHEN ip."companyInfoId" IS NOT NULL THEN 'LINKED' ELSE 'NOT LINKED' END as status,
    ci."companyName" as available_company_info
FROM "InterviewProcess" ip
LEFT JOIN "CompanyInfo" ci ON LOWER(ip.company) = LOWER(ci."companyName")
WHERE ip."archivedAt" IS NULL
ORDER BY ip."appliedAt" DESC;

-- Fix it manually (if needed)
UPDATE "InterviewProcess" ip
SET "companyInfoId" = ci.id
FROM "CompanyInfo" ci
WHERE LOWER(ip.company) = LOWER(ci."companyName")
  AND ip."companyInfoId" IS NULL;
```

## Verification Steps

### 1. Check if Company Info Exists
```sql
SELECT * FROM "CompanyInfo" WHERE "companyName" ILIKE '%YOUR_COMPANY%';
```

### 2. Check Interview Linkage
```sql
SELECT id, company, "companyInfoId" 
FROM "InterviewProcess" 
WHERE company ILIKE '%YOUR_COMPANY%';
```

### 3. View Company Info in Interview Detail
Open an interview in the tracker - you should now see:
- Company logo (if available)
- Company description
- Industry, employee count
- Headquarters location
- Website, LinkedIn, GitHub links
- Salary ranges, benefits  
- Glassdoor rating

## Testing New Interviews

1. **Restart your API service** to load the updated code
2. Create a new interview for a company that's already enriched
3. The company info should appear immediately
4. No need to wait for enrichment to complete

## API Client Method (Frontend)

Add this to your `apps/my-resume/src/shared/api/client.ts`:

```typescript
async relinkAllInterviews() {
  const response = await fetch(`${this.baseUrl}/companies/link-all-interviews`, {
    method: 'POST',
    headers: this.getHeaders(),
  });
  if (!response.ok) throw new Error('Failed to re-link interviews');
  return response.json();
}
```

Then call it:
```typescript
const result = await apiClient.relinkAllInterviews();
console.log(`Linked ${result.interviewsLinked} interviews to ${result.companiesProcessed} companies`);
```

## What Changed

### In `interviews.service.ts`:

**Before:**
```typescript
async create(userId: string, dto: CreateInterviewDto) {
  return this.prisma.interviewProcess.create({
    data: {
      userId,
      company: dto.company,
      // ... other fields
    }
  });
}
```

**After (with normalization):**
```typescript
async create(userId: string, dto: CreateInterviewDto) {
  // NEW: Look up company info by name
  const companyInfo = await this.prisma.companyInfo.findFirst({
    where: {
      companyName: {
        equals: dto.company,
        mode: 'insensitive',
      },
    },
  });

  return this.prisma.interviewProcess.create({
    data: {
      userId,
      company: companyInfo?.companyName || dto.company, // NEW: Use official name
      companyInfoId: companyInfo?.id, // NEW: Auto-link
      // ... other fields
    }
  });
}
```

## Common Issues

### Issue: Company info still not showing
**Solution:** 
1. Restart the API service: `npm run start:dev` (from `apps/api-service/`)
2. Run the re-link endpoint with normalization
3. Hard refresh the browser (Cmd+Shift+R / Ctrl+Shift+R)

### Issue: Company names don't match in dropdown/autocomplete
**Solution:** 
- ✅ The system now automatically normalizes names, so this is no longer an issue!
- When you type "google", it will be saved as "Google LLC" (official name)
- All variations map to the same official name

### Issue: Multiple companies with similar names
**Solution:**
- Check `SELECT * FROM "CompanyInfo"` to see exact names
- Use the exact name when creating interviews

## Future Improvements

Consider adding:
1. Fuzzy matching for company names (e.g., using Levenshtein distance)
2. Company name normalization (strip "Inc.", "LLC", etc.)
3. Admin UI to manually link interviews to company info
4. Webhook to notify when enrichment completes
5. Auto-retry failed enrichments

## Questions?

If company info still isn't showing up:
1. Run `./check-company-linkage.sh` and share the output
2. Check the API logs for errors: `pm2 logs api-service`
3. Verify the enrichment completed: `LLEN bull:company-enrichment:completed` (Redis)
