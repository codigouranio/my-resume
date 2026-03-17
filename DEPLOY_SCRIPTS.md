# Quick Deployment Scripts

Simple one-command deployment for Cloud Run services.

## Usage

### Deploy Everything (Recommended)
```bash
./deploy-all.sh
```

Deploys both API service and frontend in sequence.

---

### Deploy Frontend Only
```bash
./deploy-frontend.sh
```

Builds and deploys the React frontend with:
- ✅ Correct API URL: `https://api.resumecast.ai`
- ✅ Optimized production build
- ✅ Nginx serving on port 8080

**After deployment:** Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)

---

### Deploy API Service Only
```bash
./deploy-api-service.sh
```

Builds and deploys the NestJS API with:
- ✅ Latest code changes
- ✅ Environment variables preserved from previous deployment
- ✅ PostgreSQL connection
- ✅ JWT authentication
- ✅ LLM service integration

**Note:** This script updates code only. Environment variables are not changed.
To update env vars, use Cloud Console or:
```bash
gcloud run services update api-service --update-env-vars KEY=VALUE --region=us-central1
```

---

## What Each Script Does

### deploy-all.sh
1. Runs `deploy-api-service.sh`
2. Then runs `deploy-frontend.sh`
3. Deploys everything in ~5 minutes

### deploy-frontend.sh
1. Builds Docker image with `PUBLIC_API_URL=https://api.resumecast.ai`
2. Uses Cloud Build (no local Docker needed)
3. Deploys to Cloud Run region `us-central1`
4. Serves on port 8080 with Nginx

### deploy-api-service.sh
1. Builds Docker image from `apps/api-service/`
2. Uses existing Cloud Run environment variables
3. Deploys to Cloud Run region `us-central1`
4. Serves on port 3000

---

## Troubleshooting

### Script fails with permission error
```bash
chmod +x deploy-frontend.sh deploy-api-service.sh
```

### "gcloud: command not found"
Install Google Cloud SDK:
```bash
brew install google-cloud-sdk  # macOS
# or visit: https://cloud.google.com/sdk/docs/install
```

### Build timeout
Increase timeout in script (default: 10m):
```bash
--timeout=15m
```

### Check deployment status
```bash
# List services
gcloud run services list --region=us-central1

# Check logs
gcloud logging read 'resource.labels.service_name=frontend' --limit=50
gcloud logging read 'resource.labels.service_name=api-service' --limit=50
```

---

## Environment Variables

### Frontend
Baked into build at build time:
- `PUBLIC_API_URL=https://api.resumecast.ai` - Set in Dockerfile build arg

### API Service  
Managed in Cloud Run (not read from file):
- `DATABASE_URL` - PostgreSQL connection
- `JWT_SECRET` - Authentication secret
- `LLM_SERVICE_URL` - LLM service endpoint
- `LLM_API_KEY` - API key for LLM service
- `API_BASE_URL` - Self-reference URL
- And more...

To view current env vars:
```bash
gcloud run services describe api-service --region=us-central1 --format="table(spec.template.spec.containers[0].env[].name, spec.template.spec.containers[0].env[].value)"
```

---

## Production URLs

After deployment, services are available at:

- **Frontend**: https://resumecast.ai
- **API Service**: https://api.resumecast.ai
- **LLM Service**: https://llm-service.paskot.com (home server)

Cloud Run URLs (behind Cloudflare):
- Frontend: https://frontend-584996648931.us-central1.run.app
- API: https://api-service-t6hqg2nmta-uc.a.run.app
