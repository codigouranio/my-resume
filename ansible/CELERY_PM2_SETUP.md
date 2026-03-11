# Celery + PM2 Ansible Configuration

## Overview

This document describes the Ansible configuration for deploying Celery task queue with PM2 process management for the LLM service.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Production Server                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  PM2 Processes:                                         │
│  ┌──────────────────┐  ┌───────────────────┐          │
│  │  api-service     │  │  llm-service      │          │
│  │  (NestJS)        │  │  (Flask)          │          │
│  │  Port: 3000      │  │  Port: 5000       │          │
│  │  Cluster: 2x     │  │  Instances: 1     │          │
│  └──────────────────┘  └───────────────────┘          │
│                                                          │
│  ┌──────────────────┐  ┌───────────────────┐          │
│  │  llm-celery-     │  │  llm-flower       │          │
│  │  worker          │  │  (Dashboard)      │          │
│  │  (Celery)        │  │  Port: 5555       │          │
│  │  Workers: 2      │  │  Instances: 1     │          │
│  └──────────────────┘  └───────────────────┘          │
│                                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Redis Instances:                                       │
│  ┌──────────────────┐  ┌───────────────────┐          │
│  │  redis-server    │  │  redis-llm        │          │
│  │  Port: 6379      │  │  Port: 6380       │          │
│  │  (API service)   │  │  (LLM Celery)     │          │
│  └──────────────────┘  └───────────────────┘          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## What Changed

### 1. **group_vars/all.yml** - New Variables

Added configuration for Redis (LLM service) and Celery:

```yaml
# Redis Configuration for LLM Service Celery
llm_redis_host: "localhost"
llm_redis_port: 6380           # Separate from main Redis (6379)
llm_redis_db: 0
llm_redis_password: ""         # Optional

# Celery Configuration
celery_worker_concurrency: 2
celery_max_tasks_per_child: 50
flower_port: 5555
flower_enabled: true

# Webhook Security
llm_webhook_secret: "{{ vault_llm_webhook_secret | default('CHANGE_ME_IN_PRODUCTION_MIN_32_CHARS') }}"
```

### 2. **playbooks/01-system-setup.yml** - Redis LLM Instance

Added tasks to configure a second Redis instance on port 6380:

- Creates `/etc/redis-llm/redis-llm.conf` configuration
- Creates `/var/lib/redis-llm` data directory
- Creates systemd service `redis-llm.service`
- Configures 512MB max memory with LRU eviction policy
- Automatically starts and enables on boot

**Why separate Redis?**
- Service independence (LLM service can scale independently)
- Isolated memory limits (prevents one service from starving the other)
- Different persistence requirements
- Easier troubleshooting and monitoring

### 3. **templates/ecosystem.config.js.j2** - PM2 Processes

Added two new PM2 process definitions:

#### **llm-celery-worker**
```javascript
{
  name: 'llm-celery-worker',
  interpreter: '{{ llm_service_path }}/.venv/bin/python',
  script: '{{ llm_service_path }}/.venv/bin/celery',
  args: '-A celery_config worker --loglevel=info --concurrency=2 ...',
  env: {
    REDIS_HOST: '{{ llm_redis_host }}',
    REDIS_PORT: {{ llm_redis_port }},
    LLM_WEBHOOK_SECRET: '{{ llm_webhook_secret }}',
    // ... other env vars
  }
}
```

#### **llm-flower** (optional, controlled by `flower_enabled`)
```javascript
{
  name: 'llm-flower',
  interpreter: '{{ llm_service_path }}/.venv/bin/python',
  script: '{{ llm_service_path }}/.venv/bin/celery',
  args: '-A celery_config flower --port=5555 --persistent=True',
  // ... monitoring dashboard
}
```

### 4. **update-services.yml** - Environment Configuration

Updated LLM service environment to include Redis/Celery variables:

```bash
PORT={{ llm_port }}
REDIS_HOST={{ llm_redis_host }}
REDIS_PORT={{ llm_redis_port }}
REDIS_DB={{ llm_redis_db }}
REDIS_PASSWORD={{ llm_redis_password }}
CELERY_BROKER_URL=redis://{{ llm_redis_host }}:{{ llm_redis_port }}/{{ llm_redis_db }}
CELERY_RESULT_BACKEND=redis://{{ llm_redis_host }}:{{ llm_redis_port }}/{{ llm_redis_db }}
FLOWER_PORT={{ flower_port }}
LLM_WEBHOOK_SECRET={{ llm_webhook_secret }}
```

Added PM2 restart commands for Celery processes:

```yaml
- name: Restart Celery Worker
  command: "pm2 restart llm-celery-worker"

- name: Restart Flower Dashboard
  command: "pm2 restart llm-flower"
  when: flower_enabled
```

## Deployment Steps

### First Time Deployment

```bash
# 1. System setup (installs Redis LLM on port 6380)
cd ansible
ansible-playbook playbooks/01-system-setup.yml --ask-become-pass

# 2. Database setup
ansible-playbook playbooks/02-database-setup.yml --ask-become-pass

# 3. Application deployment (starts all PM2 processes including Celery)
ansible-playbook playbooks/03-application-deploy.yml --ask-become-pass --ask-vault-pass
```

### Update Existing Deployment

```bash
# Quick update (restarts services including Celery)
cd ansible
ansible-playbook update-services.yml --ask-vault-pass --ask-become-pass
```

### Manual Commands (on server)

```bash
# Check all PM2 processes
pm2 status

# Should show:
# api-service       │ cluster │ 2       │ online
# llm-service       │ fork    │ 0       │ online
# llm-celery-worker │ fork    │ 0       │ online
# llm-flower        │ fork    │ 0       │ online

# Check Redis instances
sudo systemctl status redis-server     # Port 6379
sudo systemctl status redis-llm        # Port 6380

# Check Redis LLM is working
redis-cli -p 6380 ping                 # Should return: PONG

# View Celery worker logs
pm2 logs llm-celery-worker

# View Flower dashboard logs
pm2 logs llm-flower

# Restart specific process
pm2 restart llm-celery-worker
pm2 restart llm-flower
```

## Monitoring

### PM2 Monitoring

```bash
# Real-time process monitor
pm2 monit

# Process list with details
pm2 list

# View logs (all processes)
pm2 logs

# View logs (specific process)
pm2 logs llm-celery-worker --lines 100
```

### Flower Dashboard

Access the Flower monitoring dashboard:

```bash
# If deployed with firewall rules, create SSH tunnel:
ssh -L 5555:localhost:5555 user@your-server.com

# Then open in browser:
http://localhost:5555
```

**Flower Features:**
- Real-time task monitoring
- Task history and statistics
- Worker status and resource usage
- Task success/failure rates
- Task execution times
- Active/scheduled/reserved tasks

### Redis Monitoring

```bash
# Connect to LLM Redis instance
redis-cli -p 6380

# Check queue length
LLEN celery

# Check all Celery keys
KEYS celery*

# Monitor commands in real-time
MONITOR

# Get memory usage
INFO memory

# Get client connections
CLIENT LIST
```

## Configuration Variables

Override in `inventory.yml` or `host_vars/`:

```yaml
# Celery Worker Settings
celery_worker_concurrency: 4              # Increase for more CPU cores
celery_max_tasks_per_child: 100           # Higher = less frequent restarts

# Flower Dashboard
flower_enabled: false                     # Disable in production if not needed
flower_port: 5555                         # Change if port conflicts

# Redis Settings
llm_redis_port: 6380                      # Change if port conflicts
llm_redis_password: "my_secure_password"  # Add password for security
```

## Security Considerations

### 1. **Redis Password** (Production)

Add password protection for Redis LLM:

```yaml
# In inventory.yml (encrypted with ansible-vault)
llm_redis_password: "{{ vault_llm_redis_password }}"
```

Then update Redis config:
```bash
# /etc/redis-llm/redis-llm.conf
requirepass your_strong_password_here
```

### 2. **Flower Authentication** (Production)

Add basic auth for Flower dashboard:

```yaml
# In group_vars/all.yml
flower_basic_auth: "user:password"
```

Update PM2 args:
```javascript
args: '-A celery_config flower --port=5555 --basic_auth={{ flower_basic_auth }}'
```

### 3. **Webhook Secret**

Always use ansible-vault for webhook secret:

```bash
# Create vault file
ansible-vault create group_vars/vault.yml

# Add:
vault_llm_webhook_secret: "your_32_char_min_random_string"
```

### 4. **Firewall Rules**

Flower port should NOT be exposed publicly:

```yaml
# In playbooks/01-system-setup.yml
# Only allow SSH, HTTP, HTTPS
# Flower (5555) is internal only, access via SSH tunnel
```

## Troubleshooting

### Celery Worker Not Starting

```bash
# Check logs
pm2 logs llm-celery-worker --lines 50

# Common issues:
# 1. Redis not running
sudo systemctl status redis-llm

# 2. Poetry dependencies not installed
cd /opt/my-resume/apps/llm-service
poetry install

# 3. Celery config error
cd /opt/my-resume/apps/llm-service
poetry run python -c "from celery_config import celery_app; print(celery_app)"
```

### Tasks Not Being Processed

```bash
# 1. Check worker is registered
redis-cli -p 6380
> KEYS celery*

# 2. Check Celery can connect to Redis
cd /opt/my-resume/apps/llm-service
poetry run python -c "from celery_config import celery_app; print(celery_app.control.inspect().ping())"

# Should output: {'celery@hostname': {'ok': 'pong'}}

# 3. Check tasks are registered
cd /opt/my-resume/apps/llm-service
poetry run celery -A celery_config inspect registered

# Should show:
# - llm_service.tasks.research_company_task
# - llm_service.tasks.analyze_position_task
```

### Memory Issues

```bash
# Check worker memory usage
pm2 list  # Look at "memory" column

# If worker memory is high:
# Option 1: Reduce max_tasks_per_child (restart more often)
# Option 2: Reduce concurrency (fewer parallel tasks)
# Option 3: Increase swap space or RAM
```

### Redis Out of Memory

```bash
# Check Redis memory usage
redis-cli -p 6380 INFO memory

# If near maxmemory limit:
# Option 1: Increase maxmemory in /etc/redis-llm/redis-llm.conf
# Option 2: Clear old task results manually
redis-cli -p 6380
> FLUSHDB  # WARNING: Deletes all data in current DB
```

## Performance Tuning

### Horizontal Scaling

To add more Celery workers on different servers:

```yaml
# In inventory.yml
[llm_workers]
worker1 ansible_host=10.0.1.10
worker2 ansible_host=10.0.1.11

# Configure Redis to accept remote connections
# /etc/redis-llm/redis-llm.conf
bind 0.0.0.0
requirepass your_secure_password
```

### Vertical Scaling

Adjust worker concurrency based on CPU cores:

```yaml
# For 8-core server
celery_worker_concurrency: 7  # cores - 1

# For high-memory tasks
celery_worker_concurrency: 4  # half of cores
```

### Task Priority Queues

For multi-tenant SaaS, add priority queues:

```python
# In celery_config.py
task_routes = {
    'llm_service.tasks.research_company_task': {
        'queue': 'research-{priority}'  # high, normal, low
    }
}
```

```bash
# Start dedicated workers for each priority
pm2 start celery --name "celery-high" -- -A celery_config worker -Q research-high
pm2 start celery --name "celery-normal" -- -A celery_config worker -Q research-normal
```

## Related Documentation

- [apps/llm-service/CELERY.md](../apps/llm-service/CELERY.md) - Celery setup guide
- [ansible/DEPLOYMENT.md](DEPLOYMENT.md) - Full deployment guide
- [ansible/playbooks/](playbooks/) - Ansible playbook files
- [ansible/templates/](templates/) - Configuration templates

## Quick Reference

| Component | Port | Status Command | Log File |
|-----------|------|----------------|----------|
| API Service | 3000 | `pm2 status api-service` | `apps/api-service/logs/api-out.log` |
| LLM Service | 5000 | `pm2 status llm-service` | `apps/llm-service/logs/llm-out.log` |
| Celery Worker | - | `pm2 status llm-celery-worker` | `apps/llm-service/logs/celery-worker-out.log` |
| Flower | 5555 | `pm2 status llm-flower` | `apps/llm-service/logs/flower-out.log` |
| Redis (API) | 6379 | `systemctl status redis-server` | `/var/log/redis/redis-server.log` |
| Redis (LLM) | 6380 | `systemctl status redis-llm` | `/var/log/redis/redis-llm.log` |

## Summary

This configuration provides:

- ✅ **Separate Redis instance** for LLM service independence
- ✅ **PM2-managed Celery worker** with auto-restart
- ✅ **Flower monitoring dashboard** for task visibility
- ✅ **Automatic deployment** via Ansible playbooks
- ✅ **Environment variable management** via Ansible templates
- ✅ **Security** via webhook secrets and optional Redis auth
- ✅ **Scalability** via concurrency and horizontal scaling options
- ✅ **Monitoring** via PM2, Flower, and Redis tools
- ✅ **Production-ready** with logging, error handling, and restarts
