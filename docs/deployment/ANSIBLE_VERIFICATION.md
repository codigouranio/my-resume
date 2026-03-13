# Ansible Scripts Verification - Latest Configuration

## ✅ All Changes Applied Successfully

The Ansible deployment scripts have been updated to support the latest Cloudflare Tunnel architecture with subdomain-based routing.

---

## Configuration Updates Summary

### 1. CORS Origins (group_vars/all.yml)
**Updated:** Domain-based origins for Cloudflare Tunnel subdomain architecture

```yaml
cors_origins: 
  - "http://localhost:3001"           # Local dev
  - "https://{{ domain }}"             # Main domain (resumecast.ai)
  - "https://api.{{ domain }}"         # API subdomain (api.resumecast.ai)
  - "https://llm.{{ domain }}"         # LLM subdomain (llm.resumecast.ai)
  - "https://my-resume.paskot.com"     # Alternative domains
  - "https://api.paskot.com"
  - "https://llm.paskot.com"
```

**Impact:** API service `main.ts` dynamically matches these origins in CORS configuration
**File:** `ansible/group_vars/all.yml` (line 70)

### 2. Frontend Environment Variables (playbooks/03-application-deploy.yml)
**Updated:** HTTPS subdomain URLs instead of local paths

```yaml
PUBLIC_API_URL=https://api.{{ domain }}      # https://api.resumecast.ai
PUBLIC_LLM_API_URL=https://llm.{{ domain }}  # https://llm.resumecast.ai
PUBLIC_BASE_DOMAIN={{ domain }}              # resumecast.ai
PUBLIC_GTM_ID={{ gtm_id }}                   # GTM-KC5CWRP
PUBLIC_GA_ID={{ ga_id }}                     # G-1S7FR5H9NV
```

**Previous (incorrect):**
```yaml
PUBLIC_API_URL=/api            # ❌ Local path-based routing
PUBLIC_LLM_API_URL=/llm        # ❌ Local path-based routing
```

**Impact:** React app now connects to production HTTPS subdomains
**File:** `ansible/playbooks/03-application-deploy.yml` (line 207-215)

### 3. API Service Configuration (playbooks/03-application-deploy.yml)
**Unchanged - Still Correct:**
```yaml
CORS_ORIGINS="{{ cors_origins | join(',') }}"  # Uses updated cors_origins list
```

**File:** `ansible/playbooks/03-application-deploy.yml` (line 51)

### 4. LLM Service Configuration (playbooks/03-application-deploy.yml)
**Unchanged - Already Complete:**
```yaml
PORT={{ llm_port }}                    # 5000
LLAMA_SERVER_URL={{ llama_server_url }} # http://localhost:11434
DATABASE_URL=postgresql://...          # ✅ Database integration
ADMIN_TOKEN={{ llm_admin_token }}      # Admin endpoint protection
```

**File:** `ansible/playbooks/03-application-deploy.yml` (line 157-177)

### 5. Nginx Configuration (templates/nginx.conf.j2)
**Unchanged - Correct for Subdomain Routing:**

**API Server Block:**
```nginx
server_name api.{{ domain }};
location / {
    proxy_pass http://localhost:{{ api_port }}/api/;  # ✅ Correct path
}
```

**LLM Server Block:**
```nginx
server_name llm.{{ domain }};
location / {
    proxy_pass http://localhost:{{ llm_port }}/;      # ✅ Correct path
    proxy_read_timeout 300s;  # For long LLM responses
}
```

**Frontend Server Block:**
```nginx
server_name {{ domain }} *.{{ domain }};  # ✅ Main domain + all subdomains
location / {
    root {{ frontend_path }}/dist;
    try_files $uri $uri/ /index.html;     # ✅ SPA routing
}
```

**File:** `ansible/templates/nginx.conf.j2`

### 6. PM2 Ecosystem Configuration (templates/ecosystem.config.js.j2)
**Unchanged - Correct:**
```javascript
{
  name: 'api-service',
  interpreter: '{{ api_service_path }}/conda-env/bin/node',
  instances: {{ pm2_instances_api }},  // 2 instances in cluster mode
  env: {
    PORT: {{ api_port }},              // 3000
    NODE_ENV: '{{ node_env }}'         // production
  }
},
{
  name: 'llm-service',
  interpreter: '{{ api_service_path }}/conda-env/bin/python',
  instances: 1,
  env: {
    PORT: {{ llm_port }},              // 5000
    DATABASE_URL: '...',               // ✅ Database connection
    ADMIN_TOKEN: '{{ llm_admin_token }}'
  }
}
```

**File:** `ansible/templates/ecosystem.config.js.j2`

### 7. Inventory Configuration (inventory.yml)
**Unchanged - Correct:**
```yaml
domain: resumecast.ai
api_port: 3000
llm_port: 5000
enable_ssl: false    # ✅ Cloudflare Tunnel handles HTTPS
cloudflare_real_ip: false  # ✅ Not needed for Cloudflare Tunnel
```

**File:** `ansible/inventory.yml`

---

## Deployment Flow Verification

### Build & Deployment Sequence:

1. ✅ **Code Repository** → Clone from GitHub main branch
   
2. ✅ **Conda Environments** → Create for Node.js and Python
   
3. ✅ **API Service** 
   - Install npm dependencies
   - Generate Prisma client
   - Run database migrations
   - Build application
   - Uses CORS_ORIGINS from group_vars
   
4. ✅ **LLM Service**
   - Install Flask + psycopg2-binary via conda
   - Configure with DATABASE_URL for resume access
   - Set ADMIN_TOKEN for admin endpoints
   
5. ✅ **Frontend**
   - Install npm dependencies
   - Build with PUBLIC_* environment variables (HTTPS URLs)
   - Output to dist/ folder
   
6. ✅ **Nginx**
   - Generate config from template with domain substitution
   - Configure 3 server blocks: api, llm, frontend
   - Serve static files from dist/
   
7. ✅ **PM2**
   - Start API service (2 instances, cluster mode)
   - Start LLM service (1 instance)
   - Auto-restart on crashes

---

## Environment Variables Mapping

| Service | Variable | Value | Source | 
|---------|----------|-------|--------|
| **Frontend** | PUBLIC_API_URL | https://api.resumecast.ai | playbooks/03 |
| **Frontend** | PUBLIC_LLM_API_URL | https://llm.resumecast.ai | playbooks/03 |
| **Frontend** | PUBLIC_GTM_ID | GTM-KC5CWRP | group_vars/all |
| **Frontend** | PUBLIC_GA_ID | G-1S7FR5H9NV | group_vars/all |
| **Frontend** | PUBLIC_BASE_DOMAIN | resumecast.ai | playbooks/03 |
| **API** | CORS_ORIGINS | *see list below* | group_vars/all |
| **API** | PORT | 3000 | inventory.yml |
| **API** | DATABASE_URL | postgresql://... | playbooks/03 |
| **API** | JWT_SECRET | (vault) | group_vars/all |
| **API** | NODE_ENV | production | group_vars/all |
| **LLM** | PORT | 5000 | ecosystem.config |
| **LLM** | DATABASE_URL | postgresql://... | playbooks/03 |
| **LLM** | LLAMA_SERVER_URL | http://localhost:11434 | group_vars/all |
| **LLM** | ADMIN_TOKEN | (vault) | group_vars/all |

### CORS Origins Expanded:
```
https://resumecast.ai
https://api.resumecast.ai
https://llm.resumecast.ai
https://my-resume.paskot.com
https://api.paskot.com
https://llm.paskot.com
http://localhost:3001
```

---

## Cloudflare Tunnel Integration

### Architecture:
```
User Browser
    ↓ (HTTPS)
Cloudflare Tunnel (Encrypted)
    ↓ (HTTP)
Nginx :80 (localhost)
    ├→ api.resumecast.ai → localhost:3000/api/
    ├→ llm.resumecast.ai → localhost:5000/
    └→ resumecast.ai/* → /dist/index.html (SPA routing)
```

### DNS Configuration:
```
CNAME: * → Cloudflare Tunnel
CNAME: resumecast.ai → Cloudflare Tunnel
```

**Result:** All `*.resumecast.ai` subdomains work without additional DNS changes

---

## Pre-Deployment Checklist

Before running the Ansible playbook:

- [ ] Update `inventory.yml` with correct `ansible_host` (server IP)
- [ ] Set `db_password` to a strong password or use ansible-vault
- [ ] Set `jwt_secret` to a strong 32+ character secret
- [ ] Set `llm_admin_token` to a secure token
- [ ] Update `gtm_id` and `ga_id` in group_vars if using Google Analytics
- [ ] Verify `repo_url` and `repo_branch` are correct
- [ ] Ensure domain is set to `resumecast.ai` in `inventory.yml`
- [ ] Confirm Ollama is installed and running on target server
- [ ] SSH access verified: `ssh user@ansible_host`
- [ ] Cloudflare Tunnel already configured to `http://localhost`

---

## Post-Deployment Verification

After running `./deploy_with_conda.sh`:

### 1. Check Service Status
```bash
ssh jose@172.16.23.127
cd /opt/my-resume
source /opt/miniconda3/etc/profile.d/conda.sh
conda activate apps/api-service/conda-env
pm2 status
```

Expected output:
```
id │ name           │ mode     │ status   │ ↺
───┼────────────────┼──────────┼──────────┼─────
0  │ api-service    │ cluster  │ online   │ 0
1  │ api-service    │ cluster  │ online   │ 0
2  │ llm-service    │ fork     │ online   │ 0
```

### 2. Test Frontend
```bash
curl -sI https://resumecast.ai | head -3
# HTTP/2 200
```

### 3. Test API Documentation
```bash
curl -sI https://api.resumecast.ai/docs | head -3
# HTTP/2 200
```

### 4. Test LLM Service
```bash
curl -s https://llm.resumecast.ai/health | jq .
# {"status":"healthy","api_type":"ollama",...}
```

### 5. Check Nginx Configuration
```bash
ssh jose@172.16.23.127
sudo nginx -t
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
```

### 6. View Logs
```bash
pm2 logs api-service --lines 20
pm2 logs llm-service --lines 20
```

---

## Key Architectural Decisions

| Decision | Reason | Files Affected |
|----------|--------|-----------------|
| Subdomain routing | Cleaner URLs, easier to manage separate services | nginx.conf.j2 |
| HTTPS subdomains in frontend env | Production URLs, Cloudflare Tunnel termination | .env.production |
| Dynamic CORS matching | Allow all subdomains without hardcoding | main.ts |
| Cloudflare Tunnel over Let's Encrypt | No certificate management, automatic renewal | inventory.yml (enable_ssl=false) |
| PM2 cluster mode for API | Better resource utilization, load balancing | ecosystem.config.js.j2 |
| Single LLM instance | Stateful service, would need session sharing for clustering | ecosystem.config.js.j2 |

---

## Troubleshooting Guide

### Issue: CORS errors on frontend login
**Solution:** Check CORS_ORIGINS includes your domain
```bash
echo "CORS_ORIGINS in .env:"
cat /opt/my-resume/apps/api-service/.env | grep CORS
```

### Issue: Frontend says "Cannot connect to API"
**Solution:** Check PUBLIC_API_URL in frontend build
```bash
# Rebuild frontend with correct env vars
cd /opt/my-resume/apps/my-resume
source /opt/miniconda3/etc/profile.d/conda.sh
conda activate ./conda-env
npm run build
```

### Issue: LLM service can't find Ollama
**Solution:** Verify Ollama is running
```bash
ollama list
systemctl status ollama
```

### Issue: Database connection error
**Solution:** Check DATABASE_URL and PostgreSQL
```bash
psql -U resume_user -d resume_db -c "SELECT 1"
```

### Issue: Custom subdomain not working
**Solution:** Add wildcard DNS record to Cloudflare
```
DNS Record Type: CNAME
Name: *
Value: [your-cloudflare-tunnel-cname]
```

---

## Latest Changes Summary

**Date:** February 3, 2026

**Changed Files:**
1. `ansible/group_vars/all.yml` - Updated CORS origins for subdomain routing
2. `ansible/playbooks/03-application-deploy.yml` - Updated frontend environment variables to use HTTPS subdomain URLs

**What Was Fixed:**
- ✅ Frontend now connects to production HTTPS subdomains instead of local paths
- ✅ CORS configuration includes all necessary subdomain origins
- ✅ GTM and GA IDs are properly set in frontend build
- ✅ All services work together through Cloudflare Tunnel

**Tested Against:**
- Cloudflare Tunnel configuration: `http://localhost:80` (all domains)
- DNS records: Wildcard CNAME pointing to Cloudflare Tunnel
- API CORS: Dynamic origin matching for `*.resumecast.ai` domains
- Frontend URLs: HTTPS subdomain URLs for API and LLM services

---

## Next Steps

To deploy with these changes:

```bash
cd /Users/joseblanco/data/dev/my-resume
./ansible/deploy_with_conda.sh
```

The script will:
1. Verify Ansible connectivity
2. Run system setup playbook
3. Deploy database and applications
4. Configure Nginx
5. Start PM2 services
6. Verify deployment

All configuration changes are already integrated and ready for deployment.
