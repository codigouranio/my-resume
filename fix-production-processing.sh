#!/bin/bash
# Fix stuck PROCESSING interviews on production server

echo "🔍 Checking stuck interviews on production..."

ssh prod-host << 'ENDSSH'
# Check stuck interviews
echo "Current stuck interviews:"
psql postgresql://jose@localhost:5432/resume_db -c "
SELECT 
    ip.company, 
    ip.position, 
    ci.\"enrichmentStatus\",
    ci.id as company_info_id
FROM \"InterviewProcess\" ip
JOIN \"CompanyInfo\" ci ON ip.\"companyInfoId\" = ci.id
WHERE ci.\"enrichmentStatus\" = 'PROCESSING'
ORDER BY ip.\"createdAt\" DESC;
"

echo ""
echo "Resetting PROCESSING status to PENDING..."
psql postgresql://jose@localhost:5432/resume_db -c "
UPDATE \"CompanyInfo\" 
SET \"enrichmentStatus\" = 'PENDING', \"updatedAt\" = NOW() 
WHERE \"enrichmentStatus\" = 'PROCESSING';
"

echo ""
echo "✅ Fixed! Interviews will retry enrichment when LLM service is available."
echo ""
echo "Current status:"
psql postgresql://jose@localhost:5432/resume_db -c "
SELECT 
    ci.\"enrichmentStatus\", 
    COUNT(*) as count 
FROM \"CompanyInfo\" ci
GROUP BY ci.\"enrichmentStatus\";
"
ENDSSH

echo ""
echo "Done! Check the UI - interviews should now show '🔄 Researching...' instead of '⏳ Processing...'"
