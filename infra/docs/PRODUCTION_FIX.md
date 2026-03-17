# Production Deployment Fix - 172.16.23.127

## Problem
The production deployment was failing because the `.env` file configuration in the Ansible playbook had missing quotes around environment variable values. This causes parsing errors when the services try to read their configuration.

## What Was Fixed

### File: `ansible/playbooks/03-application-deploy.yml`

**1. API Service .env (lines 50-59)**
Added quotes around these values:
```ini
STRIPE_SECRET_KEY="..."
STRIPE_WEBHOOK_SECRET="..."
STRIPE_PRICE_ID="..."
AWS_REGION="..."
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
SES_FROM_EMAIL="..."
FRONTEND_URL="..."
API_BASE_URL="..."
LLM_WEBHOOK_SECRET="..."
```

**2. LLM Service .env (lines 267-280)**
Added quotes around these values:
```ini
PORT="..."
LLAMA_SERVER_URL="..."
LLAMA_API_TYPE="..."
LLAMA_MODEL="..."
VLLM_SERVER_URL="..."
VLLM_MODEL="..."
DATABASE_URL="..."
ADMIN_TOKEN="..."
API_BASE_URL="..."
API_SERVICE_URL="..."
LLM_SERVICE_USERNAME="..."
LLM_SERVICE_PASSWORD="..."
```

## How to Deploy

### Option 1: Full Deployment (Recommended)
```bash
cd ansible
ansible-playbook -i inventory-production.yml \
  playbooks/03-application-deploy.yml \
  --vault-password-file ~/.ansible/vault_password
```

### Option 2: Quick Fix (Config Only)
```bash
cd ansible

# Update just the .env files
ansible-playbook -i inventory-production.yml \
  playbooks/03-application-deploy.yml \
  --vault-password-file ~/.ansible/vault_password \
  --start-at-task="Configure API Service environment"

# Then restart services
ssh prod-host "pm2 restart all"
```

### Option 3: Use the Fix Script
```bash
./deploy-fix-production.sh
```

## Verification

After deployment, check:

1. **Services are running:**
   ```bash
   ssh prod-host "pm2 status"
   ```

2. **Health endpoints:**
   ```bash
   ssh prod-host "curl http://localhost:3000/health"  # API
   ssh prod-host "curl http://localhost:5000/health"  # LLM
   ```

3. **Check logs for errors:**
   ```bash
   ssh prod-host "pm2 logs --lines 50"
   ```

4. **Test company enrichment:**
   - Create a new interview in the UI
   - Should show "🔄 Researching..." → "✓ Enriched" within 30-60 seconds
   - Check logs: `ssh prod-host "pm2 logs llm-service --lines 100"`

## Common Issues

### Services won't start
- Check `.env` file syntax: `ssh prod-host "cat /opt/my-resume/apps/api-service/.env"`
- Verify no stray characters or unclosed quotes
- Check permission: `ssh prod-host "ls -la /opt/my-resume/apps/*/. env"`

### Ollama not responding
```bash
ssh prod-host "systemctl status ollama"
ssh prod-host "curl http://localhost:11434/api/version"
```

### Database connection errors
```bash
ssh prod-host "pg_isready -U jose -d resume_db"
```

## Roll Back (if needed)

If issues persist, restore from git:
```bash
cd ansible
git checkout HEAD~1 ansible/playbooks/03-application-deploy.yml
# Then redeploy
```
