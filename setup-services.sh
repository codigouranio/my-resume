#!/bin/bash
# Setup script to configure all services for auto-start on boot

echo "Creating systemd services..."

# 1. Create LLM Service
sudo tee /etc/systemd/system/llm-service.service > /dev/null << 'EOF'
[Unit]
Description=LLM Flask Service
After=network.target vllm.service

[Service]
Type=simple
User=jose
WorkingDirectory=/opt/my-resume/apps/llm-service
Environment="PATH=/home/jose/miniconda3/bin:/usr/bin"
ExecStart=/home/jose/miniconda3/bin/python3 app_remote.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 2. Fix PM2 Service
sudo tee /etc/systemd/system/pm2-jose.service > /dev/null << 'EOF'
[Unit]
Description=PM2 process manager
After=network.target

[Service]
Type=forking
User=jose
LimitNOFILE=infinity
LimitNPROC=infinity
Environment=PATH=/home/jose/.npm-global/bin:/usr/bin:/bin
Environment=PM2_HOME=/home/jose/.pm2
PIDFile=/home/jose/.pm2/pm2.pid
Restart=on-failure

ExecStart=/home/jose/.npm-global/bin/pm2 resurrect
ExecReload=/home/jose/.npm-global/bin/pm2 reload all
ExecStop=/home/jose/.npm-global/bin/pm2 kill

[Install]
WantedBy=multi-user.target
EOF

# 3. Reload systemd
echo "Reloading systemd..."
sudo systemctl daemon-reload

# 4. Enable all services
echo "Enabling services for auto-start..."
sudo systemctl enable vllm
sudo systemctl enable llm-service
sudo systemctl enable pm2-jose

# 5. Stop old processes
echo "Stopping old processes..."
killall -9 python3 2>/dev/null || true

# 6. Start all services
echo "Starting services..."
sudo systemctl start pm2-jose
sudo systemctl start llm-service
sudo systemctl start vllm

# 7. Check status
sleep 5
echo ""
echo "=== Service Status ==="
sudo systemctl status pm2-jose --no-pager -l | head -15
echo ""
sudo systemctl status llm-service --no-pager -l | head -15
echo ""
sudo systemctl status vllm --no-pager -l | head -15

echo ""
echo "✅ Done! All services configured for auto-start on boot."
echo ""
echo "Test commands:"
echo "  curl http://localhost:9000/v1/models    # vLLM"
echo "  curl http://localhost:5000/health       # LLM service"
echo "  curl http://localhost:3000/api/health   # API service"
