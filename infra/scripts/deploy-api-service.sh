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
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/resumecast-images"
IMAGE_NAME="${REGISTRY}/${SERVICE_NAME}:latest"
MIGRATION_JOB_NAME="api-service-migrate"
DB_SECRET_NAME="database-url"

echo "📦 Building Docker image..."
cat > /tmp/cloudbuild-api.yaml << EOF
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-f'
      - 'apps/api-service/Dockerfile'
      - '-t'
      - '${REGISTRY}/api-service:latest'
      - '.'
images:
  - '${REGISTRY}/api-service:latest'
EOF

gcloud builds submit \
  --region=${REGION} \
  --config=/tmp/cloudbuild-api.yaml \
  --project=${PROJECT_ID} \
  --timeout=10m \
  --gcs-log-dir=gs://${PROJECT_ID}_cloudbuild/logs \
  .

echo ""
echo "🗄️  Applying Prisma migrations via Cloud Run Job..."
DATABASE_URL="$(gcloud secrets versions access latest --secret=${DB_SECRET_NAME} --project=${PROJECT_ID} 2>/dev/null || true)"

if [ -z "${DATABASE_URL}" ]; then
  echo "❌ Could not fetch DATABASE_URL from Secret Manager (secret: ${DB_SECRET_NAME})."
  echo "   Ensure your gcloud account has Secret Manager access and retry."
  exit 1
fi

if [[ "${DATABASE_URL}" =~ /cloudsql/([^?]+) ]]; then
  CLOUDSQL_INSTANCE="${BASH_REMATCH[1]}"
else
  echo "❌ Could not extract Cloud SQL instance from DATABASE_URL."
  echo "   Expected URL containing /cloudsql/<PROJECT:REGION:INSTANCE>."
  exit 1
fi

SERVICE_ACCOUNT="$(gcloud run services describe ${SERVICE_NAME} --region=${REGION} --project=${PROJECT_ID} --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || true)"

JOB_DEPLOY_ARGS=(
  run jobs deploy "${MIGRATION_JOB_NAME}"
  --image "${IMAGE_NAME}"
  --region "${REGION}"
  --project "${PROJECT_ID}"
  --command sh
  --args -c,"npx prisma migrate deploy --schema=/app/prisma/schema.prisma"
  --set-secrets "DATABASE_URL=${DB_SECRET_NAME}:latest"
  --set-cloudsql-instances "${CLOUDSQL_INSTANCE}"
  --max-retries 0
  --task-timeout 10m
)

if [ -n "${SERVICE_ACCOUNT}" ]; then
  JOB_DEPLOY_ARGS+=(--service-account "${SERVICE_ACCOUNT}")
fi

gcloud "${JOB_DEPLOY_ARGS[@]}"
gcloud run jobs execute "${MIGRATION_JOB_NAME}" --region=${REGION} --project=${PROJECT_ID} --wait

echo "✅ Prisma migrations applied"
echo ""

echo ""
echo "☁️  Deploying to Cloud Run..."
echo "⚠️  Note: This updates the image only. Environment variables are preserved."
echo "   To update env vars, use: gcloud run services update api-service --update-env-vars KEY=VALUE"
gcloud run deploy ${SERVICE_NAME} \
  --image=${IMAGE_NAME} \
  --region=${REGION} \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --project=${PROJECT_ID} \
  --quiet

echo ""
echo "✅ API Service deployed successfully!"
echo "🌐 Service URL: https://api-service-t6hqg2nmta-uc.a.run.app"
echo ""
echo "📋 To check logs:"
echo "   gcloud logging read 'resource.labels.service_name=api-service' --limit=50 --project=${PROJECT_ID}"
