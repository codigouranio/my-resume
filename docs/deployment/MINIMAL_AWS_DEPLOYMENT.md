# Minimal AWS Deployment - Frontend Only
## CloudFront + S3 for Static Assets, Everything Else at Home

This is the **most cost-effective** architecture for your resume app.

## Architecture

```
User Browser
    ↓
AWS CloudFront (Global CDN) → S3 Bucket (Frontend static files)
    ↓
Cloudflare Tunnel (Free)
    ↓
Home Server (One Machine)
    ├── Nginx (Reverse Proxy)
    │   ├── Port 3000 → API Service (NestJS + Prisma)
    │   ├── Port 5000 → LLM Service (Flask)
    │   └── Port 5432 → PostgreSQL
    │
    └── GPU Cluster
        ├── GPU 0: Ollama (Port 11434)
        ├── GPU 1: Ollama (Port 11435)
        ├── GPU 2: Ollama (Port 11436)
        └── HAProxy Load Balancer (Port 11430)
```

## Cost Breakdown

| Component | Cost | Notes |
|-----------|------|-------|
| **AWS CloudFront** | $3-5/mo | 50GB transfer, 1M requests |
| **AWS S3** | $1-2/mo | Storage for frontend dist |
| **Cloudflare Tunnel** | $0 | Free tier |
| **Home Electricity** | $150-200/mo | 3 GPUs + server (1200W) |
| **Home Internet** | $50-100/mo | Dedicated line recommended |
| **Total** | **$204-307/mo** | vs $400-600 all-AWS |

**Annual savings: ~$2,000-3,500**

## Prerequisites

### Home Server Requirements
- **OS:** Ubuntu 20.04+ / Debian 11+
- **CPU:** 16+ cores recommended
- **RAM:** 64GB+ (32GB minimum)
- **Storage:** 1TB+ NVMe SSD
- **GPUs:** 3x RTX 3090 (or similar)
- **Network:** 100Mbps+ upload speed (500Mbps+ recommended)
- **Power:** UPS recommended for power outages

### AWS Account
- AWS CLI configured
- S3 and CloudFront access

### Domain
- Domain registered (use Cloudflare as DNS)

## Step-by-Step Setup

### Phase 1: Home Server Setup

#### 1.1 Install Base System
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essentials
sudo apt install -y \
  build-essential \
  git \
  curl \
  wget \
  htop \
  nginx \
  postgresql \
  postgresql-contrib
```

#### 1.2 Setup NVIDIA Drivers & Ollama
```bash
# Install NVIDIA drivers
sudo apt install -y nvidia-driver-535 nvidia-cuda-toolkit

# Verify GPUs
nvidia-smi

# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh
```

#### 1.3 Setup Multi-GPU Ollama Cluster
```bash
cd /path/to/my-resume/home-gpu-setup
sudo chmod +x setup-multi-gpu.sh
sudo ./setup-multi-gpu.sh
```

#### 1.4 Pull LLM Models
```bash
# Pull models on each GPU (choose one strategy)

# Strategy A: Same model for load balancing
CUDA_VISIBLE_DEVICES=0 ollama pull llama3.1:70b
CUDA_VISIBLE_DEVICES=1 ollama pull llama3.1:70b
CUDA_VISIBLE_DEVICES=2 ollama pull llama3.1:70b

# Strategy B: Different models per GPU
CUDA_VISIBLE_DEVICES=0 ollama pull llama3.1:70b  # Main chat
CUDA_VISIBLE_DEVICES=1 ollama pull codellama:34b # Code questions
CUDA_VISIBLE_DEVICES=2 ollama pull gemma3:27b    # Backup/fast
```

#### 1.5 Setup PostgreSQL Database
```bash
# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql <<EOF
CREATE DATABASE resume_db;
CREATE USER resume_user WITH PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE resume_db TO resume_user;
\q
EOF

# Allow local connections
sudo nano /etc/postgresql/15/main/pg_hba.conf
# Add: host    resume_db    resume_user    127.0.0.1/32    md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

#### 1.6 Setup Node.js (for API Service)
```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version  # Should show v20.x
npm --version
```

#### 1.7 Clone and Setup Application
```bash
# Clone repository
cd /opt
sudo git clone https://github.com/codigouranio/my-resume.git
sudo chown -R $USER:$USER my-resume
cd my-resume

# Install API Service dependencies
cd apps/api-service
npm install

# Create .env file
cat > .env <<EOF
DATABASE_URL=postgresql://resume_user:your-password@localhost:5432/resume_db
JWT_SECRET=$(openssl rand -hex 32)
PORT=3000
NODE_ENV=production
LLM_SERVICE_URL=http://localhost:5000
EOF

# Run Prisma migrations
npx prisma migrate deploy
npx prisma generate

# Build API
npm run build

# Test API
npm run start:prod &
curl http://localhost:3000/health
```

#### 1.8 Setup LLM Service
```bash
cd /opt/my-resume/apps/llm-service

# Install Python dependencies
pip install -r requirements.txt

# Create .env file
cat > .env <<EOF
PORT=5000
LLAMA_SERVER_URL=http://localhost:11430
LLAMA_API_TYPE=ollama
OLLAMA_MODEL=llama3.1:70b
DATABASE_URL=postgresql://resume_user:your-password@localhost:5432/resume_db
ADMIN_TOKEN=$(openssl rand -hex 32)
EOF

# Test LLM service
python app_remote.py &
curl http://localhost:5000/health
```

#### 1.9 Setup PM2 Process Manager
```bash
# Install PM2
sudo npm install -g pm2

# Create ecosystem file
cat > /opt/my-resume/ecosystem.config.js <<'EOF'
module.exports = {
  apps: [
    {
      name: 'api-service',
      cwd: '/opt/my-resume/apps/api-service',
      script: 'npm',
      args: 'run start:prod',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'llm-service',
      cwd: '/opt/my-resume/apps/llm-service',
      script: 'app_remote.py',
      interpreter: 'python3',
      instances: 1,
      env: {
        PORT: 5000
      }
    }
  ]
};
EOF

# Start services
cd /opt/my-resume
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Check status
pm2 status
pm2 logs
```

#### 1.10 Setup Nginx Reverse Proxy
```bash
sudo nano /etc/nginx/sites-available/my-resume
```

Paste this configuration:
```nginx
# API Service
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# LLM Service (optional, if you want direct access)
server {
    listen 80;
    server_name llm.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Long timeout for LLM responses
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/my-resume /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Phase 2: Cloudflare Tunnel Setup

#### 2.1 Install Cloudflared
```bash
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

#### 2.2 Authenticate and Create Tunnel
```bash
cloudflared tunnel login
cloudflared tunnel create home-backend
```

#### 2.3 Configure Tunnel
```bash
sudo mkdir -p /etc/cloudflared
sudo nano /etc/cloudflared/config.yml
```

Paste:
```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /root/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  # API Service
  - hostname: api.yourdomain.com
    service: http://localhost:80
    originRequest:
      connectTimeout: 60s
      noTLSVerify: false

  # Catch-all
  - service: http_status:404
```

#### 2.4 Create DNS Records
```bash
cloudflared tunnel route dns home-backend api.yourdomain.com
```

#### 2.5 Start Tunnel as Service
```bash
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
sudo systemctl status cloudflared
```

#### 2.6 Test API Access
```bash
# From any computer (not home network)
curl https://api.yourdomain.com/health
```

### Phase 3: AWS CloudFront + S3 Setup

#### 3.1 Build Frontend
```bash
cd /opt/my-resume/apps/my-resume

# Create production .env
cat > .env.production <<EOF
PUBLIC_API_URL=https://api.yourdomain.com/api
PUBLIC_LLM_API_URL=https://api.yourdomain.com/llm
EOF

# Build
npm install
npm run build

# Verify dist folder
ls -la dist/
```

#### 3.2 Deploy to S3 + CloudFront via CDK
```bash
cd /opt/my-resume/infra

# Update cdk.json
nano cdk.json
```

Add context:
```json
{
  "app": "python3 app.py",
  "context": {
    "@aws-cdk/core:newStyleStackSynthesis": true
  }
}
```

Update `app.py`:
```python
#!/usr/bin/env python3
from aws_cdk import App
from stacks.cloudfront_stack import CloudFrontStack

app = App()
CloudFrontStack(app, "MyResumeFrontend")
app.synth()
```

Deploy:
```bash
# Bootstrap (first time only)
cdk bootstrap

# Deploy
cdk deploy

# Note the CloudFront URL from outputs
```

#### 3.3 Update Frontend API URL
After deployment, if you get a CloudFront URL like `d123456789.cloudfront.net`:

```bash
# Update .env.production with actual API URL
cd /opt/my-resume/apps/my-resume
nano .env.production

# PUBLIC_API_URL=https://api.yourdomain.com/api
# PUBLIC_LLM_API_URL=https://api.yourdomain.com/llm

# Rebuild and redeploy
npm run build
cd ../../infra
cdk deploy
```

### Phase 4: Domain Configuration

#### 4.1 Setup Custom Domain for CloudFront
In AWS Console:
1. Request ACM certificate in **us-east-1** for `yourdomain.com`
2. Add CloudFront alternate domain name
3. Update Route 53 or Cloudflare DNS to point to CloudFront

#### 4.2 Complete DNS Setup
```
yourdomain.com         → CloudFront (Frontend)
api.yourdomain.com     → Cloudflare Tunnel → Home API
```

### Phase 5: Testing & Monitoring

#### 5.1 End-to-End Test
```bash
# Frontend
open https://yourdomain.com

# API
curl https://api.yourdomain.com/health

# Chat (from frontend)
# Open chat widget and ask a question
```

#### 5.2 Monitor Services
```bash
# PM2 Status
pm2 status
pm2 logs

# GPU Usage
watch -n 1 nvidia-smi

# HAProxy Stats
open http://localhost:9000/stats

# Nginx Logs
sudo tail -f /var/log/nginx/access.log
```

## Security Hardening

### 1. Firewall (UFW)
```bash
sudo apt install ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP (Nginx)
sudo ufw allow 443   # HTTPS (if using Certbot)
sudo ufw enable
```

### 2. Fail2Ban
```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

### 3. PostgreSQL Security
```bash
# Only allow localhost
sudo nano /etc/postgresql/15/main/postgresql.conf
# listen_addresses = 'localhost'

sudo systemctl restart postgresql
```

### 4. Rate Limiting in Nginx
Add to nginx config:
```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

server {
    location /api {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://localhost:3000;
    }
}
```

## Backup Strategy

### 1. Database Backups
```bash
# Create backup script
cat > /opt/my-resume/backup-db.sh <<'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/postgres"
mkdir -p $BACKUP_DIR
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U resume_user resume_db | gzip > $BACKUP_DIR/resume_db_$DATE.sql.gz
# Keep last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
EOF

chmod +x /opt/my-resume/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
# 0 2 * * * /opt/my-resume/backup-db.sh
```

### 2. Sync to Cloud (Optional)
```bash
# Install rclone
curl https://rclone.org/install.sh | sudo bash

# Configure S3 or Google Drive
rclone config

# Sync backups
rclone sync /opt/backups/postgres remote:backups/postgres
```

## Troubleshooting

### API Service Won't Start
```bash
pm2 logs api-service
# Check DATABASE_URL in .env
# Check PostgreSQL is running: sudo systemctl status postgresql
```

### LLM Service Slow
```bash
# Check GPU usage
nvidia-smi

# Check Ollama instances
sudo systemctl status ollama-gpu0
curl http://localhost:11434/api/tags
```

### Cloudflare Tunnel Down
```bash
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -n 50

# Restart tunnel
sudo systemctl restart cloudflared
```

## Maintenance

### Weekly
- Check PM2 logs: `pm2 logs`
- Monitor GPU temps: `nvidia-smi`
- Check disk space: `df -h`

### Monthly
- Update system: `sudo apt update && sudo apt upgrade`
- Update Ollama: `sudo ollama update`
- Review backup sizes

### Quarterly
- Test database restore from backup
- Update LLM models
- Review CloudWatch costs

## Cost Optimization

### 1. CloudFront Caching
```javascript
// In Rsbuild config
export default {
  output: {
    assetPrefix: 'https://yourdomain.com/',
    filename: {
      js: 'static/js/[name].[contenthash:8].js',
      css: 'static/css/[name].[contenthash:8].css',
    }
  }
};
```

### 2. GPU Power Management
```bash
# Reduce GPU power limit during idle hours
nvidia-smi -i 0 -pl 250  # Reduce from 350W to 250W
```

### 3. Schedule API Service
```bash
# If your users are only in specific timezones
# Stop services during night hours to save power

# Crontab
0 2 * * * pm2 stop api-service llm-service
0 8 * * * pm2 start api-service llm-service
```

## Next Steps

1. ✅ Setup home server with all services
2. ✅ Configure Cloudflare Tunnel
3. ✅ Deploy frontend to CloudFront
4. ✅ Test end-to-end
5. 📊 Setup monitoring
6. 🔐 Security hardening
7. 💾 Configure backups

**Total Setup Time:** 3-4 hours

**Monthly Cost:** $155-210 (vs $400-600 all-AWS)

**Annual Savings:** ~$2,000-3,500
