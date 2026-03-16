# Google Cloud Platform Deployment with Terraform

Infrastructure as Code for ResumeCast AI hybrid cloud deployment.

## Architecture

```
┌──────────────── GOOGLE CLOUD PLATFORM ───────────────┐
│                                                       │
│  ┌─────────────────┐      ┌──────────────────┐     │
│  │  Cloud Run:     │      │  Cloud Run:      │     │
│  │  Frontend       │──────│  API Service     │     │
│  │  (React app)    │      │  (NestJS)        │     │
│  └─────────────────┘      └────────┬─────────┘     │
│                                    │                │
│               ┌────────────────────┼────────┐       │
│               │                    │        │       │
│        ┌──────▼──────┐      ┌──────▼──────┐ │      │
│        │  Cloud SQL  │      │   Redis     │ │      │
│        │ (PostgreSQL)│      │ (Upstash)   │ │      │
│        └──────┬──────┘      └─────────────┘ │      │
└───────────────┼─────────────────────────────┼──────┘
                │                             │
        Internet│(Public IP)          HTTPS   │
                │                             │
┌───────────────▼─────────────────────────────▼──────┐
│         YOUR HOME NETWORK                           │
│                                                      │
│  ┌──────────────────────────────────────────┐      │
│  │  Cloudflare Tunnel                       │      │
│  │  llm.yourdomain.com → localhost:5000     │      │
│  └─────────────────┬────────────────────────┘      │
│                    │                                │
│  ┌─────────────────▼────────────────────────┐      │
│  │  llm-service (Flask)                     │      │
│  │  + Ollama + Your GPUs                    │      │
│  └──────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────┘
```

## Prerequisites

1. **GCP Account** with billing enabled
2. **gcloud CLI** installed and authenticated
3. **Terraform** >= 1.5.0
4. **Docker** for building images
5. **Your home public IP** (get from `curl ifconfig.me`)
6. **Redis** account (Upstash or Redis Cloud)
7. **Cloudflare Tunnel** or DuckDNS for home LLM service

## Initial Setup (One-Time)

### 1. GCP Bootstrap

Run the bootstrap commands (if you haven't already):

```bash
# Set your project ID
PROJECT_ID="resume-cast-ai-prod"

# Create project
gcloud projects create $PROJECT_ID --name="ResumeCast AI"

# Set as active
gcloud config set project $PROJECT_ID

# Link billing (do this in console first!)
# https://console.cloud.google.com/billing

# Enable APIs
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  sql-component.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  compute.googleapis.com

# Create Terraform service account
gcloud iam service-accounts create terraform \
  --display-name="Terraform Automation"

# Grant permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:terraform@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/editor"

# Create key for local Terraform
gcloud iam service-accounts keys create terraform-key.json \
  --iam-account=terraform@${PROJECT_ID}.iam.gserviceaccount.com

# Authenticate Terraform locally
export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/terraform-key.json"
```

### 2. Configure Variables

```bash
# Copy example variables
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
vim terraform.tfvars

# Required values:
# - project_id: Your GCP project ID
# - home_network_ip: Your home IP in CIDR format (e.g., 1.2.3.4/32)
# - database_password: Strong password
# - redis_url: From Upstash/Redis Cloud
# - llm_service_url: Your Cloudflare Tunnel URL
# - llm_webhook_secret: Generate with: openssl rand -base64 32
# - jwt_secret: Generate with: openssl rand -base64 32
# - frontend_url: Your domain
```

### 3. Setup Redis

**Option A: Upstash (Recommended)**
```bash
# 1. Go to https://upstash.com
# 2. Create account and Redis database
# 3. Copy connection URL: rediss://default:xxxxx@us1-xxxxx.upstash.io:6379
# 4. Add to terraform.tfvars as redis_url
```

**Option B: Redis Cloud**
```bash
# 1. Go to https://redis.com/try-free
# 2. Create free account and database
# 3. Get connection URL
# 4. Add to terraform.tfvars
```

### 4. Setup Home LLM Service Tunnel

```bash
# Install Cloudflare Tunnel
brew install cloudflared  # or apt/yum

# Authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create resumecast-llm

# Route DNS
cloudflared tunnel route dns resumecast-llm llm.yourdomain.com

# Run tunnel (or add to systemd/launchd)
cloudflared tunnel run resumecast-llm --url http://localhost:5000
```

## Deploy Infrastructure

```bash
# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Deploy
terraform apply

# Save outputs
terraform output > ../INFRASTRUCTURE_OUTPUTS.txt
```

## After Terraform Deployment

### 1. Build and Push Docker Images

```bash
# Configure Docker for GCR
gcloud auth configure-docker us-central1-docker.pkg.dev

# Build API service
cd ../../apps/api-service
docker build -t us-central1-docker.pkg.dev/resume-cast-ai-prod/resumecast-images/api-service:latest .
docker push us-central1-docker.pkg.dev/resume-cast-ai-prod/resumecast-images/api-service:latest

# Build frontend
cd ../my-resume
docker build -t us-central1-docker.pkg.dev/resume-cast-ai-prod/resumecast-images/frontend:latest .
docker push us-central1-docker.pkg.dev/resume-cast-ai-prod/resumecast-images/frontend:latest
```

### 2. Database Migrations (Automatic)

✅ **Prisma migrations are automatically applied during `terraform apply`**

The Terraform configuration includes a `null_resource` that runs `npx prisma migrate deploy` after the database is created. This ensures your schema is always up-to-date.

If you need to run migrations manually:
```bash
cd ../api-service
DATABASE_URL=$(cd ../../infra/gcp && terraform output -raw database_url_for_home_llm)
DATABASE_URL=$DATABASE_URL npx prisma migrate deploy
```

### 3. Update Cloud Run Services

After pushing images, Cloud Run will automatically deploy them.

### 4. Configure Home LLM Service

Update your home LLM service `.env`:

```bash
# Get values from Terraform outputs
cd infra/gcp
terraform output

# Update your home .env file
DATABASE_URL=postgresql://...  # From terraform output
API_SERVICE_URL=https://api-service-xxxxx-uc.a.run.app  # From terraform output
API_BASE_URL=https://api-service-xxxxx-uc.a.run.app/api
LLAMA_SERVER_URL=http://localhost:11434
LLM_WEBHOOK_SECRET=your_webhook_secret  # Same as in terraform.tfvars
```

## Ongoing Deployment (GitHub Actions)

After initial setup, use GitHub Actions for automatic deployments:

1. Add `GCP_SA_KEY` to GitHub Secrets (contents of `terraform-key.json`)
2. Push to main branch
3. GitHub Actions will:
   - Build Docker images
   - Push to Artifact Registry
   - Deploy to Cloud Run
   - Run migrations

## Cost Estimates

**Monthly costs at 100 users/day:**

- **Cloud SQL** (db-f1-micro): $7-10
- **Cloud Run API** (low traffic): $5-10
- **Cloud Run Frontend** (low traffic): $3-5
- **Cloud Storage**: $1-2
- **Artifact Registry**: $0-1
- **Redis** (Upstash free tier): $0-5
- **Secret Manager**: $0-1

**Total: ~$20-35/month**

## Scaling Up

When you need more capacity:

```hcl
# Edit terraform.tfvars
database_tier              = "db-custom-4-32768"  # From db-f1-micro
database_availability_type = "REGIONAL"           # For 99.99% SLA
api_min_instances          = 1                    # Keep 1 instance warm
api_max_instances          = 50                   # Scale to 50
```

Then run:
```bash
terraform apply
```

## Monitoring

```bash
# View Cloud Run logs
gcloud run logs read api-service --region=us-central1 --limit=50

# View database metrics
gcloud sql operations list --instance=resumecast-db-xxxxx

# Check service status
gcloud run services list --region=us-central1
```

## Troubleshooting

### Database connection issues from home LLM service

```bash
# Test connection from home
psql "postgresql://resumecast:PASSWORD@PUBLIC_IP:5432/resume_db"

# Check authorized networks
gcloud sql instances describe INSTANCE_NAME --format="get(settings.ipConfiguration.authorizedNetworks)"

# Update your home IP if it changed
terraform apply -var="home_network_ip=NEW_IP/32"
```

### Cloud Run deployment issues

```bash
# Check service status
gcloud run services describe api-service --region=us-central1

# View error logs
gcloud run logs read api-service --region=us-central1 --limit=100

# Force new revision
gcloud run services update api-service --region=us-central1 --image=SAME_IMAGE
```

### Redis connection issues

```bash
# Test Redis connection
redis-cli -u "YOUR_REDIS_URL" ping

# Should return: PONG
```

## Cleanup

To destroy all resources:

```bash
# WARNING: This will delete everything!
terraform destroy

# If you get deletion protection errors:
terraform apply -var="deletion_protection=false"
terraform destroy
```

## Security Best Practices

1. ✅ Never commit `terraform.tfvars` or `*.json` keys
2. ✅ Rotate database passwords regularly
3. ✅ Use Secret Manager for all secrets
4. ✅ Enable deletion protection in production
5. ✅ Use REGIONAL availability for production databases
6. ✅ Set up Cloud Armor for DDoS protection (not included by default)
7. ✅ Enable Cloud SQL backups (configured by default)
8. ✅ Use strong JWT secrets (32+ characters)

## Support

For issues:
1. Check Terraform outputs: `terraform output`
2. Check GCP console for error messages
3. View Cloud Run logs
4. Verify all environment variables are set correctly
