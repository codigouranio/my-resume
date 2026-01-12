#!/bin/bash
# Fix Cloudflare Tunnel Configuration
# Run this script to create a proper config file for the tunnel

cat << 'EOF'
╔══════════════════════════════════════════════════════════════════════════════╗
║                    Cloudflare Tunnel Configuration Fix                       ║
╚══════════════════════════════════════════════════════════════════════════════╝

The tunnel is running but failing because it doesn't know where to route traffic.

OPTION 1: Configure via Cloudflare Dashboard (RECOMMENDED)
═══════════════════════════════════════════════════════════════════════

1. Go to: https://one.dash.cloudflare.com/
2. Navigate to: Networks → Tunnels
3. Find your tunnel (should have a UUID)
4. Click "Configure"
5. Go to "Public Hostnames" tab
6. Add a new public hostname:
   
   Subdomain: my-resume
   Domain: paskot.com
   Path: (leave empty)
   Service Type: HTTP
   URL: localhost:80
   
7. Save

The tunnel should connect automatically within 30 seconds.

OPTION 2: Create Config File (Advanced)
═══════════════════════════════════════════════════════════════════════

If you want to manage the tunnel via config file instead of the dashboard:

1. SSH to the server:
   ssh jose@172.16.23.127

2. Create config directory:
   sudo mkdir -p /etc/cloudflared

3. Create config file (you'll need the tunnel UUID and credentials):
   sudo nano /etc/cloudflared/config.yml

4. Add this content (replace TUNNEL_UUID):
   
   tunnel: TUNNEL_UUID
   credentials-file: /etc/cloudflared/TUNNEL_UUID.json
   
   ingress:
     - hostname: my-resume.paskot.com
       service: http://localhost:80
     - hostname: '*.my-resume.paskot.com'
       service: http://localhost:80
     - service: http_status:404

5. Update systemd service to use config:
   sudo nano /etc/systemd/system/cloudflared.service
   
   Change ExecStart line to:
   ExecStart=/usr/bin/cloudflared --no-autoupdate tunnel --config /etc/cloudflared/config.yml run

6. Restart:
   sudo systemctl daemon-reload
   sudo systemctl restart cloudflared

OPTION 3: Disable Tunnel and Use Direct Connection
═══════════════════════════════════════════════════════════════════════

If you don't need the tunnel, you can:

1. Stop the tunnel:
   ssh jose@172.16.23.127
   sudo systemctl stop cloudflared
   sudo systemctl disable cloudflared

2. Update DNS to point directly to server IP:
   A record: my-resume.paskot.com → 172.16.23.127

3. Nginx is already configured to accept connections on port 80

Current Status
═══════════════════════════════════════════════════════════════════════

✓ Cloudflared is installed and running
✓ Nginx is running and responding on localhost:80
✓ Application services (API, LLM, Frontend) are running
✗ Tunnel route is NOT configured (causes "control stream" errors)

Check Status:
  ssh jose@172.16.23.127 "curl -s http://localhost | head -5"

EOF
