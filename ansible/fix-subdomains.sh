#!/bin/bash
# Quick fix for subdomain support without full redeployment

set -e

SERVER="jose@172.16.23.127"
DOMAIN="resumecast.ai"

echo "🔧 Fixing custom subdomain support..."

# Step 1: Update frontend .env
echo "📝 Updating frontend .env..."
ssh $SERVER "cat > /opt/my-resume/apps/my-resume/.env << 'EOF'
PUBLIC_API_URL=/api
PUBLIC_LLM_API_URL=/llm
PUBLIC_BASE_DOMAIN=$DOMAIN
EOF"

# Step 2: Rebuild frontend
echo "🔨 Rebuilding frontend..."
ssh $SERVER 'source /opt/miniconda3/etc/profile.d/conda.sh && conda activate /opt/my-resume/apps/my-resume/conda-env && cd /opt/my-resume/apps/my-resume && npm run build'

# Step 3: Create temporary nginx config with subdomain support
echo "🌐 Updating nginx configuration..."
ssh $SERVER "cat > /tmp/nginx-myresume.conf << 'NGINXEOF'
# Frontend - Serve built React app
server {
    listen 80;
    server_name $DOMAIN *.$DOMAIN 172.16.23.127;
    
    # Frontend static files
    location / {
        root /opt/my-resume/apps/my-resume/dist;
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control \"public, immutable\";
        }
    }
    
    # API Service proxy
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # GraphQL endpoint
    location /graphql {
        proxy_pass http://localhost:3000/graphql;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # LLM Service proxy
    location /llm/ {
        proxy_pass http://localhost:5000/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        
        # Longer timeout for LLM processing
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
    }
    
    # Security headers
    add_header X-Frame-Options \"SAMEORIGIN\" always;
    add_header X-Content-Type-Options \"nosniff\" always;
    add_header X-XSS-Protection \"1; mode=block\" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;
}
NGINXEOF"

# Note: User needs sudo to update nginx config
echo ""
echo "⚠️  Manual step required (sudo access needed):"
echo ""
echo "Run these commands on the server:"
echo "  ssh $SERVER"
echo "  sudo cp /tmp/nginx-myresume.conf /etc/nginx/sites-available/myresume"
echo "  sudo nginx -t"
echo "  sudo systemctl reload nginx"
echo ""
echo "✅ Frontend rebuilt with subdomain support"
echo "📋 Nginx config prepared at /tmp/nginx-myresume.conf"
echo ""
echo "Or use ansible to deploy everything:"
echo "  cd ansible && ./deploy_with_conda.sh"
