#!/bin/bash
# Quick fix for stuck interviews

echo "🔧 Fixing stuck interviews..."
echo ""
echo "Current stuck interviews:"
psql "$DATABASE_URL" -c "SELECT ip.company, ip.position, ci.\"enrichmentStatus\" FROM \"InterviewProcess\" ip JOIN \"CompanyInfo\" ci ON ip.\"companyInfoId\" = ci.id WHERE ci.\"enrichmentStatus\" = 'PROCESSING';"

echo ""
echo "Resetting to PENDING (will retry when LLM service is available)..."
psql "$DATABASE_URL" -c "UPDATE \"CompanyInfo\" SET \"enrichmentStatus\" = 'PENDING', \"updatedAt\" = NOW() WHERE \"enrichmentStatus\" = 'PROCESSING';"

echo ""
echo "✅ Done! Interviews will retry enrichment once LLM service is running."
