# Home GPU Cluster Setup for LLM Service

## Overview

Run Ollama on 3x RTX 3090 GPUs at home and expose via Cloudflare Tunnel to AWS.

## Hardware Specs

- **GPUs:** 3x NVIDIA RTX 3090 (24GB VRAM each = 72GB total)
- **Recommended System:**
  - CPU: 16+ cores
  - RAM: 64GB+
  - Storage: 1TB+ NVMe (for model storage)
  - Network: 100Mbps+ upload speed

## Architecture

```
Home Network
├── Router/Firewall
└── GPU Server
    ├── Ollama Instance 1 (GPU 0) - Port 11434
    ├── Ollama Instance 2 (GPU 1) - Port 11435
    ├── Ollama Instance 3 (GPU 2) - Port 11436
    ├── HAProxy Load Balancer - Port 11430
    └── Cloudflare Tunnel
            ↓
        Internet
            ↓
    AWS ECS (API Service)
```

## Models You Can Run

With 72GB total VRAM:

### **Option A: Different Models per GPU**
- GPU 0: `llama3.1:70b` (40GB) - Chat
- GPU 1: `codellama:34b` (19GB) - Code
- GPU 2: `gemma3:27b` (17GB) - Lightweight

### **Option B: Same Model for Load Balancing**
- All GPUs: `llama3.1:70b` - High throughput

### **Option C: Mixed Use**
- GPU 0+1: `llama3.1:70b` (load balanced)
- GPU 2: `codellama:34b` (code tasks)

## Setup Steps

### 1. Install NVIDIA Drivers & CUDA

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nvidia-driver-535 nvidia-cuda-toolkit

# Verify
nvidia-smi
```

### 2. Install Ollama (Multi-GPU)

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull models
ollama pull llama3.1:70b
ollama pull codellama:34b
ollama pull gemma3:27b

# Verify
ollama list
```

### 3. Configure Multi-GPU Setup

Use the provided scripts:

```bash
cd home-gpu-setup/
chmod +x setup-multi-gpu.sh
./setup-multi-gpu.sh
```

This creates:
- 3 Ollama systemd services (one per GPU)
- HAProxy load balancer
- Health check monitoring

### 4. Install Cloudflare Tunnel

```bash
# Install cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create home-llm-cluster

# Configure tunnel (see config/cloudflare-tunnel.yml)
sudo cp config/cloudflare-tunnel.yml /etc/cloudflared/config.yml

# Create DNS record
cloudflared tunnel route dns home-llm-cluster llm.yourdomain.com

# Start as service
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

### 5. Test Connection

```bash
# Local test
curl http://localhost:11430/api/tags

# Remote test (from AWS or anywhere)
curl https://llm.yourdomain.com/api/tags

# Chat test
curl -X POST https://llm.yourdomain.com/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.1:70b",
    "prompt": "Hello, world!",
    "stream": false
  }'
```

## Performance Expectations

### **Latency:**
- Local network: ~50-200ms
- Via Cloudflare Tunnel: ~100-300ms (depends on your upload speed)
- Acceptable for chatbot use case

### **Throughput:**
- Single GPU: ~20-30 tokens/sec (70B model)
- Load balanced: ~60-90 tokens/sec
- Concurrent users: 10-20 per GPU = 30-60 total

### **Network Requirements:**
- Upload speed: 100Mbps minimum, 500Mbps+ recommended
- Monthly data: ~50-200GB (depends on usage)

## Security

### **Cloudflare Tunnel Benefits:**
- ✅ No open ports on home network
- ✅ DDoS protection
- ✅ Automatic HTTPS
- ✅ Access control via Cloudflare Access (optional)

### **Additional Security:**
1. **API Authentication:**
   ```bash
   # Add auth token to HAProxy config
   export LLM_AUTH_TOKEN=$(openssl rand -hex 32)
   ```

2. **IP Whitelisting:**
   ```bash
   # Restrict to AWS IP ranges only
   # Configure in Cloudflare dashboard
   ```

3. **Rate Limiting:**
   ```bash
   # HAProxy rate limiting (in haproxy.cfg)
   stick-table type ip size 100k expire 30s store http_req_rate(10s)
   http-request track-sc0 src
   http-request deny if { sc_http_req_rate(0) gt 100 }
   ```

## Monitoring

### **GPU Monitoring:**
```bash
# Real-time GPU stats
watch -n 1 nvidia-smi

# Or install nvtop
sudo apt install nvtop
nvtop
```

### **HAProxy Stats:**
```bash
# Web UI: http://localhost:9000/stats
# Username: admin
# Password: (set in haproxy.cfg)
```

### **CloudWatch Integration:**
```bash
# Send metrics to AWS CloudWatch
# See scripts/cloudwatch-metrics.py
```

## Power & Cooling

**Power Consumption:**
- 3x RTX 3090: ~1050W (350W each)
- System: ~150W
- Total: ~1200W (~$150-200/month at $0.12/kWh)

**Cooling:**
- Ensure good airflow
- Room temperature: <25°C recommended
- Consider server rack or open-air case

## Backup Plan

**If home internet goes down:**
```bash
# Option 1: Failover to AWS GPU
aws ecs update-service --cluster my-cluster \
  --service api-service \
  --task-definition api-with-gpu-fallback

# Option 2: Mobile hotspot as backup
# Configure secondary Cloudflare Tunnel via 4G/5G
```

## Cost Analysis

### **Home Setup:**
- Electricity: ~$150-200/month (1200W @ $0.12/kWh)
- Internet (dedicated line): ~$50-100/month
- **Total: ~$200-300/month**

### **AWS Equivalent:**
- 3x g5.xlarge (A10G GPU): ~$900/month
- Or 2x g5.2xlarge: ~$1200/month
- **Savings: ~$600-900/month**

### **Break-even:**
- If you already own the GPUs: **Immediate savings**
- If buying new: ~15-20 months to ROI

## Troubleshooting

### **High Latency:**
```bash
# Test network path
traceroute llm.yourdomain.com

# Check Cloudflare tunnel
cloudflared tunnel info home-llm-cluster

# Optimize HAProxy buffer
# Edit haproxy.cfg: tune.bufsize 32768
```

### **GPU Out of Memory:**
```bash
# Check model memory usage
curl http://localhost:11434/api/show -d '{"name":"llama3.1:70b"}' | jq .size

# Clear GPU memory
sudo systemctl restart ollama-gpu0
```

### **Connection Refused:**
```bash
# Check Cloudflare tunnel
sudo systemctl status cloudflared

# Check HAProxy
sudo systemctl status haproxy

# Check Ollama instances
sudo systemctl status ollama-gpu0
sudo systemctl status ollama-gpu1
sudo systemctl status ollama-gpu2
```

## Next Steps

1. ✅ Set up multi-GPU Ollama cluster
2. ✅ Configure Cloudflare Tunnel
3. ✅ Update AWS API service to use home LLM endpoint
4. ✅ Add monitoring and alerting
5. ✅ Test failover scenarios
