# Hybrid Cloud Deployment Guide
## AWS Frontend + Home GPU Cluster

This guide shows how to deploy your app with:
- **AWS**: Frontend (CloudFront+S3) + API Service (ECS Fargate) + Database (RDS)
- **Home**: LLM Service running on 3x RTX 3090 GPUs

## Cost Comparison

| Component | AWS GPU | Home GPU | Savings |
|-----------|---------|----------|---------|
| Frontend (CloudFront+S3) | $10/mo | $10/mo | - |
| API (ECS Fargate 2 tasks) | $50/mo | $50/mo | - |
| Database (RDS t4g.small) | $50/mo | $50/mo | - |
| LLM GPU Instances | $180-300/mo | $0/mo | **$180-300** |
| Electricity (1200W) | - | $150-200/mo | - |
| **Total** | **$290-410/mo** | **$260-310/mo** | **~$80-100/mo** |

**Additional benefits:**
- You own the GPUs (no rental)
- Can run larger models (70B+)
- 72GB VRAM vs 16GB on AWS
- Upgrade anytime

## Architecture

```
User Browser
    ↓
[AWS CloudFront] → S3 (Frontend)
    ↓
[AWS ALB] → ECS Fargate (API Service)
    ↓                    ↓
[AWS RDS]          Internet
                        ↓
                [Cloudflare Tunnel]
                        ↓
                  [Your Home]
                        ↓
                   [HAProxy]
                    ↓  ↓  ↓
                  GPU0 GPU1 GPU2
                   (Ollama instances)
```

## Prerequisites

### Home Setup
- 3x RTX 3090 GPUs
- Ubuntu 20.04+ or similar
- 100Mbps+ upload internet
- Static IP or dynamic DNS (recommended)

### AWS Setup
- AWS account with CLI configured
- Route 53 domain (optional but recommended)
- Cloudflare account (free tier works)

### Tools
```bash
# Install AWS CDK
npm install -g aws-cdk

# Install Python dependencies
pip install aws-cdk-lib constructs boto3
```

## Step-by-Step Deployment

### Phase 1: Home GPU Cluster Setup

#### 1.1 Install NVIDIA Drivers
```bash
sudo apt update
sudo apt install nvidia-driver-535 nvidia-cuda-toolkit
nvidia-smi  # Verify installation
```

#### 1.2 Install Ollama
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

#### 1.3 Setup Multi-GPU Cluster
```bash
cd /path/to/my-resume/home-gpu-setup
sudo chmod +x setup-multi-gpu.sh
sudo ./setup-multi-gpu.sh
```

This creates:
- 3 Ollama services (GPU 0-2)
- HAProxy load balancer on port 11430
- Systemd services for auto-start

#### 1.4 Pull Models
```bash
# Pull large model on all GPUs (takes ~1 hour)
CUDA_VISIBLE_DEVICES=0 ollama pull llama3.1:70b
CUDA_VISIBLE_DEVICES=1 ollama pull llama3.1:70b
CUDA_VISIBLE_DEVICES=2 ollama pull llama3.1:70b

# Or different models per GPU
CUDA_VISIBLE_DEVICES=0 ollama pull llama3.1:70b
CUDA_VISIBLE_DEVICES=1 ollama pull codellama:34b
CUDA_VISIBLE_DEVICES=2 ollama pull gemma3:27b
```

#### 1.5 Test Local Cluster
```bash
# Test individual GPUs
curl http://localhost:11434/api/tags  # GPU 0
curl http://localhost:11435/api/tags  # GPU 1
curl http://localhost:11436/api/tags  # GPU 2

# Test load balancer
curl http://localhost:11430/api/tags

# Test chat
curl -X POST http://localhost:11430/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.1:70b",
    "prompt": "Hello!",
    "stream": false
  }'
```

### Phase 2: Cloudflare Tunnel Setup

#### 2.1 Install cloudflared
```bash
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

#### 2.2 Authenticate with Cloudflare
```bash
cloudflared tunnel login
# Opens browser - login to your Cloudflare account
```

#### 2.3 Create Tunnel
```bash
cloudflared tunnel create home-llm-cluster
# Save the tunnel ID shown
```

#### 2.4 Configure Tunnel
```bash
# Edit the config file
sudo nano /etc/cloudflared/config.yml
```

Paste this configuration:
```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /root/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: llm.yourdomain.com
    service: http://localhost:11430
    originRequest:
      connectTimeout: 60s
      keepAliveConnections: 100
      keepAliveTimeout: 90s
  
  - service: http_status:404
```

#### 2.5 Create DNS Record
```bash
cloudflared tunnel route dns home-llm-cluster llm.yourdomain.com
```

#### 2.6 Start Tunnel Service
```bash
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
sudo systemctl status cloudflared
```

#### 2.7 Test Remote Access
```bash
# From any computer (not home network)
curl https://llm.yourdomain.com/api/tags
```

### Phase 3: AWS Infrastructure Deployment

#### 3.1 Configure CDK
```bash
cd infra/

# Edit cdk.json to add context
nano cdk.json
```

Add this to cdk.json:
```json
{
  "app": "python3 app.py",
  "context": {
    "home_llm_url": "https://llm.yourdomain.com",
    "domain_name": "yourdomain.com"
  }
}
```

#### 3.2 Build Docker Images
```bash
# Build API service
cd ../apps/api-service
docker build -t my-resume-api .

# Return to infra
cd ../../infra
```

#### 3.3 Bootstrap AWS CDK
```bash
cdk bootstrap aws://ACCOUNT-NUMBER/REGION
```

#### 3.4 Deploy Stack
```bash
# Synthesize CloudFormation template
cdk synth

# Deploy (takes ~15-20 minutes)
cdk deploy --all --require-approval never
```

#### 3.5 Get Outputs
```bash
# After deployment completes, note these outputs:
# - FrontendURL (CloudFront URL)
# - APIURL (Load Balancer URL)
# - DatabaseEndpoint (RDS endpoint)
```

### Phase 4: Configure API Service

#### 4.1 Update Environment Variables
The CDK stack automatically configures:
- `LLM_SERVICE_URL=https://llm.yourdomain.com`
- `LLAMA_SERVER_URL=https://llm.yourdomain.com`
- `DATABASE_URL` (from RDS)

#### 4.2 Run Database Migrations
```bash
# Connect to ECS task
aws ecs execute-command \
  --cluster YourClusterName \
  --task TASK_ID \
  --container api-service \
  --command "/bin/bash" \
  --interactive

# Inside container
npx prisma migrate deploy
npx prisma db seed  # If you have seed data
```

### Phase 5: Monitoring Setup

#### 5.1 Install Monitoring Script
```bash
# On home GPU server
cd /path/to/my-resume/home-gpu-setup/scripts
pip install boto3 requests

# Configure AWS credentials
aws configure
```

#### 5.2 Run Monitoring as Service
```bash
sudo nano /etc/systemd/system/gpu-monitoring.service
```

Paste:
```ini
[Unit]
Description=GPU Cluster Monitoring
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/path/to/my-resume/home-gpu-setup/scripts
ExecStart=/usr/bin/python3 cloudwatch-metrics.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Start service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable gpu-monitoring
sudo systemctl start gpu-monitoring
```

#### 5.3 Create CloudWatch Dashboard
```bash
# In AWS Console:
# CloudWatch → Dashboards → Create dashboard
# Add widgets for:
# - GPU Temperature
# - GPU Utilization
# - Memory Utilization
# - Service Health
```

## Testing End-to-End

### 1. Test Frontend
```bash
open https://YOUR_CLOUDFRONT_URL
```

### 2. Test API
```bash
curl https://YOUR_CLOUDFRONT_URL/api/health
```

### 3. Test Chat Flow
```bash
# Frontend → AWS API → Home LLM
# Open chat widget in browser and ask a question
```

### 4. Monitor GPUs
```bash
# On home server
watch -n 1 nvidia-smi
```

## Performance Tuning

### Home Network Optimization
```bash
# Check upload speed
speedtest-cli --upload

# Optimize TCP settings
sudo sysctl -w net.ipv4.tcp_window_scaling=1
sudo sysctl -w net.core.rmem_max=134217728
sudo sysctl -w net.core.wmem_max=134217728
```

### AWS API Service Tuning
```bash
# Increase ECS task count during high load
aws ecs update-service \
  --cluster your-cluster \
  --service api-service \
  --desired-count 4
```

## Failover Strategy

### If Home Internet Goes Down

**Option 1: AWS GPU Fallback**
```bash
# Deploy a backup g4dn.xlarge EC2 instance
# Update API service to failover:
LLM_FALLBACK_ENABLED=true
LLM_FALLBACK_URL=http://aws-backup-llm:5000
```

**Option 2: Temporarily Disable Chat**
```bash
# Update frontend to show "Chat temporarily unavailable"
```

## Cost Optimization

### 1. Schedule GPU Instances
```bash
# Create cron job to stop/start Ollama during off-hours
# Save ~40% on electricity

# Stop at 2 AM
0 2 * * * sudo systemctl stop ollama-gpu0 ollama-gpu1 ollama-gpu2

# Start at 8 AM
0 8 * * * sudo systemctl start ollama-gpu0 ollama-gpu1 ollama-gpu2
```

### 2. AWS Savings Plans
```bash
# ECS Fargate Savings Plan: ~30% savings
# Reserved RDS Instance (1 year): ~35% savings
```

### 3. CloudFront Caching
```bash
# Increase cache TTL for static assets
# Reduces API calls and data transfer
```

## Security Checklist

- [ ] Enable Cloudflare Access for llm.yourdomain.com
- [ ] Whitelist only AWS IP ranges
- [ ] Enable AWS WAF on CloudFront
- [ ] Use Secrets Manager for all credentials
- [ ] Enable VPC Flow Logs
- [ ] Setup CloudWatch alarms
- [ ] Regular security updates on home server
- [ ] Enable fail2ban on home server
- [ ] Use strong passwords for HAProxy stats

## Maintenance

### Weekly Tasks
- Check GPU temperatures
- Review CloudWatch metrics
- Monitor internet bandwidth usage

### Monthly Tasks
- Update Ollama: `sudo ollama update`
- Update system packages: `sudo apt update && sudo apt upgrade`
- Review AWS costs
- Test failover scenarios

### Quarterly Tasks
- Pull new LLM models
- Review and optimize costs
- Update CDK stacks

## Troubleshooting

See [home-gpu-setup/README.md](../home-gpu-setup/README.md) for detailed troubleshooting.

## Next Steps

1. ✅ Deploy Phase 1-5
2. 📊 Setup monitoring dashboard
3. 🧪 Load testing
4. 🔒 Security hardening
5. 📈 Performance optimization
