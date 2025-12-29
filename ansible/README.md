# Ansible Deployment for My Resume

Automated deployment and updates for the complete application stack.

## Prerequisites

**On your local machine:**
- Ansible installed (or use the remote server)
- SSH access to target server

**On remote server:**
- Ubuntu/Debian Linux
- Sudo access

## Quick Start

### Initial Deployment (New Server)

```bash
cd ansible

# 1. Configure your server
vim inventory.yml  # Set ansible_host, passwords

# 2. Run full deployment
./deploy_with_conda.sh
```

### Quick Updates (Existing Server)

```bash
cd ansible

# Pull code, rebuild, restart - handles migrations automatically
./update.sh
```

## What Gets Automated

### Full Deployment (`./deploy_with_conda.sh`)
Installs everything from scratch:
- ✅ System packages (PostgreSQL, Nginx, Git, etc.)
- ✅ Miniconda and conda environments
- ✅ PostgreSQL database and users
- ✅ Code from GitHub
- ✅ All dependencies (npm, Python, GraphQL, CQRS)
- ✅ Database migrations
- ✅ Frontend and backend builds
- ✅ PM2 services with proper configs
- ✅ Nginx reverse proxy

### Quick Update (`./update.sh`)
Updates existing deployment:
- ✅ Pull latest code from GitHub
- ✅ Install/update dependencies (including @nestjs/graphql, @nestjs/cqrs)
- ✅ Apply Prisma migrations (migrate deploy with fallback to db push)
- ✅ Regenerate Prisma client with RecruiterInterest model
- ✅ Update Python packages (Flask, psycopg2-binary)
- ✅ Rebuild frontend and backend
- ✅ Reload PM2 services
- ✅ Verify database tables (including RecruiterInterest)

### Quick Update (`update.yml`)
Only updates code and restarts services:
```bash
ansible-playbook -i inventory.yml update.yml
```

## What Gets Deployed

**Services managed by PM2:**
- `api-service` - NestJS backend (port 3000, 2 instances)
- `llm-service` - Python LLM service (port 5000)

**Frontend:**
- Built React app served by Nginx
- **Source maps enabled** for debugging in browser DevTools

**Nginx routes:**
- `/` → Frontend (React app)
- `/api/` → API Service (NestJS)
- `/graphql` → GraphQL endpoint
- `/llm/` → LLM Service

## Debugging with Source Maps

The frontend build includes source maps for debugging:

**In Chrome DevTools:**
1. Open DevTools (F12 or Cmd+Option+I)
2. Go to Sources tab
3. Find your TypeScript files under `webpack://` or `src/`
4. Set breakpoints in original source code
5. Debug with proper variable names and code structure

**Source map files generated:**
- JavaScript: `dist/static/js/*.js.map` (~2.7 MB total)
- CSS: `dist/static/css/*.css.map` (~412 KB)

The Ansible deployment automatically verifies source maps are present after each build.

## Post-Deployment

### Access your application

- **Frontend**: http://172.16.23.127
- **API Docs**: http://172.16.23.127/api/docs
- **GraphQL**: http://172.16.23.127/graphql

### Manage services

SSH to the server and use PM2:

```bash
# Check status
pm2 status

# View logs
pm2 logs
pm2 logs api-service
pm2 logs llm-service

# Restart services
pm2 restart all
pm2 restart api-service

# Monitor resources
pm2 monit

# Stop services
pm2 stop all
```

### Database management

```bash
# Connect to PostgreSQL
sudo -u postgres psql resume_db

# Run migrations
cd /opt/my-resume/api-service
npx prisma migrate deploy

# Open Prisma Studio
npx prisma studio
```

### View Nginx logs

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## SSL/HTTPS Setup

After deployment, set up Let's Encrypt SSL:

```bash
sudo certbot --nginx -d yourdomain.com
```

## Rollback

If something goes wrong:

```bash
# On the server
cd /opt/my-resume
git log  # Find previous commit
git checkout <previous-commit-hash>

# Rebuild and restart
cd api-service && npm run build
cd ../my-resume && npm run build
pm2 reload all
```

## Troubleshooting

### Services won't start

```bash
pm2 logs              # Check for errors
pm2 restart all       # Restart services
pm2 delete all        # Remove all and re-deploy
```

### Database connection errors

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check database exists
sudo -u postgres psql -l

# Verify connection
psql "postgresql://resume_user:password@localhost:5432/resume_db"
```

### Nginx errors

```bash
# Test configuration
sudo nginx -t

# Check if ports are in use
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :3000
```

### Port conflicts

```bash
# Find what's using a port
sudo lsof -i :3000

# Kill process
sudo kill -9 <PID>
```

## GitHub Actions CI/CD (Optional)

Create `.github/workflows/deploy.yml` for automatic deployment:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy with Ansible
        run: |
          ansible-playbook -i ansible/inventory.yml ansible/update.yml
        env:
          ANSIBLE_HOST_KEY_CHECKING: False
```

## Custom Tasks

### Add a new service

Edit `ansible/playbook.yml` and add to PM2 ecosystem:

```javascript
{
  name: 'new-service',
  cwd: '/opt/my-resume/new-service',
  script: 'index.js',
  instances: 1
}
```

### Change ports

Update `inventory.yml`:
```yaml
api_port: 4000  # Change from 3000
```

Then re-run playbook.

## Security Checklist

- [ ] Change default passwords
- [ ] Use Ansible Vault for secrets
- [ ] Set up firewall (ufw)
- [ ] Enable SSL with Certbot
- [ ] Regular updates: `apt update && apt upgrade`
- [ ] Monitor logs for suspicious activity
- [ ] Backup database regularly

## Support

Check PM2, Nginx, and PostgreSQL logs for errors:
```bash
pm2 logs --lines 100
sudo journalctl -u nginx -n 100
sudo journalctl -u postgresql -n 100
```
