#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

cd "${REPO_ROOT}"

echo "🚀 Deploying API Service to Cloud Run..."
echo ""

# Configuration
PROJECT_ID="resume-cast-ai-prod"
REGION="us-central1"
SERVICE_NAME="api-service"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"

echo "📦 Building Docker image..."
cat > /tmp/cloudbuild-api.yaml << 'EOF'
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-f'
      - 'apps/api-service/Dockerfile'
      - '-t'
      - 'gcr.io/resume-cast-ai-prod/api-service:latest'
      - '.'
images:
  - 'gcr.io/resume-cast-ai-prod/api-service:latest'
EOF

gcloud builds submit \
  --region=${REGION} \
  --config=/tmp/cloudbuild-api.yaml \
  --project=${PROJECT_ID} \
  --timeout=10m \
  --gcs-log-dir=gs://${PROJECT_ID}_cloudbuild/logs \
  .

echo ""
echo "☁️  Deploying to Cloud Run..."
echo "⚠️  Note: This updates the image only. Environment variables are preserved."
echo "   To update env vars, use: gcloud run services update api-service --update-env-vars KEY=VALUE"
gcloud run deploy ${SERVICE_NAME} \
  --image=${IMAGE_NAME} \
  --region=${REGION} \
  --platform=managed \
  --allow-unauthenticated \
  --port=3000 \
  --project=${PROJECT_ID} \
  --quiet

echo ""
echo "✅ API Service deployed successfully!"
echo "🌐 Service URL: https://api-service-t6hqg2nmta-uc.a.run.app"
echo ""
echo "📋 To check logs:"
echo "   gcloud logging read 'resource.labels.service_name=api-service' --limit=50 --project=${PROJECT_ID}"
