-- Company Name Normalization Check
-- Run this to see which interviews would be normalized

-- 1. Show interviews with non-normalized names
SELECT 
    ip.id,
    ip.company as current_name,
    ci."companyName" as official_name,
    ip.position,
    CASE 
        WHEN ip.company = ci."companyName" THEN '✅ Already normalized'
        WHEN ip.company != ci."companyName" THEN '⚠️ Needs normalization'
        ELSE '❌ Not linked'
    END as status
FROM "InterviewProcess" ip
LEFT JOIN "CompanyInfo" ci ON ip."companyInfoId" = ci.id
WHERE ip."archivedAt" IS NULL
  AND ip."companyInfoId" IS NOT NULL
ORDER BY status, ip.company;

-- 2. Show summary of normalization needs
SELECT 
    CASE 
        WHEN ip.company = ci."companyName" THEN 'Normalized'
        WHEN ip.company != ci."companyName" THEN 'Needs Normalization'
        WHEN ip."companyInfoId" IS NULL THEN 'Not Linked'
    END as category,
    COUNT(*) as count
FROM "InterviewProcess" ip
LEFT JOIN "CompanyInfo" ci ON ip."companyInfoId" = ci.id
WHERE ip."archivedAt" IS NULL
GROUP BY category
ORDER BY category;

-- 3. Show specific name variations that would be normalized
SELECT 
    ci."companyName" as official_name,
    COUNT(DISTINCT ip.company) as variations_count,
    STRING_AGG(DISTINCT ip.company, ', ' ORDER BY ip.company) as variations
FROM "InterviewProcess" ip
JOIN "CompanyInfo" ci ON ip."companyInfoId" = ci.id
WHERE ip."archivedAt" IS NULL
  AND ip.company != ci."companyName"
GROUP BY ci."companyName"
HAVING COUNT(DISTINCT ip.company) > 0
ORDER BY variations_count DESC;

-- 4. Preview what would be normalized (first 20)
SELECT 
    ip.id,
    ip.company as before,
    ci."companyName" as after,
    ip.position
FROM "InterviewProcess" ip
JOIN "CompanyInfo" ci ON ip."companyInfoId" = ci.id
WHERE ip."archivedAt" IS NULL
  AND ip.company != ci."companyName"
ORDER BY ci."companyName"
LIMIT 20;
