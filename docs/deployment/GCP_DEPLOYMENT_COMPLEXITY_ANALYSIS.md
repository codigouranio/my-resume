# Google Cloud Platform Deployment - Complexity Analysis

**Evaluation Date:** March 13, 2026  
**Target Services:** API Service + Frontend (my-resume)  
**Excluded:** LLM Service (remains on-premise with GPU)

## Executive Summary

**Overall Complexity:** 🟡 **MEDIUM** (3-5 days for experienced developer)

**Recommendation:** ✅ **Feasible** - GCP deployment is straightforward with well-documented paths. The application architecture is cloud-ready with minimal modifications needed.

### Complexity Breakdown

| Component | Difficulty | Time Estimate | Rationale |
|-----------|-----------|---------------|-----------|
| Frontend Deployment | 🟢 Low | 0.5 days | Static build → Cloud Storage + CDN |
| API Service Containerization | 🟡 Medium | 1 day | Create Dockerfile, optimize for Cloud Run |
| Database Migration | 🟢 Low | 0.5 days | Cloud SQL compatible, Prisma handles migrations |
| Secrets Management | 🟢 Low | 0.5 days | Secret Manager integration straightforward |
| CI/CD Pipeline | 🟡 Medium | 1 day | Cloud Build or GitHub Actions setup |
| Infrastructure as Code | 🟡 Medium | 1.5 days | Terraform or Pulumi for reproducibility |
| Testing & Validation | 🟢 Low | 0.5 days | Existing health checks, minimal changes |

**Total Estimated Effort:** 5 days (single developer) or 3 days (parallel work)

---

## Current Architecture Analysis

### What Exists Now

```
┌─────────────────────────────────────────────────────────────┐
│                   Current Deployment                         │
└─────────────────────────────────────────────────────────────┘

Frontend (React + Rsbuild)
├─ Option 1: AWS S3 + CloudFront (CDK code exists)
└─ Option 2: Bare metal with Nginx (Ansible exists)

API Service (NestJS + Prisma)
└─ Bare metal deployment via Ansible
   ├─ Node.js via Conda environment
   ├─ PM2 process manager (2 instances, cluster mode)
   ├─ PostgreSQL 15 (local)
   ├─ Nginx reverse proxy
   └─ SSL via CloudFlare

LLM Service (Flask)
└─ On-premise only (requires RTX 3090 GPU)
   └─ Communicates via HTTP API
```

### Application Characteristics (GCP-Friendly)

✅ **Already Cloud-Ready:**
- **Stateless API Service** - Perfect for Cloud Run or App Engine
- **Environment-based configuration** - All settings via .env
- **PostgreSQL database** - Direct Cloud SQL compatibility
- **JWT authentication** - No session state, fully portable
- **Health check endpoints** - `/api/health` exists
- **Separate services** - Frontend/API/LLM cleanly separated
- **Static frontend build** - `dist/` folder ready for Cloud Storage

✅ **Modern Stack:**
- Node.js 20 (Cloud Run native support)
- PostgreSQL (Cloud SQL managed)
- Standard HTTP/REST APIs
- No vendor-specific dependencies

⚠️ **Considerations:**
- **LLM service stays on-premise** - Need secure connectivity
- **Database migrations** - Prisma migrate needs careful handling
- **File uploads** - Currently local filesystem, need Cloud Storage
- **PM2 clustering** - Cloud Run handles scaling differently

---

## Proposed GCP Architecture

### Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                         Google Cloud Platform                           │
└────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│   Cloud CDN          │
│   (Global Edge)      │
└──────────────────────┘
          │
          ├─────────────────────┬─────────────────────┐
          │                     │                     │
┌─────────▼─────────┐  ┌────────▼────────┐  ┌───────▼────────┐
│ Cloud Storage     │  │  Cloud Run      │  │ Cloud SQL      │
│ (Frontend Static) │  │  (API Service)  │  │ (PostgreSQL)   │
│                   │  │                  │  │                │
│ • dist/ files     │  │ • Auto-scaling  │  │ • Managed DB   │
│ • index.html      │  │ • 0-N instances │  │ • Backups      │
│ • JS/CSS/images   │  │ • HTTPS native  │  │ • Private IP   │
└───────────────────┘  └─────────┬────────┘  └────────────────┘
                               │
                               │ VPC Connector
                               │
                      ┌────────▼────────┐
                      │ Secret Manager  │
                      │                 │
                      │ • DB password   │
                      │ • JWT secret    │
                      │ • API keys      │
                      │ • LLM service   │
                      └─────────────────┘

┌──────────────────────────────────────────────────────────────┐
│           On-Premise (Your Home Server)                      │
│                                                              │
│   ┌──────────────────┐                                      │
│   │  LLM Service     │◄─────────────────────────────────────┤
│   │  (Flask + GPU)   │  Cloud Run connects via public IP   │
│   │                  │  or VPN tunnel (optional)            │
│   └──────────────────┘                                      │
└──────────────────────────────────────────────────────────────┘
```

### Service Mapping

| Current Service | GCP Service | Notes |
|----------------|-------------|-------|
| **Frontend (React)** | Cloud Storage + Cloud CDN | Static hosting, similar to S3+CloudFront |
| **API Service (NestJS)** | Cloud Run | Serverless containers, auto-scaling 0-N |
| **PostgreSQL** | Cloud SQL for PostgreSQL | Managed database, compatible with Prisma |
| **Nginx** | Cloud Load Balancer (built-in) | Automatic HTTPS, global load balancing |
| **PM2** | Cloud Run (built-in scaling) | No need for PM2, Cloud Run handles processes |
| **Ansible** | Cloud Build + Terraform | Infrastructure as Code + CI/CD |
| **Secrets** | Secret Manager | Encrypted at rest, IAM-based access |
| **LLM Service** | On-Premise (no change) | Keep GPU server, connect via API |

---

## Implementation Roadmap

### Phase 1: Containerization (Day 1) 🟡 Medium

**Goal:** Dockerize API Service for Cloud Run

**Tasks:**

1. **Create Dockerfile for API Service** (2 hours)
   ```dockerfile
   # apps/api-service/Dockerfile
   FROM node:20-alpine AS builder
   
   WORKDIR /app
   COPY package*.json ./
   COPY prisma ./prisma/
   RUN npm ci --only=production
   RUN npx prisma generate
   
   COPY . .
   RUN npm run build
   
   FROM node:20-alpine
   WORKDIR /app
   COPY --from=builder /app/node_modules ./node_modules
   COPY --from=builder /app/dist ./dist
   COPY --from=builder /app/prisma ./prisma
   COPY package*.json ./
   
   EXPOSE 3000
   CMD ["npm", "run", "start:prod"]
   ```

2. **Test locally with Docker Compose** (1 hour)
   ```yaml
   # docker-compose.gcp-test.yml
   services:
     api:
       build: ./apps/api-service
       ports:
         - "3000:3000"
       environment:
         DATABASE_URL: ${DATABASE_URL}
         JWT_SECRET: ${JWT_SECRET}
     
     db:
       image: postgres:15
       environment:
         POSTGRES_DB: resume_db
         POSTGRES_PASSWORD: test123
   ```

3. **Optimize Docker image** (1 hour)
   - Multi-stage builds (already in example)
   - Layer caching optimization
   - Security scanning with `docker scan`

4. **Create .dockerignore** (30 min)
   ```
   node_modules
   dist
   *.log
   .env
   .env.*
   *.md
   test
   ```

**Difficulty:** 🟡 Medium  
**Dependencies:** None  
**Risks:** Low - Dockerfile is straightforward for Node.js apps

---

### Phase 2: GCP Project Setup (Day 1 afternoon) 🟢 Low

**Goal:** Configure GCP resources

**Tasks:**

1. **Create GCP Project** (15 min)
   ```bash
   gcloud projects create my-resume-prod --name="My Resume"
   gcloud config set project my-resume-prod
   gcloud services enable run.googleapis.com sql-component.googleapis.com secretmanager.googleapis.com
   ```

2. **Enable Required APIs** (15 min)
   - Cloud Run API
   - Cloud SQL Admin API  
   - Cloud Storage API
   - Secret Manager API
   - Cloud Build API
   - Cloud CDN API

3. **Set up billing** (5 min)
   - Link billing account
   - Set up budget alerts

4. **Configure IAM** (30 min)
   - Create service account for Cloud Run
   - Grant minimal permissions (least privilege)
   - Create service account for Cloud Build

**Difficulty:** 🟢 Low  
**Dependencies:** GCP account with billing  
**Risks:** Very low - Well-documented process

---

### Phase 3: Database Migration (Day 2 morning) 🟢 Low

**Goal:** Set up Cloud SQL and migrate schema

**Tasks:**

1. **Create Cloud SQL Instance** (30 min)
   ```bash
   gcloud sql instances create resume-db-prod \
     --database-version=POSTGRES_15 \
     --tier=db-f1-micro \
     --region=us-central1 \
     --database-flags=max_connections=100 \
     --backup-start-time=02:00 \
     --enable-bin-log
   ```

2. **Create Database** (15 min)
   ```bash
   gcloud sql databases create resume_db --instance=resume-db-prod
   gcloud sql users create resume_user --instance=resume-db-prod --password=SECURE_PASSWORD
   ```

3. **Run Prisma Migrations** (1 hour)
   ```bash
   # Connect via Cloud SQL Proxy for initial setup
   cloud_sql_proxy -instances=PROJECT:REGION:resume-db-prod=tcp:5432 &
   
   # Set DATABASE_URL
   export DATABASE_URL="postgresql://resume_user:PASSWORD@localhost:5432/resume_db"
   
   # Run migrations
   cd apps/api-service
   npx prisma migrate deploy
   npx prisma generate
   ```

4. **Test Connection** (30 min)
   - Verify tables created
   - Run seed script if needed
   - Test queries from local API

**Difficulty:** 🟢 Low  
**Dependencies:** Phase 2 complete  
**Risks:** Low - Prisma handles PostgreSQL migrations well

---

### Phase 4: Secrets Management (Day 2 afternoon) 🟢 Low

**Goal:** Store credentials in Secret Manager

**Tasks:**

1. **Create Secrets** (1 hour)
   ```bash
   # Database URL
   echo -n "postgresql://resume_user:PASSWORD@/resume_db?host=/cloudsql/PROJECT:REGION:resume-db-prod" | \
     gcloud secrets create database-url --data-file=-
   
   # JWT Secret
   openssl rand -base64 32 | gcloud secrets create jwt-secret --data-file=-
   
   # LLM Service credentials
   gcloud secrets create llm-api-key --data-file=- < <(echo -n "YOUR_API_KEY")
   gcloud secrets create llm-service-password --data-file=- < <(echo -n "YOUR_PASSWORD")
   
   # Stripe keys (if applicable)
   gcloud secrets create stripe-secret-key --data-file=- < <(echo -n "sk_prod_...")
   ```

2. **Grant Access to Cloud Run** (30 min)
   ```bash
   # Get service account email
   SA_EMAIL=$(gcloud iam service-accounts list --filter="displayName:Cloud Run" --format="value(email)")
   
   # Grant access to each secret
   gcloud secrets add-iam-policy-binding database-url \
     --member="serviceAccount:$SA_EMAIL" \
     --role="roles/secretmanager.secretAccessor"
   ```

3. **Update Dockerfile to Use Secrets** (30 min)
   - Cloud Run automatically mounts secrets as env vars
   - No code changes needed

**Difficulty:** 🟢 Low  
**Dependencies:** Phase 2, Phase 3  
**Risks:** Very low - Secret Manager is straightforward

---

### Phase 5: Deploy API to Cloud Run (Day 3) 🟡 Medium

**Goal:** Deploy containerized API service

**Tasks:**

1. **Build and Push Docker Image** (1 hour)
   ```bash
   # Tag for Artifact Registry
   gcloud builds submit --tag gcr.io/my-resume-prod/api-service:latest apps/api-service/
   ```

2. **Deploy to Cloud Run** (1 hour)
   ```bash
   gcloud run deploy api-service \
     --image gcr.io/my-resume-prod/api-service:latest \
     --region us-central1 \
     --platform managed \
     --allow-unauthenticated \
     --memory 512Mi \
     --cpu 1 \
     --min-instances 0 \
     --max-instances 10 \
     --timeout 300 \
     --set-secrets="DATABASE_URL=database-url:latest,JWT_SECRET=jwt-secret:latest" \
     --set-cloudsql-instances PROJECT:REGION:resume-db-prod \
     --vpc-connector my-vpc-connector
   ```

3. **Configure Environment Variables** (30 min)
   ```bash
   gcloud run services update api-service \
     --update-env-vars "NODE_ENV=production,PORT=3000,LLM_SERVICE_URL=https://your-home-server.com:5000"
   ```

4. **Set up Custom Domain** (1 hour)
   ```bash
   # Map domain to Cloud Run
   gcloud run domain-mappings create --service api-service --domain api.resumecast.ai
   
   # Update DNS (Google Cloud DNS or external)
   # Add CNAME record: api.resumecast.ai → ghs.googlehosted.com
   ```

5. **Test Deployment** (1 hour)
   ```bash
   # Health check
   curl https://api-service-xxxx.run.app/api/health
   
   # Authentication
   curl -X POST https://api-service-xxxx.run.app/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"test","password":"test"}'
   ```

**Difficulty:** 🟡 Medium  
**Dependencies:** Phase 1, 2, 3, 4  
**Risks:** Medium - Networking configuration can be tricky

---

### Phase 6: Deploy Frontend to Cloud Storage (Day 3 afternoon) 🟢 Low

**Goal:** Host static frontend on GCS + CDN

**Tasks:**

1. **Create Cloud Storage Bucket** (15 min)
   ```bash
   gsutil mb -c STANDARD -l us-central1 gs://resumecast-frontend/
   gsutil web set -m index.html -e index.html gs://resumecast-frontend/
   ```

2. **Build Frontend** (30 min)
   ```bash
   cd apps/my-resume
   
   # Update API URL in .env
   echo "PUBLIC_API_URL=https://api-service-xxxx.run.app" > .env.production
   echo "PUBLIC_LLM_API_URL=https://your-home-server.com:5000" >> .env.production
   
   # Build
   npm run build
   ```

3. **Upload to Cloud Storage** (30 min)
   ```bash
   gsutil -m rsync -r dist/ gs://resumecast-frontend/
   
   # Set cache control
   gsutil -m setmeta -h "Cache-Control:public, max-age=3600" gs://resumecast-frontend/**/*.html
   gsutil -m setmeta -h "Cache-Control:public, max-age=31536000" gs://resumecast-frontend/**/*.{js,css,png,jpg}
   ```

4. **Configure Load Balancer + CDN** (1 hour)
   ```bash
   # Create backend bucket
   gcloud compute backend-buckets create resumecast-backend \
     --gcs-bucket-name=resumecast-frontend \
     --enable-cdn
   
   # Create URL map
   gcloud compute url-maps create resumecast-lb \
     --default-backend-bucket=resumecast-backend
   
   # Create HTTP(S) target proxy
   gcloud compute target-https-proxies create resumecast-proxy \
     --url-map=resumecast-lb \
     --ssl-certificates=resumecast-cert
   
   # Create forwarding rule
   gcloud compute forwarding-rules create resumecast-https \
     --target-https-proxy=resumecast-proxy \
     --ports=443 \
     --global
   ```

5. **Configure Custom Domain** (30 min)
   ```bash
   # Update DNS
   # A record: resumecast.ai → Load Balancer IP
   ```

**Difficulty:** 🟢 Low  
**Dependencies:** Phase 5 (API URL needed)  
**Risks:** Low - Similar to S3+CloudFront deployment

---

### Phase 7: Infrastructure as Code (Day 4-5) 🟡 Medium

**Goal:** Make deployment reproducible with Terraform

**Tasks:**

1. **Create Terraform Configuration** (3 hours)
   ```hcl
   # main.tf
   terraform {
     required_providers {
       google = {
         source  = "hashicorp/google"
         version = "~> 5.0"
       }
     }
   }
   
   provider "google" {
     project = var.project_id
     region  = var.region
   }
   
   # Cloud SQL
   resource "google_sql_database_instance" "main" {
     name             = "resume-db-prod"
     database_version = "POSTGRES_15"
     region           = var.region
     
     settings {
       tier = "db-f1-micro"
       backup_configuration {
         enabled    = true
         start_time = "02:00"
       }
     }
   }
   
   # Cloud Run
   resource "google_cloud_run_service" "api" {
     name     = "api-service"
     location = var.region
     
     template {
       spec {
         containers {
           image = "gcr.io/${var.project_id}/api-service:latest"
           
           env {
             name = "NODE_ENV"
             value = "production"
           }
         }
       }
     }
   }
   
   # Cloud Storage
   resource "google_storage_bucket" "frontend" {
     name     = "${var.project_id}-frontend"
     location = var.region
     
     website {
       main_page_suffix = "index.html"
       not_found_page   = "index.html"
     }
   }
   ```

2. **Create Variables File** (1 hour)
   ```hcl
   # variables.tf
   variable "project_id" {
     description = "GCP Project ID"
     type        = string
   }
   
   variable "region" {
     description = "GCP Region"
     type        = string
     default     = "us-central1"
   }
   ```

3. **Create Modules** (2 hours)
   - `modules/cloud-run/` - API service deployment
   - `modules/cloud-sql/` - Database setup
   - `modules/frontend/` - Cloud Storage + CDN
   - `modules/secrets/` - Secret Manager

4. **Test Terraform** (1 hour)
   ```bash
   cd infra/gcp
   terraform init
   terraform plan
   terraform apply
   ```

**Difficulty:** 🟡 Medium  
**Dependencies:** Phases 1-6 complete and tested  
**Risks:** Medium - Terraform learning curve if unfamiliar

---

### Phase 8: CI/CD Pipeline (Day 5) 🟡 Medium

**Goal:** Automate deployments with Cloud Build

**Tasks:**

1. **Create Cloud Build Configuration** (2 hours)
   ```yaml
   # cloudbuild.yaml
   steps:
     # Build API Service
     - name: 'gcr.io/cloud-builders/docker'
       args: ['build', '-t', 'gcr.io/$PROJECT_ID/api-service:$COMMIT_SHA', 'apps/api-service']
     
     # Push to Artifact Registry
     - name: 'gcr.io/cloud-builders/docker'
       args: ['push', 'gcr.io/$PROJECT_ID/api-service:$COMMIT_SHA']
     
     # Deploy to Cloud Run
     - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
       entrypoint: gcloud
       args:
         - 'run'
         - 'deploy'
         - 'api-service'
         - '--image=gcr.io/$PROJECT_ID/api-service:$COMMIT_SHA'
         - '--region=us-central1'
     
     # Build Frontend
     - name: 'node:20'
       dir: 'apps/my-resume'
       entrypoint: npm
       args: ['run', 'build']
     
     # Deploy Frontend to Cloud Storage
     - name: 'gcr.io/cloud-builders/gsutil'
       args: ['-m', 'rsync', '-r', '-d', 'apps/my-resume/dist/', 'gs://resumecast-frontend/']
   
   images:
     - 'gcr.io/$PROJECT_ID/api-service:$COMMIT_SHA'
   ```

2. **Configure Triggers** (1 hour)
   ```bash
   gcloud builds triggers create github \
     --repo-name=my-resume \
     --repo-owner=codigouranio \
     --branch-pattern="^main$" \
     --build-config=cloudbuild.yaml
   ```

3. **Add GitHub Actions (Alternative)** (1 hour)
   ```yaml
   # .github/workflows/gcp-deploy.yml
   name: Deploy to GCP
   on:
     push:
       branches: [main]
   
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         
         - name: Setup Cloud SDK
           uses: google-github-actions/setup-gcloud@v1
           with:
             service_account_key: ${{ secrets.GCP_SA_KEY }}
             project_id: my-resume-prod
         
         - name: Build and Deploy
           run: |
             gcloud builds submit --config cloudbuild.yaml
   ```

4. **Test CI/CD** (30 min)
   - Push commit to main branch
   - Verify automatic deployment
   - Check Cloud Build logs

**Difficulty:** 🟡 Medium  
**Dependencies:** All previous phases  
**Risks:** Low - Cloud Build is well-documented

---

## Cost Estimation

### Monthly GCP Costs (Estimated)

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| **Cloud Run (API)** | 512Mi RAM, 1 vCPU, ~100k requests/month | $5-15 |
| **Cloud SQL** | db-f1-micro (0.6GB RAM, shared CPU) | $7-10 |
| **Cloud Storage** | 10GB storage, 1TB transfer/month | $1-3 |
| **Cloud CDN** | 1TB egress/month | $8-12 |
| **Secret Manager** | 4 secrets, 10k accesses/month | $0.50 |
| **Cloud Build** | 120 builds/month (free tier: 120/day) | $0 |
| **Load Balancer** | Forwarding rules + data processed | $18-25 |

**Total Monthly Cost:** ~$40-65 USD

### Comparison with Current Costs

| Deployment | Monthly Cost | Notes |
|-----------|--------------|-------|
| **Current (Bare Metal)** | $0 (own hardware) + electricity | One-time hardware cost, maintenance time |
| **Current (AWS)** | ~$30-50 | S3 + CloudFront only (no API) |
| **GCP (Proposed)** | ~$40-65 | Full stack with managed services |
| **AWS (Full Stack)** | ~$50-80 | ECS + RDS comparable |

**Cost Optimization Options:**
- Use Cloud Run min-instances=0 (scale to zero when idle)
- Use db-f1-micro for development (upgrade to db-g1-small for production)
- Enable Cloud CDN caching (reduce Cloud Run requests)
- Use Committed Use Discounts (30-57% savings for 1-3 year commitment)

---

## Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Database migration issues** | Low | High | Test migrations in staging environment first |
| **Networking connectivity to LLM** | Medium | High | Use VPN tunnel or Cloud NAT with static IP |
| **Cold start latency** | Medium | Medium | Set min-instances=1 for API service |
| **Database connection limits** | Low | Medium | Use Cloud SQL Proxy, implement connection pooling |
| **Secret access issues** | Low | High | Test IAM permissions thoroughly before production |
| **Build failures** | Low | Low | Test Docker builds locally before Cloud Build |

### Operational Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Cost overruns** | Medium | Medium | Set budget alerts, monitor daily |
| **Service outages** | Low | High | Use multi-region (future), health checks, alerts |
| **Data loss** | Very Low | Very High | Enable Cloud SQL backups, test restore process |
| **Security breaches** | Low | Very High | Follow GCP security best practices, audit IAM |
| **Vendor lock-in** | Medium | Low | Use standard technologies (PostgreSQL, Docker) |

---

## Prerequisites & Requirements

### Skills Required

**Essential:**
- ✅ Docker basics (Dockerfile, docker-compose)
- ✅ GCP fundamentals (projects, IAM, billing)
- ✅ Terminal/CLI comfort
- ✅ Node.js/npm knowledge
- ✅ PostgreSQL basics

**Helpful but not required:**
- Terraform or Infrastructure as Code
- Cloud Run experience
- GitHub Actions / CI/CD
- Networking concepts (VPC, Load Balancers)

### Tools Needed

- `gcloud` CLI (Google Cloud SDK)
- `docker` CLI
- `terraform` (if using IaC approach)
- `git`
- Text editor
- GCP account with billing enabled

### Time Requirements

**Full Implementation:**
- **Experienced developer:** 3-5 days
- **Learning while doing:** 7-10 days
- **Part-time (evenings/weekends):** 2-3 weeks

**Minimum Viable Deployment:**
- **Quick & dirty (manual):** 1 day
- **Production-ready (with IaC):** 3 days

---

## Alternative Approaches

### Option 1: Cloud Run Only (⭐ Recommended)

**Pros:**
- ✅ Simplest deployment path
- ✅ Auto-scaling and serverless
- ✅ Only pay when requests served
- ✅ Managed HTTPS certificates
- ✅ Easy rollbacks

**Cons:**
- ⚠️ Cold start latency (~1-2 seconds)
- ⚠️ 15-minute max request timeout
- ⚠️ No persistent local storage

**Use Case:** Best for 95% of applications, including this one

### Option 2: Google Kubernetes Engine (GKE)

**Pros:**
- ✅ Full container orchestration
- ✅ No cold starts
- ✅ More control over networking
- ✅ Multi-tenant capabilities

**Cons:**
- ❌ Higher complexity (Kubernetes learning curve)
- ❌ Higher cost ($75+ minimum for cluster)
- ❌ More operational overhead

**Use Case:** Only if you need advanced orchestration or have Kubernetes expertise

### Option 3: App Engine Standard

**Pros:**
- ✅ Even simpler than Cloud Run
- ✅ Auto-scaling included
- ✅ No Docker required

**Cons:**
- ⚠️ Less flexibility than Cloud Run
- ⚠️ Node.js 20 support (check compatibility)
- ⚠️ Vendor lock-in (App Engine specific)

**Use Case:** Good for simple apps, but Cloud Run is more flexible

### Option 4: Compute Engine (VMs)

**Pros:**
- ✅ Full control like bare metal
- ✅ Can use existing Ansible playbooks

**Cons:**
- ❌ Manual scaling
- ❌ Manual patching and maintenance
- ❌ Always-on cost (no scale to zero)

**Use Case:** Only if you really need VM-level control

---

## Migration Strategy

### Recommended Approach: Phased Migration

**Phase 1: Development Environment (Week 1)**
- Deploy to GCP development project
- Test all features
- Validate LLM service connectivity
- Performance testing

**Phase 2: Staging Environment (Week 2)**
- Deploy to staging project
- Load testing
- Security audit
- DNS configuration

**Phase 3: Production Cutover (Week 3)**
- Deploy to production project
- Parallel run (old + new)
- DNS switch with low TTL
- Monitor for 48 hours
- Decomission old infrastructure

### Rollback Plan

1. Keep old infrastructure running for 2 weeks
2. Low DNS TTL (5 minutes) during migration
3. Database exported before migration
4. Quick DNS revert if issues found

---

## Decision Matrix

### Should You Deploy to GCP?

**Deploy to GCP if:**
- ✅ You want managed infrastructure
- ✅ You need auto-scaling
- ✅ You want to reduce maintenance burden
- ✅ Cost ($40-65/month) is acceptable
- ✅ You have 3-5 days for initial setup

**Stick with current deployment if:**
- ❌ $40-65/month is too expensive
- ❌ You enjoy managing infrastructure
- ❌ You have excellent uptime with current setup
- ❌ You don't have time for migration
- ❌ You prefer full control over VM details

---

## Next Steps

### If Proceeding with GCP Deployment:

1. **Create GCP account and project** (Day 0)
2. **Follow Phase 1-2** (Day 1) - Containerization + GCP setup
3. **Follow Phase 3-4** (Day 2) - Database + Secrets
4. **Follow Phase 5-6** (Day 3) - Deploy services
5. **Test thoroughly** (Day 3-4)
6. **Document and automate** (Day 4-5)
7. **Production cutover** (Day 5+)

### Recommended Resources:

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud SQL for PostgreSQL](https://cloud.google.com/sql/docs/postgres)
- [Cloud Build Quickstart](https://cloud.google.com/build/docs/quickstart-build)
- [Terraform GCP Provider](https://registry.terraform.io/providers/hashicorp/google/latest/docs)
- [NestJS Docker Best Practices](https://docs.nestjs.com/recipes/docker)

---

## Conclusion

**Complexity Rating:** 🟡 **MEDIUM** (3-5 days)

**Recommendation:** ✅ **Proceed** - The application is well-suited for GCP deployment with Cloud Run. The architecture is already cloud-ready, and the migration path is straightforward.

**Key Success Factors:**
1. Start with Phase 1-2 to validate approach
2. Use development project for testing
3. Automate with Terraform after manual validation
4. Keep LLM service on-premise as planned
5. Monitor costs daily during initial rollout

**Expected Benefits:**
- Auto-scaling from 0 to N instances
- Managed database with automatic backups
- Global CDN for frontend
- Reduced operational burden
- Standard deployment patterns for future features

**Total Investment:** 3-5 days of focused work = Production-ready GCP deployment

---

**Document Version:** 1.0  
**Last Updated:** March 13, 2026  
**Author:** GitHub Copilot Analysis  
**Status:** Ready for Implementation
