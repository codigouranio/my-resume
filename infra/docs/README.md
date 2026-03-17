# Infrastructure Documentation

Deployment guides, troubleshooting, and configuration documentation.

## Quick Start

1. **[DEPLOY_SCRIPTS.md](DEPLOY_SCRIPTS.md)** - Quick deployment reference
2. **[GCP_DEPLOYMENT_GUIDE.md](GCP_DEPLOYMENT_GUIDE.md)** - Complete GCP setup guide
3. **[TROUBLESHOOTING_LOGS.md](TROUBLESHOOTING_LOGS.md)** - Debug production issues

## Deployment Guides

### GCP Cloud Run (Production)
- **[GCP_DEPLOYMENT_GUIDE.md](GCP_DEPLOYMENT_GUIDE.md)** - Full GCP infrastructure setup
- **[DEPLOY_SCRIPTS.md](DEPLOY_SCRIPTS.md)** - Deployment script usage
- **[../scripts/](../scripts/)** - Deployment scripts directory

### Home Server (LLM Service)
See [../../ansible/DEPLOYMENT.md](../../ansible/DEPLOYMENT.md) for home server deployment.

## Configuration & Troubleshooting

### Chat System
- **[CHAT_FLOW_CONFIG.md](CHAT_FLOW_CONFIG.md)** - Chat architecture and configuration
- **[CHAT_PROXY_IMPLEMENTATION.md](CHAT_PROXY_IMPLEMENTATION.md)** - Chat proxy setup
- **[CHAT_ENDPOINT_404_FIX.md](CHAT_ENDPOINT_404_FIX.md)** - Troubleshooting guide

### Operations
- **[TROUBLESHOOTING_LOGS.md](TROUBLESHOOTING_LOGS.md)** - Log analysis and debugging
- **[PRODUCTION_FIX.md](PRODUCTION_FIX.md)** - Production hotfix procedures

## Architecture Overview

```
┌──────────────── GOOGLE CLOUD PLATFORM ───────────────┐
│                                                       │
│  ┌─────────────────┐      ┌──────────────────┐     │
│  │  Cloud Run:     │      │  Cloud Run:      │     │
│  │  Frontend       │──────│  API Service     │     │
│  │  (React)        │      │  (NestJS)        │     │
│  └─────────────────┘      └────────┬─────────┘     │
│                                    │                │
│               ┌────────────────────┼────────┐       │
│               │                    │        │       │
│        ┌──────▼──────┐      ┌──────▼──────┐ │      │
│        │  Cloud SQL  │      │   Redis     │ │      │
│        │ (PostgreSQL)│      │ (Upstash)   │ │      │
│        └─────────────┘      └─────────────┘ │      │
└────────────────────────────────────────────────────┘
                             │
                      HTTPS  │
                             │
┌────────────────────────────▼─────────────────────────┐
│         HOME SERVER (LLM Service)                     │
│                                                       │
│  ┌──────────────────────────────────────────┐       │
│  │  Flask + vLLM + Ollama                   │       │
│  │  Port 5000 → https://llm-service.paskot.com │   │
│  └──────────────────────────────────────────┘       │
└───────────────────────────────────────────────────────┘
```

## Service URLs

- **Production Frontend:** https://resumecast.ai
- **API Service:** https://api.resumecast.ai
- **LLM Service:** https://llm-service.paskot.com (home server)

## Related Documentation

- [../../ansible/](../../ansible/) - Ansible playbooks for home server
- [../gcp/](../gcp/) - Terraform infrastructure as code
- [../../README.md](../../README.md) - Main project documentation
