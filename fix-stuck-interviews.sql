-- Fix interviews stuck in PROCESSING status
-- This happens when LLM service is unavailable during enrichment

-- Find stuck interviews (enrichment status = PROCESSING)
SELECT 
    ip.id as interview_id,
    ip.company,
    ip.position,
    ci.enrichmentStatus,
    ip.createdAt
FROM "InterviewProcess" ip
JOIN "CompanyInfo" ci ON ip."companyInfoId" = ci.id
WHERE ci."enrichmentStatus" = 'PROCESSING'
ORDER BY ip."createdAt" DESC;

-- Reset to PENDING to allow retry
UPDATE "CompanyInfo"
SET "enrichmentStatus" = 'PENDING',
    "updatedAt" = NOW()
WHERE "enrichmentStatus" = 'PROCESSING';

-- Verify the fix
SELECT 
    ip.company,
    ci."enrichmentStatus",
    COUNT(*) as count
FROM "InterviewProcess" ip
JOIN "CompanyInfo" ci ON ip."companyInfoId" = ci.id
GROUP BY ip.company, ci."enrichmentStatus";
