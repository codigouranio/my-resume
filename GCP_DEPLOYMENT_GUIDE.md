# GCP Deployment Quick Start Guide

Complete Terraform + GitHub Actions setup for hybrid cloud deployment.

## 📋 What Was Created

```
infra/gcp/
├── main.tf                    # Core infrastructure (Cloud SQL, Cloud Run, Storage)
├── variables.tf               # Input variables
├── outputs.tf                 # Output values after deployment
├── terraform.tfvars.example   # Example configuration (copy to terraform.tfvars)
├── .gitignore                 # Prevent secrets from being committed
└── README.md                  # Detailed documentation

apps/api-service/
├── Dockerfile                 # Production Docker image for NestJS API

apps/my-resume/
├── Dockerfile                 # Production Docker image for React frontend
└── nginx.conf                 # Nginx configuration for serving frontend

.github/workflows/
└── deploy-gcp.yml             # Automated deployment workflow
```

## 🚀 Quick Start (15 minutes)

### Step 1: Finish GCP Bootstrap (if not done)

```bash
# You already ran the gcloud commands, now create the service account key
cd infra/gcp

gcloud iam service-accounts keys create terraform-key.json \
  --iam-account=terraform@resume-cast-ai-prod.iam.gserviceaccount.com

export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/terraform-key.json"
```

### Step 2: Get Your Information

```bash
# 1. Your home public IP (for LLM service database access)
curl ifconfig.me
# Example: 203.0.113.42

# 2. Sign up for Redis (choose one):
# - Upstash: https://upstash.com (recommended, has free tier)
# - Redis Cloud: https://redis.com/try-free

# 3. Generate secrets
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 32  # For LLM_WEBHOOK_SECRET
```

### Step 3: Configure Terraform

```bash
# Copy example config
cp terraform.tfvars.example terraform.tfvars

# Edit with your values (use vim, nano, or your favorite editor)
vim terraform.tfvars
```

**Required values in `terraform.tfvars`:**
```hcl
project_id      = "resume-cast-ai-prod"  # Your GCP project ID
home_network_ip = "203.0.113.42/32"      # Your home IP from step 2
database_password = "STRONG_PASSWORD_HERE"
redis_url       = "rediss://default:xxxxx@us1-xxxxx.upstash.io:6379"
llm_service_url = "https://llm.yourdomain.com"  # We'll set this up later
llm_webhook_secret = "generated_secret_from_step_2"
jwt_secret      = "generated_secret_from_step_2"
frontend_url    = "https://resumecast.ai"  # Your domain (or use Cloud Run URL for now)
```

### Step 4: Deploy Infrastructure

```bash
# Initialize Terraform
terraform init

# Preview what will be created
terraform plan

# Deploy (takes 5-10 minutes)
terraform apply

# Save important outputs
terraform output > DEPLOYMENT_INFO.txt
cat DEPLOYMENT_INFO.txt
```

### Step 5: Setup Cloudflare Tunnel (for home LLM service)

```bash
# Install Cloudflare Tunnel
brew install cloudflared  # or apt install cloudflared

# Authenticate with Cloudflare
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create resumecast-llm

# Configure DNS (use a domain you own)
cloudflared tunnel route dns resumecast-llm llm.yourdomain.com

# Test tunnel (run this in a terminal, keep it running)
cloudflared tunnel run resumecast-llm --url http://localhost:5000

# Later, set this up as a service (systemd/launchd)
```

**Update terraform.tfvars:**
```hcl
llm_service_url = "https://llm.yourdomain.com"
```

Then re-apply:
```bash
terraform apply
```

### Step 6: Build and Deploy Applications

```bash
# Get Artifact Registry URL from terraform output
REGISTRY_URL=$(terraform output -raw artifact_registry_url)

# Configure Docker
gcloud auth configure-docker us-central1-docker.pkg.dev

# Build and push API service (from repo root)
cd ../..
docker build -t $REGISTRY_URL/api-service:latest -f apps/api-service/Dockerfile .
docker push $REGISTRY_URL/api-service:latest

# Build and push frontend
docker build -t $REGISTRY_URL/frontend:latest -f apps/my-resume/Dockerfile .
docker push $REGISTRY_URL/frontend:latest

# Cloud Run will automatically deploy the new images!
```

### Step 7: Run Database Migrations

```bash
cd apps/api-service

# Get database URL from terraform output
DATABASE_URL=$(cd ../../infra/gcp && terraform output -raw database_url_for_home_llm)

# Run migrations
DATABASE_URL=$DATABASE_URL npx prisma migrate deploy
```

### Step 8: Configure Home LLM Service

Get the database URL and API URL:
```bash
cd infra/gcp
terraform output database_url_for_home_llm  # Database connection
terraform output api_service_url            # API endpoint
```

Update your home `.env` file:
```bash
DATABASE_URL=postgresql://resumecast:PASSWORD@CLOUD_SQL_IP:5432/resume_db
API_SERVICE_URL=https://api-service-xxxxx-uc.a.run.app
API_BASE_URL=https://api-service-xxxxx-uc.a.run.app/api
LLAMA_SERVER_URL=http://localhost:11434
LLM_WEBHOOK_SECRET=your_webhook_secret
```

### Step 9: Test Deployment

```bash
# Get service URLs
API_URL=$(cd infra/gcp && terraform output -raw api_service_url)
FRONTEND_URL=$(cd infra/gcp && terraform output -raw frontend_service_url)

# Test API health
curl $API_URL/health

# Test frontend
curl $FRONTEND_URL/health

# Open in browser
open $FRONTEND_URL
```

## 🔄 Automated Deployments (GitHub Actions)

### Setup GitHub Secrets

Go to your GitHub repo → Settings → Secrets and variables → Actions

Add these secrets:

```
GCP_SA_KEY            = <contents of terraform-key.json>
GCP_PROJECT_ID        = resume-cast-ai-prod
DB_PASSWORD           = <your database password>
DB_USER               = resumecast
DB_NAME               = resume_db
JWT_SECRET            = <your JWT secret>
REDIS_URL             = <your Redis URL>
LLM_SERVICE_URL       = https://llm.yourdomain.com
LLM_WEBHOOK_SECRET    = <your webhook secret>
HOME_NETWORK_IP       = 203.0.113.42/32
FRONTEND_URL          = https://resumecast.ai
```

### How It Works

After setup:

1. **Push to main branch** → GitHub Actions automatically:
   - Runs `terraform apply` (updates infrastructure)
   - Builds Docker images
   - Pushes to Artifact Registry
   - Deploys to Cloud Run
   - Runs database migrations

2. **Open PR** → GitHub Actions:
   - Runs `terraform plan`
   - Comments on PR with infrastructure changes

## 📊 Check Your Deployment

```bash
# GCP Console URLs (replace PROJECT_ID)
https://console.cloud.google.com/run?project=resume-cast-ai-prod
https://console.cloud.google.com/sql?project=resume-cast-ai-prod
https://console.cloud.google.com/storage?project=resume-cast-ai-prod

# CLI commands
gcloud run services list --region=us-central1
gcloud sql instances list
gcloud storage buckets list
```

## 💰 Cost Monitoring

View current costs:
```bash
# GCP Console Billing
https://console.cloud.google.com/billing?project=resume-cast-ai-prod

# Set up budget alerts (recommended)
gcloud billing budgets create \
  --billing-account=YOUR_BILLING_ACCOUNT \
  --display-name="ResumeCast Monthly Budget" \
  --budget-amount=50USD \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90
```

## 🔧 Common Tasks

### Update a Service

```bash
# Make code changes, then:
docker build -t $REGISTRY_URL/api-service:latest -f apps/api-service/Dockerfile .
docker push $REGISTRY_URL/api-service:latest

# Cloud Run auto-deploys in ~1 minute
```

### Scale Up

Edit `terraform.tfvars`:
```hcl
database_tier = "db-custom-4-32768"  # More powerful
api_max_instances = 50               # More capacity
```

Apply:
```bash
terraform apply
```

### View Logs

```bash
# API service logs
gcloud run logs read api-service --region=us-central1 --limit=50

# Frontend logs
gcloud run logs read frontend --region=us-central1 --limit=50

# Database logs
gcloud sql operations list --instance=$(terraform output -raw database_instance_name)
```

### Rollback

```bash
# Rollback to previous revision
gcloud run services update-traffic api-service \
  --region=us-central1 \
  --to-revisions=PREVIOUS_REVISION=100
```

## 🆘 Troubleshooting

### "Home IP can't connect to database"

```bash
# Check your current IP
curl ifconfig.me

# Update terraform.tfvars with new IP
home_network_ip = "NEW_IP/32"

# Apply changes
terraform apply
```

### "Cloud Run deployment failed"

```bash
# Check error logs
gcloud run services describe api-service --region=us-central1

# View recent logs
gcloud run logs read api-service --region=us-central1 --limit=100

# Common issues:
# - Missing environment variable
# - Database connection failed
# - Image build error
```

### "Database migrations failed"

```bash
# Connect manually and check
DATABASE_URL=$(terraform output -raw database_url_for_home_llm)
psql "$DATABASE_URL"

# Run migrations manually
cd apps/api-service
DATABASE_URL=$DATABASE_URL npx prisma migrate deploy
```

## 📝 Next Steps

1. ✅ Setup custom domain in Cloud Run
2. ✅ Configure Cloud CDN for frontend
3. ✅ Setup monitoring and alerts
4. ✅ Enable Cloud Armor for DDoS protection
5. ✅ Configure backup retention policies
6. ✅ Setup staging environment (duplicate terraform with different project)

## 📚 Documentation Links

- [Full Terraform README](./README.md)
- [GCP Cloud Run Docs](https://cloud.google.com/run/docs)
- [Cloudflare Tunnel Guide](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Upstash Redis Docs](https://docs.upstash.com/redis)

---

**Estimated Time to Production: 30-45 minutes** (including DNS propagation)
**Monthly Cost: ~$20-35** (100 users/day)
