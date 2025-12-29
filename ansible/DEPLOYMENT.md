# Complete Deployment Guide

## Latest Changes (December 2025)

The deployment now includes:
- ✅ **Database Integration:** LLM service queries PostgreSQL for user resumes
- ✅ **Dynamic Resume Loading:** Each resume uses its database content in chat
- ✅ **Python Dependencies:** Flask, psycopg2-binary installed via conda
- ✅ **Ollama Support:** Full integration with Ollama LLM backend
- ✅ **Environment Variables:** DATABASE_URL, LLAMA_SERVER_URL, ADMIN_TOKEN

## Prerequisites

### Control Machine
```bash
pip install ansible
# Or: brew install ansible (macOS)
```

### Target Server Requirements
- Ubuntu 20.04+ / Debian 11+
- SSH access with sudo privileges
- **Ollama installed and running** (see below)

### Install Ollama (on target server)
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.1:latest  # 4.9 GB
# or
ollama pull gemma3:27b       # 17 GB

# Verify
ollama list
systemctl status ollama
```

## Quick Deployment

### 1. Configure Variables

Edit `inventory.yml`:
```yaml
all:
  hosts:
    production:
      ansible_host: YOUR_SERVER_IP
      ansible_user: YOUR_SSH_USER
      
  vars:
    db_password: "CHANGE-THIS-PASSWORD"
    llm_admin_token: "CHANGE-THIS-TOKEN"
```

### 2. Test Connection
```bash
ansible -i inventory.yml production -m ping
```

### 3. Deploy
```bash
./deploy_with_conda.sh
```

## What Gets Installed

### System Packages
- PostgreSQL 15 + python3-psycopg2
- Nginx + Certbot
- Git, curl, build-essential

### Conda Environments
- **api-service/conda-env:** Node.js 20, PM2
- **llm-service:** Python 3.14 via api-service conda-env
- **my-resume/conda-env:** Node.js 20

### Python Packages (in conda)
- Flask 3.1.2
- flask-cors 6.0.2  
- requests 2.32.5
- python-dotenv 1.2.1
- psycopg2-binary 2.9.10

### Services (PM2)
- **api-service:** 2 instances (cluster), port 3000
- **llm-service:** 1 instance, port 5000

## Environment Files

### API Service
```env
DATABASE_URL=postgresql://resume_user:password@localhost:5432/resume_db
JWT_SECRET=change-this-secret-in-production
PORT=3000
NODE_ENV=production
LLM_SERVICE_URL=http://localhost:5000
```

### LLM Service
```env
PORT=5000
LLAMA_SERVER_URL=http://localhost:11434
LLAMA_API_TYPE=ollama
OLLAMA_MODEL=llama3.1:latest
DATABASE_URL=postgresql://resume_user:password@localhost:5432/resume_db
RESUME_PATH=../../data/resume.md
ADMIN_TOKEN=your-secure-token
```

### Frontend
```env
PUBLIC_API_URL=http://YOUR_SERVER:3000/api
PUBLIC_LLM_API_URL=http://YOUR_SERVER:5000
```

## Post-Deployment Checks

### 1. Verify Services
```bash
ssh user@server
source /opt/miniconda3/etc/profile.d/conda.sh
conda activate /opt/my-resume/apps/api-service/conda-env
pm2 status

# Should show:
# ✓ api-service (2 instances) - online
# ✓ llm-service (1 instance) - online
```

### 2. Check Ollama
```bash
ollama list
# Should show: llama3.1:latest

curl http://localhost:11434/api/tags
# Should return JSON with models
```

### 3. Test LLM Service
```bash
# Health check
curl http://localhost:5000/health
# Expected: {"status":"healthy","api_type":"ollama",...}

# Test chat (without slug - uses default resume)
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello"}'

# Test chat with database slug
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is this person'\''s experience?","slug":"jose-blanco-swe"}'
```

### 4. Test Database Connection
```bash
PGPASSWORD=your-password psql -h localhost -U resume_user -d resume_db -c "\dt"
# Should show: Resume, User, RefreshToken, RecruiterInterest tables

# Verify RecruiterInterest table
PGPASSWORD=your-password psql -h localhost -U resume_user -d resume_db -c "\d \"RecruiterInterest\""
```

### 5. Test Recruiter Interest Submission
```bash
# Submit a test recruiter interest
curl -X POST http://localhost:3000/api/resumes/recruiter-interest \
  -H "Content-Type: application/json" \
  -d '{
    "resumeSlug": "your-slug",
    "name": "Test Recruiter",
    "email": "recruiter@test.com",
    "company": "Test Company",
    "message": "I would like to discuss an opportunity."
  }'

# Should return JSON with id, name, email, etc.
```

### 6. Check Frontend Build
```bash
ls -lh /opt/my-resume/apps/my-resume/dist/static/js/*.map
# Should show 4-5 .map files for debugging
```

## Troubleshooting

### API Service Fails with "Cannot find module '@nestjs/graphql'"

**Solution:**
```bash
ssh user@server
source /opt/miniconda3/etc/profile.d/conda.sh
conda activate /opt/my-resume/apps/api-service/conda-env
cd /opt/my-resume/apps/api-service
npm install @nestjs/graphql @nestjs/apollo @nestjs/cqrs @apollo/server graphql
npm run build
pm2 restart api-service
```

### Prisma Client Missing RecruiterInterest

**Solution:**
```bash
cd /opt/my-resume/apps/api-service
source /opt/miniconda3/etc/profile.d/conda.sh
conda activate /opt/my-resume/apps/api-service/conda-env
npx prisma generate
pm2 restart api-service
```

### Database Table Missing

**Solution:**
```bash
cd /opt/my-resume/apps/api-service
source /opt/miniconda3/etc/profile.d/conda.sh
conda activate /opt/my-resume/apps/api-service/conda-env

# Apply migrations
npx prisma migrate deploy

# If no migrations, force schema sync
npx prisma db push --accept-data-loss

# Regenerate client
npx prisma generate
pm2 restart api-service
```

### LLM Service Fails with "ModuleNotFoundError: No module named 'psycopg2'"

**Solution:**
```bash
ssh user@server
source /opt/miniconda3/etc/profile.d/conda.sh
conda activate /opt/my-resume/apps/api-service/conda-env
conda install -y -c conda-forge psycopg2-binary
pm2 restart llm-service
```

### LLM Service Fails with "ModuleNotFoundError: No module named 'flask'"

**Solution:**
```bash
conda activate /opt/my-resume/apps/api-service/conda-env
conda install -y -c conda-forge flask flask-cors requests python-dotenv
pm2 restart llm-service
```

### Ollama Not Found

**Solution:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.1:latest
systemctl status ollama
``Update dependencies if needed
cd apps/api-service
npm install

# Apply new migrations
npx prisma migrate deploy
npx prisma generate

# Rebuild backend
npm run build

# Rebuild frontend
cd ../my-resume
npm run build

# Restart services
pm2 restart all
```

### Schema Updates
When Prisma schema changes:
```bash
cd /opt/my-resume/apps/api-service
source /opt/miniconda3/etc/profile.d/conda.sh
conda activate /opt/my-resume/apps/api-service/conda-env

# Apply migrations (recommended for production)
npx prisma migrate deploy

# OR use db push (only if no migrations exist)
npx prisma db push

# Always regenerate client after schema changes
npx prisma generate
npm run build
pm2 restart api-service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Check if user exists
sudo -u postgres psql -c "\du"

# Recreate if needed
sudo -u postgres psql -c "CREATE USER resume_user WITH PASSWORD 'your-password';"
sudo -u postgres psql -c "CREATE DATABASE resume_db OWNER resume_user;"
```

### PM2 Not Using Correct Python

The playbook now explicitly sets:
```javascript
interpreter: '/opt/my-resume/apps/api-service/conda-env/bin/python'
```

If issues persist:
```bash
pm2 delete llm-service
pm2 start /opt/my-resume/apps/api-service/conda-env/bin/python \
  --name llm-service \
  --cwd /opt/my-resume/apps/llm-service \
  -- app_remote.py
pm2 save
```

## Updating After Deployment

### Code Updates
```bash
cd /opt/my-resume
git pull
source /opt/miniconda3/etc/profile.d/conda.sh
conda activate apps/api-service/conda-env

# Rebuild frontend
cd apps/my-resume
npm run build

# Restart services
pm2 restart all
```

### Resume Content Updates

**Method 1: Hot reload (no downtime)**
```bash
# Edit resume in database via app, then:
curl -X POST http://localhost:5000/api/reload-resume \
  -H "X-Admin-Token: your-admin-token"
```

**Method 2: Restart service**
```bash
# Edit data/resume.md or database, then:
pm2 restart llm-service
```

## Multiple Server Deployment

### Update inventory.yml
```yaml
all:
  hosts:
    server1:
      ansible_host: 192.168.1.100
    server2:
      ansible_host: 192.168.1.101
    server3:
      ansible_host: 192.168.1.102
```

### Deploy to all
```bash
ansible-playbook -i inventory.yml playbook.yml
```

### Deploy to specific server
```bash
ansible-playbook -i inventory.yml playbook.yml --limit server1
```

## Security Checklist

- [ ] Change `db_password` in inventory.yml
- [ ] Change `llm_admin_token` in inventory.yml
- [ ] Change `JWT_SECRET` in API .env
- [ ] Configure firewall (ufw)
- [ ] Setup SSL with certbot
- [ ] Use ansible-vault for secrets
- [ ] Restrict PostgreSQL to localhost
- [ ] Regular system updates

## Managing Services

```bash
# Activate environment first
source /opt/miniconda3/etc/profile.d/conda.sh
conda activate /opt/my-resume/apps/api-service/conda-env

# Status
pm2 status

# Logs
pm2 logs
pm2 logs llm-service --lines 50

# Restart
pm2 restart llm-service
pm2 restart api-service

# Monitor
pm2 monit
```

## Architecture Summary

```
User Browser
    ↓
Nginx :80 (reverse proxy)
    ↓
├─→ Frontend (React) - /opt/my-resume/apps/my-resume/dist
├─→ API Service :3000 (NestJS + PostgreSQL)
└─→ LLM Service :5000 (Flask + Ollama + PostgreSQL)
         ↓
    Ollama :11434 (llama3.1:latest)
```

## Key Files

- `playbook.yml` - Main Ansible playbook
- `inventory.yml` - Server configuration
- `deploy_with_conda.sh` - Deployment script
- `ecosystem.config.js` - PM2 configuration (auto-generated)

## Support

- **LLM Operations:** See `apps/llm-service/OPERATIONS.md`
- **API Docs:** http://YOUR_SERVER/api/docs
- **GraphQL:** http://YOUR_SERVER/graphql

## Changelog

**December 28, 2025:**
- Added DATABASE_URL to LLM service
- Configured psycopg2-binary installation
- Updated PM2 to use correct Python interpreter
- Added Flask/Flask-CORS dependencies
- Configured Ollama integration
- Added database resume loading by slug
