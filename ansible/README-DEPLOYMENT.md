# Comprehensive Ansible Deployment Guide

## 🎯 Overview

This Ansible deployment system provides a complete, production-ready infrastructure for deploying the My Resume application to multiple servers with:

- ✅ **Zero-downtime deployments**
- ✅ **Automated database migrations**
- ✅ **Secure credential management (ansible-vault)**
- ✅ **CloudFlare integration**
- ✅ **Automated backups**
- ✅ **Health checks and monitoring**
- ✅ **Multi-server support**

## 📁 Directory Structure

```
ansible/
├── group_vars/
│   └── all.yml                    # Global variables for all hosts
├── playbooks/
│   ├── 00-prerequisites.yml       # Check requirements
│   ├── 01-system-setup.yml        # Install base system packages
│   ├── 02-database-setup.yml      # Configure PostgreSQL
│   ├── 03-application-deploy.yml  # Deploy application
│   ├── 04-nginx-setup.yml         # Configure web server
│   └── 05-update.yml              # Quick code updates
├── templates/
│   ├── ecosystem.config.js.j2     # PM2 configuration template
│   └── nginx.conf.j2              # Nginx configuration template
├── inventory-production.yml       # Production servers inventory
├── deploy-full.sh                 # Complete deployment script
├── update-quick.sh                # Quick update script
├── status.sh                      # Check service status
├── logs.sh                        # View application logs
└── backup.sh                      # Backup databases
```

## 🚀 Quick Start

### 1. Install Ansible (Control Machine)

```bash
# macOS
brew install ansible

# Ubuntu/Debian
sudo apt update
sudo apt install ansible

# Python (any OS)
pip install ansible
```

### 2. Configure Inventory

Copy and edit the inventory file:

```bash
cp inventory-production.yml my-inventory.yml
vim my-inventory.yml
```

Example inventory:

```yaml
all:
  children:
    production:
      hosts:
        server-1:
          ansible_host: 172.16.23.127
          ansible_user: jose
          domain: my-resume.paskot.com
          enable_cloudflare: true
        
        server-2:
          ansible_host: 172.16.23.128
          ansible_user: deploy
          domain: my-resume-backup.com
```

### 3. Configure Secrets (IMPORTANT!)

Use ansible-vault to encrypt sensitive data:

```bash
# Create encrypted password
ansible-vault encrypt_string 'your_db_password' --name 'vault_db_password'

# Create encrypted JWT secret
ansible-vault encrypt_string 'your_jwt_secret_min_32_chars' --name 'vault_jwt_secret'

# Create encrypted LLM token
ansible-vault encrypt_string 'your_llm_token' --name 'vault_llm_admin_token'
```

Add the encrypted output to your inventory file:

```yaml
vars:
  vault_db_password: !vault |
    $ANSIBLE_VAULT;1.1;AES256
    <encrypted_content_here>
```

### 4. Test Connection

```bash
ansible -i my-inventory.yml all -m ping
```

Expected output:
```
server-1 | SUCCESS => {
    "changed": false,
    "ping": "pong"
}
```

### 5. Check Prerequisites

```bash
ansible-playbook -i my-inventory.yml playbooks/00-prerequisites.yml
```

This checks:
- SSH connectivity
- Sudo access
- Operating system compatibility
- Available disk space and memory
- Port availability
- Ollama installation status

### 6. Deploy Application

```bash
# Full deployment (all steps)
./deploy-full.sh

# Or run playbooks individually:
ansible-playbook -i my-inventory.yml playbooks/01-system-setup.yml
ansible-playbook -i my-inventory.yml playbooks/02-database-setup.yml
ansible-playbook -i my-inventory.yml playbooks/03-application-deploy.yml
ansible-playbook -i my-inventory.yml playbooks/04-nginx-setup.yml
```

## 📋 Configuration Variables

### Essential Variables (group_vars/all.yml)

```yaml
# Application
app_name: my-resume
repo_url: https://github.com/codigouranio/my-resume.git
repo_branch: main

# Database (use vault for passwords!)
db_name: resume_db
db_user: resume_user
db_password: "{{ vault_db_password }}"

# Security
jwt_secret: "{{ vault_jwt_secret }}"
llm_admin_token: "{{ vault_llm_admin_token }}"

# Services
api_port: 3000
llm_port: 5000
pm2_instances_api: 2

# CloudFlare
enable_cloudflare: true
cloudflare_real_ip: true  # Important for analytics!

# SSL
enable_ssl: false  # Set true for Let's Encrypt

# Backups
enable_backups: true
backup_retention_days: 7

# Security
enable_firewall: true
fail2ban_enabled: true
```

### Per-Host Variables (in inventory)

```yaml
hosts:
  my-server:
    ansible_host: 1.2.3.4
    ansible_user: deploy
    domain: example.com
    enable_ssl: true
    pm2_instances_api: 4  # More instances for powerful server
```

## 🔄 Daily Operations

### Update Application

```bash
# Quick update (pull code, rebuild, restart)
./update-quick.sh

# Or manually:
ansible-playbook -i my-inventory.yml playbooks/05-update.yml
```

### Check Status

```bash
# Check all services and system resources
./status.sh
```

### View Logs

```bash
# View PM2 logs from all servers
./logs.sh
```

### Backup Database

```bash
# Manual backup
./backup.sh

# Automatic daily backups are configured at 2:00 AM
```

### Restore Database

```bash
# On target server:
ssh user@server
/opt/backups/my-resume/restore-database.sh /opt/backups/my-resume/database/resume_db_20250129_020000.sql.gz
```

## 🎭 Multi-Server Deployment

### Load Balancing

Deploy to multiple servers for high availability:

```yaml
production:
  hosts:
    web-1:
      ansible_host: 10.0.1.10
      domain: api.example.com
    web-2:
      ansible_host: 10.0.1.11
      domain: api.example.com
    web-3:
      ansible_host: 10.0.1.12
      domain: api.example.com
```

### Rolling Updates

Update servers one at a time:

```bash
ansible-playbook -i inventory.yml playbooks/05-update.yml --serial 1
```

### Target Specific Servers

```bash
# Update only server-1
ansible-playbook -i inventory.yml playbooks/05-update.yml --limit server-1

# Update staging environment only
ansible-playbook -i inventory.yml playbooks/05-update.yml --limit staging
```

## 🔐 Security Best Practices

### 1. Use Ansible Vault

Never commit plain-text passwords:

```bash
# Create vault password file
echo "your-vault-password" > .vault_pass
chmod 600 .vault_pass

# Use it in deployments
ansible-playbook -i inventory.yml playbook.yml --vault-password-file .vault_pass
```

### 2. SSH Key Authentication

```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "deployment-key"

# Copy to servers
ssh-copy-id -i ~/.ssh/id_ed25519.pub user@server
```

### 3. Restrict SSH Access

In `group_vars/all.yml`:

```yaml
allowed_ssh_ips:
  - "1.2.3.4"      # Your office IP
  - "5.6.7.8"      # VPN IP
```

### 4. Enable Fail2ban

Automatically enabled by default. Configure in `/etc/fail2ban/jail.local` on servers.

## 🌐 CloudFlare Integration

### Why CloudFlare Headers?

CloudFlare provides geolocation data for FREE in request headers:
- `cf-ipcountry` - ISO country code
- `cf-ipcity` - City name
- `cf-connecting-ip` - Real visitor IP

### Enable CloudFlare Real IP

In inventory:

```yaml
cloudflare_real_ip: true
```

This configures Nginx to trust CloudFlare IPs and extract real visitor IPs for analytics.

## 📊 Monitoring

### Check Service Health

```bash
# PM2 status
ansible all -i inventory.yml -m shell -a "pm2 status" -b --become-user=jose

# System resources
ansible all -i inventory.yml -m shell -a "free -h && df -h" -b
```

### Application Logs

```bash
# API logs
ansible all -i inventory.yml -m shell -a "tail -100 /opt/my-resume/logs/api-out.log" -b

# Error logs
ansible all -i inventory.yml -m shell -a "tail -100 /opt/my-resume/logs/api-error.log" -b

# Nginx logs
ansible all -i inventory.yml -m shell -a "tail -100 /var/log/nginx/access.log" -b
```

## 🐛 Troubleshooting

### Services Won't Start

```bash
# Check PM2 logs
ansible all -i inventory.yml -m shell -a "pm2 logs --lines 100" -b --become-user=jose

# Check environment variables
ansible all -i inventory.yml -m shell -a "cat /opt/my-resume/apps/api-service/.env" -b --become-user=jose
```

### Database Connection Issues

```bash
# Test PostgreSQL
ansible all -i inventory.yml -m shell -a "sudo -u postgres psql -c '\l'" -b

# Check if database exists
ansible all -i inventory.yml -m shell -a "sudo -u postgres psql -lqt | cut -d \| -f 1 | grep resume_db" -b
```

### Nginx Issues

```bash
# Test configuration
ansible all -i inventory.yml -m shell -a "nginx -t" -b

# Check Nginx status
ansible all -i inventory.yml -m shell -a "systemctl status nginx" -b
```

### Port Conflicts

```bash
# Check what's using ports
ansible all -i inventory.yml -m shell -a "netstat -tlnp | grep -E ':(3000|5000|80|443)'" -b
```

## 📚 Playbook Reference

### 00-prerequisites.yml
- Verifies SSH connectivity
- Checks system requirements
- Validates Ollama installation
- Reports disk/memory availability

### 01-system-setup.yml
- Installs system packages
- Sets up PostgreSQL, Nginx
- Installs Miniconda
- Configures firewall (UFW)
- Installs Fail2ban

### 02-database-setup.yml
- Creates PostgreSQL user and database
- Configures database parameters
- Sets up backup scripts
- Creates daily backup cron job

### 03-application-deploy.yml
- Clones/updates repository
- Creates conda environments
- Installs dependencies
- Runs database migrations
- Builds applications
- Starts PM2 services

### 04-nginx-setup.yml
- Configures Nginx reverse proxy
- Sets up CloudFlare Real IP (if enabled)
- Obtains SSL certificates (if enabled)
- Configures log rotation

### 05-update.yml
- Pulls latest code
- Updates dependencies
- Runs migrations
- Rebuilds applications
- Restarts services

## 🎓 Advanced Usage

### Custom Variables

Override variables per playbook run:

```bash
ansible-playbook -i inventory.yml playbooks/03-application-deploy.yml \
  -e "repo_branch=develop" \
  -e "pm2_instances_api=4"
```

### Dry Run (Check Mode)

See what would change without applying:

```bash
ansible-playbook -i inventory.yml playbooks/05-update.yml --check --diff
```

### Tags

Run specific tasks:

```bash
# Only update frontend
ansible-playbook -i inventory.yml playbooks/05-update.yml --tags frontend

# Skip database tasks
ansible-playbook -i inventory.yml playbooks/03-application-deploy.yml --skip-tags database
```

## 📞 Support

For issues or questions:
1. Check logs: `./logs.sh`
2. Verify status: `./status.sh`
3. Review playbook output for error messages
4. Check server logs directly via SSH

## 🎉 Success Indicators

After deployment, verify:

✅ PM2 shows all services online
✅ API responds at `http://your-domain/api/health`
✅ Frontend loads at `http://your-domain`
✅ Database has tables: `sudo -u postgres psql -d resume_db -c "\dt"`
✅ Analytics tracking works (CloudFlare headers present)

Happy deploying! 🚀
