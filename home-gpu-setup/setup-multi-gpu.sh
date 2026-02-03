#!/bin/bash
# Multi-GPU Ollama Setup Script for 3x RTX 3090
# This script sets up 3 separate Ollama instances, one per GPU, with HAProxy load balancer

set -e

echo "🚀 Setting up Multi-GPU Ollama Cluster"
echo "======================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (sudo)"
    exit 1
fi

# Check NVIDIA drivers
echo "🔍 Checking NVIDIA drivers..."
if ! command -v nvidia-smi &> /dev/null; then
    echo "❌ NVIDIA drivers not found. Please install nvidia-driver-535 first."
    exit 1
fi

GPU_COUNT=$(nvidia-smi --list-gpus | wc -l)
echo "✅ Found $GPU_COUNT GPUs"

if [ "$GPU_COUNT" -lt 3 ]; then
    echo "⚠️  Warning: Expected 3 GPUs, found $GPU_COUNT"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create directories
echo "📁 Creating directories..."
mkdir -p /opt/ollama/{gpu0,gpu1,gpu2}
mkdir -p /var/log/ollama
mkdir -p /etc/systemd/system

# Install HAProxy
echo "📦 Installing HAProxy..."
apt update
apt install -y haproxy

# Create systemd service for each GPU
echo "⚙️  Creating systemd services..."

for i in {0..2}; do
    PORT=$((11434 + i))
    
    cat > "/etc/systemd/system/ollama-gpu${i}.service" <<EOF
[Unit]
Description=Ollama Service on GPU ${i}
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ollama/gpu${i}
Environment="OLLAMA_HOST=0.0.0.0:${PORT}"
Environment="CUDA_VISIBLE_DEVICES=${i}"
Environment="OLLAMA_MODELS=/opt/ollama/gpu${i}/models"
ExecStart=/usr/local/bin/ollama serve
Restart=always
RestartSec=10
StandardOutput=append:/var/log/ollama/gpu${i}.log
StandardError=append:/var/log/ollama/gpu${i}.error.log

[Install]
WantedBy=multi-user.target
EOF

    echo "✅ Created service: ollama-gpu${i}.service"
done

# Configure HAProxy
echo "⚙️  Configuring HAProxy load balancer..."

cat > /etc/haproxy/haproxy.cfg <<'EOF'
global
    log /dev/log local0
    log /dev/log local1 notice
    chroot /var/lib/haproxy
    stats socket /run/haproxy/admin.sock mode 660 level admin
    stats timeout 30s
    user haproxy
    group haproxy
    daemon

defaults
    log     global
    mode    http
    option  httplog
    option  dontlognull
    timeout connect 60s
    timeout client  300s
    timeout server  300s
    timeout tunnel  3600s

# Statistics page
listen stats
    bind *:9000
    stats enable
    stats uri /stats
    stats refresh 10s
    stats admin if TRUE
    stats auth admin:changeme

# Main load balancer frontend
frontend llm-frontend
    bind *:11430
    default_backend llm-backend
    
    # CORS headers
    http-response add-header Access-Control-Allow-Origin "*"
    http-response add-header Access-Control-Allow-Methods "GET, POST, OPTIONS"
    http-response add-header Access-Control-Allow-Headers "Content-Type, Authorization"
    
    # Health check endpoint
    acl is_health path /health
    use_backend health-backend if is_health

# Backend with GPU instances
backend llm-backend
    balance roundrobin
    option httpchk GET /api/tags
    
    # GPU 0
    server gpu0 127.0.0.1:11434 check inter 5s fall 3 rise 2
    
    # GPU 1
    server gpu1 127.0.0.1:11435 check inter 5s fall 3 rise 2
    
    # GPU 2
    server gpu2 127.0.0.1:11436 check inter 5s fall 3 rise 2

# Health check backend
backend health-backend
    http-request return status 200 content-type text/plain string "OK"
EOF

echo "✅ HAProxy configuration created"

# Reload systemd
echo "🔄 Reloading systemd..."
systemctl daemon-reload

# Start services
echo "🚀 Starting services..."
for i in {0..2}; do
    systemctl enable ollama-gpu${i}
    systemctl start ollama-gpu${i}
    echo "✅ Started ollama-gpu${i}"
done

# Start HAProxy
systemctl enable haproxy
systemctl restart haproxy
echo "✅ Started HAProxy"

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check status
echo ""
echo "📊 Service Status:"
echo "=================="
for i in {0..2}; do
    if systemctl is-active --quiet ollama-gpu${i}; then
        echo "✅ ollama-gpu${i}: RUNNING"
    else
        echo "❌ ollama-gpu${i}: FAILED"
    fi
done

if systemctl is-active --quiet haproxy; then
    echo "✅ haproxy: RUNNING"
else
    echo "❌ haproxy: FAILED"
fi

# Test load balancer
echo ""
echo "🧪 Testing load balancer..."
if curl -s http://localhost:11430/api/tags > /dev/null 2>&1; then
    echo "✅ Load balancer is responding"
else
    echo "⚠️  Load balancer test failed (this is normal if no models are loaded yet)"
fi

echo ""
echo "✅ Setup Complete!"
echo ""
echo "📝 Next Steps:"
echo "1. Pull models on each GPU:"
echo "   CUDA_VISIBLE_DEVICES=0 ollama pull llama3.1:70b"
echo "   CUDA_VISIBLE_DEVICES=1 ollama pull llama3.1:70b"
echo "   CUDA_VISIBLE_DEVICES=2 ollama pull llama3.1:70b"
echo ""
echo "2. Test individual GPUs:"
echo "   curl http://localhost:11434/api/tags  # GPU 0"
echo "   curl http://localhost:11435/api/tags  # GPU 1"
echo "   curl http://localhost:11436/api/tags  # GPU 2"
echo ""
echo "3. Test load balancer:"
echo "   curl http://localhost:11430/api/tags"
echo ""
echo "4. View HAProxy stats:"
echo "   http://localhost:9000/stats (admin/changeme)"
echo ""
echo "5. View logs:"
echo "   journalctl -u ollama-gpu0 -f"
echo "   journalctl -u ollama-gpu1 -f"
echo "   journalctl -u ollama-gpu2 -f"
echo ""
echo "6. Monitor GPUs:"
echo "   watch -n 1 nvidia-smi"
