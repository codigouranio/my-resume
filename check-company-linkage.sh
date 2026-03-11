#!/bin/bash

# Script to check company info linkage in the database
# This helps debug why company enrichment isn't showing in the interview tracker

echo "=== Company Info Linkage Diagnostic ==="
echo ""

# Get database URL from environment
cd apps/api-service
source ../../.env 2>/dev/null || source ../.env 2>/dev/null || true

if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL not found in environment"
    echo "Please set DATABASE_URL or run from the correct directory"
    exit 1
fi

echo "1️⃣  Checking all enriched companies in database..."
echo ""

npx prisma db execute --stdin <<SQL
SELECT 
    "companyName",
    industry,
    "employeeCount",
    "employeeCount",
    TO_CHAR("updatedAt", 'YYYY-MM-DD HH24:MI:SS') as last_enriched
FROM "CompanyInfo"
ORDER BY "updatedAt" DESC
LIMIT 10;
SQL

echo ""
echo "2️⃣  Checking interviews and their linkage..."
echo ""

npx prisma db execute --stdin <<SQL
SELECT 
    ip.company as interview_company,
    ip.position,
    ip.status,
    CASE 
        WHEN ip."companyInfoId" IS NOT NULL THEN '✅ LINKED'
        ELSE '❌ NOT LINKED'
    END as linkage_status,
    ci."companyName" as linked_to_company,
    TO_CHAR(ip."appliedAt", 'YYYY-MM-DD') as applied_date
FROM "InterviewProcess" ip
LEFT JOIN "CompanyInfo" ci ON ip."companyInfoId" = ci.id
WHERE ip."archivedAt" IS NULL
ORDER BY ip."appliedAt" DESC
LIMIT 20;
SQL

echo ""
echo "3️⃣  Checking for interviews that should be linked but aren't..."
echo ""

npx prisma db execute --stdin <<SQL
SELECT 
    ip.id as interview_id,
    ip.company as interview_company,
    ip.position,
    ci."companyName" as available_company_info
FROM "InterviewProcess" ip
CROSS JOIN "CompanyInfo" ci
WHERE ip."companyInfoId" IS NULL
  AND LOWER(ip.company) = LOWER(ci."companyName")
  AND ip."archivedAt" IS NULL
LIMIT 10;
SQL

echo ""
echo "=== Diagnostic Complete ==="
echo ""
echo "Next steps:"
echo "1. If you see enriched companies but unlinked interviews, restart your API service"
echo "2. Call the re-link endpoint: POST /api/companies/link-all-interviews"
echo "3. Or create a new interview to test automatic linking"
echo ""
