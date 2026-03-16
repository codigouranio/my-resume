#!/bin/bash
#
# Initial GCP Deployment Script
# Run this after completing manual GCP setup
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   GCP Deployment - Initial Setup          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI not found. Install from: https://cloud.google.com/sdk/docs/install${NC}"
    exit 1
fi

if ! command -v terraform &> /dev/null; then
    echo -e "${RED}❌ terraform not found. Install from: https://www.terraform.io/downloads${NC}"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ docker not found. Install from: https://docs.docker.com/get-docker/${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites found${NC}"
echo ""

# Navigate to terraform directory
cd infra/gcp

# Check if terraform.tfvars exists
if [ ! -f "terraform.tfvars" ]; then
    echo -e "${YELLOW}📝 Creating terraform.tfvars from example...${NC}"
    cp terraform.tfvars.example terraform.tfvars
    echo -e "${RED}⚠️  Please edit terraform.tfvars with your actual values, then run this script again.${NC}"
    echo ""
    echo "Required values:"
    echo "  - project_id"
    echo "  - home_network_ip (get from: curl ifconfig.me)"
    echo "  - database_password"
    echo "  - redis_url (sign up at upstash.com)"
    echo "  - jwt_secret (generate with: openssl rand -base64 32)"
    echo "  - llm_webhook_secret (generate with: openssl rand -base64 32)"
    exit 1
fi

echo -e "${YELLOW}🔐 Checking authentication...${NC}"
if [ ! -f "terraform-key.json" ]; then
    echo -e "${RED}❌ terraform-key.json not found${NC}"
    echo "Create it with:"
    echo "  gcloud iam service-accounts keys create terraform-key.json \\"
    echo "    --iam-account=terraform@PROJECT_ID.iam.gserviceaccount.com"
    exit 1
fi

export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/terraform-key.json"
echo -e "${GREEN}✅ Authentication configured${NC}"
echo ""

# Terraform init
echo -e "${YELLOW}🔧 Initializing Terraform...${NC}"
terraform init
echo ""

# Terraform validate
echo -e "${YELLOW}✓ Validating configuration...${NC}"
terraform validate
echo -e "${GREEN}✅ Configuration valid${NC}"
echo ""

# Terraform plan
echo -e "${YELLOW}📋 Creating deployment plan...${NC}"
terraform plan -out=tfplan
echo ""

# Confirm deployment
echo -e "${YELLOW}═══════════════════════════════════════════${NC}"
echo -e "${YELLOW}Ready to deploy infrastructure to GCP${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════${NC}"
echo ""
echo "This will create:"
echo "  ☁️  Cloud SQL PostgreSQL instance"
echo "  🚀 Cloud Run services (API + Frontend)"
echo "  🗄️  Cloud Storage buckets"
echo "  🔐 Secret Manager secrets"
echo "  📦 Artifact Registry repository"
echo ""
read -p "Continue with deployment? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${RED}Deployment cancelled${NC}"
    exit 0
fi

# Terraform apply
echo ""
echo -e "${YELLOW}🚀 Deploying infrastructure (this takes 5-10 minutes)...${NC}"
terraform apply tfplan

echo ""
echo -e "${GREEN}✅ Infrastructure deployed successfully!${NC}"
echo ""

# Save outputs
echo -e "${YELLOW}📄 Saving deployment information...${NC}"
terraform output > DEPLOYMENT_INFO.txt
terraform output -json > DEPLOYMENT_INFO.json

echo -e "${GREEN}✅ Deployment info saved to DEPLOYMENT_INFO.txt${NC}"
echo ""

# Get important values
API_URL=$(terraform output -raw api_service_url)
FRONTEND_URL=$(terraform output -raw frontend_service_url)
REGISTRY_URL=$(terraform output -raw artifact_registry_url)
DB_URL=$(terraform output -raw database_url_for_home_llm)

# Summary
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Deployment Complete!                     ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1️⃣  Build and push Docker images:"
echo "   gcloud auth configure-docker us-central1-docker.pkg.dev"
echo "   docker build -t $REGISTRY_URL/api-service:latest -f ../../apps/api-service/Dockerfile ../.."
echo "   docker push $REGISTRY_URL/api-service:latest"
echo ""
echo "2️⃣  Run database migrations:"
echo "   cd ../../apps/api-service"
echo "   DATABASE_URL=\"$DB_URL\" npx prisma migrate deploy"
echo ""
echo "3️⃣  Access your services:"
echo "   API: $API_URL"
echo "   Frontend: $FRONTEND_URL"
echo ""
echo "4️⃣  Setup home LLM service with:"
echo "   DATABASE_URL=$DB_URL"
echo "   API_SERVICE_URL=$API_URL"
echo ""
echo "5️⃣  Setup GitHub Actions (add secrets to repo):"
echo "   - GCP_SA_KEY (contents of terraform-key.json)"
echo "   - See GCP_DEPLOYMENT_GUIDE.md for full list"
echo ""
echo -e "${GREEN}📚 Full documentation: ../../GCP_DEPLOYMENT_GUIDE.md${NC}"
echo ""
