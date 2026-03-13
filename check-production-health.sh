#!/bin/bash
# Production Health Check Script for 172.16.23.127
# Checks LLM service, Ollama, API service, and company enrichment status

echo "🔍 Production Server Health Check (172.16.23.127)"
echo "=================================================="
echo ""

PROD_HOST="prod-host"

echo "1️⃣ Checking PM2 Services..."
ssh $PROD_HOST "pm2 status" 2>&1 | grep -E "api-service|llm-service|online|stopped|errored"
echo ""

echo "2️⃣ Checking Ollama Service..."
ssh $PROD_HOST "systemctl status ollama --no-pager | head -10" 2>&1
echo ""

echo "3️⃣ Testing Ollama API..."
ssh $PROD_HOST "curl -s -m 5 http://localhost:11434/api/version || echo 'Ollama not responding'"
echo ""

echo "4️⃣ Checking LLM Service Logs (last 20 lines)..."
ssh $PROD_HOST "pm2 logs llm-service --lines 20 --nostream 2>&1 | tail -20"
echo ""

echo "5️⃣ Testing LLM Service Health..."
ssh $PROD_HOST "curl -s -m 5 http://localhost:5000/health || echo 'LLM service not responding'"
echo ""

echo "6️⃣ Checking API Service Logs (recent errors)..."
ssh $PROD_HOST "pm2 logs api-service --lines 30 --nostream 2>&1 | grep -i error | tail -10"
echo ""

echo "7️⃣ Checking PostgreSQL..."
ssh $PROD_HOST "pg_isready -U jose -d resume_db || echo 'PostgreSQL check failed'"
echo ""

echo "8️⃣ Checking stuck interviews in database..."
ssh $PROD_HOST "psql postgresql://jose@localhost:5432/resume_db -c \"SELECT COUNT(*) as stuck_count FROM \\\"CompanyInfo\\\" WHERE \\\"enrichmentStatus\\\" = 'PROCESSING';\"" 2>&1
echo ""

echo "9️⃣ Checking Redis..."
ssh $PROD_HOST "redis-cli ping 2>&1 || echo 'Redis not accessible'"
echo ""

echo "🔟 Checking disk space..."
ssh $PROD_HOST "df -h | grep -E 'Filesystem|/dev/root|/$'"
echo ""

echo "=================================================="
echo "✅ Health check complete"
