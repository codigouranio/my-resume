#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

cd "${REPO_ROOT}"

echo "🚀 Deploying Frontend to Cloud Run..."
echo ""

# Configuration
PROJECT_ID="resume-cast-ai-prod"
REGION="us-central1"
SERVICE_NAME="frontend"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/resumecast-images"
IMAGE_NAME="${REGISTRY}/${SERVICE_NAME}:latest"

# Build arguments
PUBLIC_API_URL="https://api.resumecast.ai/api"

echo "📦 Building Docker image..."
cat > /tmp/cloudbuild-frontend.yaml << EOF
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-f'
      - 'apps/my-resume/Dockerfile'
      - '--build-arg'
      - 'PUBLIC_API_URL=${PUBLIC_API_URL}'
      - '-t'
      - '${REGISTRY}/frontend:latest'
      - '.'
images:
  - '${REGISTRY}/frontend:latest'
EOF

gcloud builds submit \
  --region=${REGION} \
  --config=/tmp/cloudbuild-frontend.yaml \
  --project=${PROJECT_ID} \
  --timeout=10m \
  --gcs-log-dir=gs://${PROJECT_ID}_cloudbuild/logs \
  .

echo ""
echo "☁️  Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image=${IMAGE_NAME} \
  --region=${REGION} \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --project=${PROJECT_ID} \
  --quiet

echo ""
echo "✅ Frontend deployed successfully!"
echo "🌐 Service URL: https://frontend-584996648931.us-central1.run.app"
echo ""
echo "⚠️  Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R) to see changes"
