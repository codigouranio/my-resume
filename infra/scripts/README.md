# Deployment Scripts

Quick deployment scripts for GCP Cloud Run services.

## Usage

### Deploy Everything to Production
```bash
./deploy-all.sh
```
Deploys both API service and frontend in sequence (~5 minutes).

### Deploy Frontend Only
```bash
./deploy-frontend.sh
```
Builds and deploys the React frontend to Cloud Run:
- ✅ Optimized production build
- ✅ Nginx serving on port 8080
- ✅ API URL: `https://api.resumecast.ai`

**After deployment:** Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)

### Deploy API Service Only
```bash
./deploy-api-service.sh
```
Builds and deploys the NestJS API to Cloud Run:
- ✅ Latest code changes
- ✅ Environment variables preserved
- ✅ PostgreSQL + Redis connections

**Note:** To update env vars:
```bash
gcloud run services update api-service \
  --update-env-vars KEY=VALUE \
  --region=us-central1
```

### Other Scripts

- **deploy-cloudfront.sh** - Deploy with CloudFront CDN (AWS)
- **deploy-simple.sh** - Simple deployment without extras
- **deploy-manual.sh** - Manual deployment steps
- **deploy-fix-production.sh** - Production hotfix deployment

## Prerequisites

- Google Cloud SDK (`gcloud`) installed and authenticated
- Docker installed (for local builds, optional with Cloud Build)
- Project: `resume-cast-ai-prod`
- Region: `us-central1`

## Troubleshooting

See [../docs/TROUBLESHOOTING_LOGS.md](../docs/TROUBLESHOOTING_LOGS.md) for debugging.

### Common Issues

**Permission denied:**
```bash
chmod +x deploy-*.sh
```

**Check deployment status:**
```bash
gcloud run services list --region=us-central1
```

**View logs:**
```bash
gcloud logging read 'resource.labels.service_name=frontend' --limit=50
gcloud logging read 'resource.labels.service_name=api-service' --limit=50
```

## Documentation

See [../docs/](../docs/) for detailed guides:
- [DEPLOY_SCRIPTS.md](../docs/DEPLOY_SCRIPTS.md) - Script documentation
- [GCP_DEPLOYMENT_GUIDE.md](../docs/GCP_DEPLOYMENT_GUIDE.md) - Full GCP setup
- [TROUBLESHOOTING_LOGS.md](../docs/TROUBLESHOOTING_LOGS.md) - Debugging guide
