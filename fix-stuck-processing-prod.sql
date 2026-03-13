-- Fix Stuck PROCESSING Interviews on Production (172.16.23.127)
-- Run this on the production server via SSH

-- Step 1: Check which interviews are stuck
SELECT 
    ip.id as interview_id,
    ip.company, 
    ip.position, 
    ip."appliedAt",
    ci."enrichmentStatus",
    ci.id as company_info_id,
    ci."updatedAt" as status_updated_at
FROM "InterviewProcess" ip
JOIN "CompanyInfo" ci ON ip."companyInfoId" = ci.id
WHERE ci."enrichmentStatus" = 'PROCESSING'
ORDER BY ip."createdAt" DESC;

-- Step 2: Reset PROCESSING to PENDING (will trigger retry when LLM service is available)
UPDATE "CompanyInfo" 
SET "enrichmentStatus" = 'PENDING', 
    "updatedAt" = NOW() 
WHERE "enrichmentStatus" = 'PROCESSING';

-- Step 3: Verify the fix
SELECT 
    ci."enrichmentStatus", 
    COUNT(*) as count 
FROM "CompanyInfo" ci
GROUP BY ci."enrichmentStatus"
ORDER BY ci."enrichmentStatus";

-- Step 4: Check Google interview specifically
SELECT 
    ip.company, 
    ip.position,
    ci."enrichmentStatus",
    ip."appliedAt",
    ci."updatedAt"
FROM "InterviewProcess" ip
JOIN "CompanyInfo" ci ON ip."companyInfoId" = ci.id
WHERE ip.company ILIKE '%google%'
ORDER BY ip."createdAt" DESC
LIMIT 3;
