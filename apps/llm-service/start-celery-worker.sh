#!/bin/bash
# Start Celery worker for LLM Service

set -e

cd "$(dirname "$0")"

# Load environment variables
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Redis configuration
REDIS_HOST=${REDIS_HOST:-localhost}
REDIS_PORT=${REDIS_PORT:-6379}  # Shared Redis (same as API)
REDIS_DB=${REDIS_DB:-1}         # Database 1 (API uses 0)

echo "🚀 Starting Celery worker for LLM Service"
echo "   Redis: $REDIS_HOST:$REDIS_PORT (DB $REDIS_DB)"
echo "   Concurrency: 2 workers"
echo ""

# Start Celery worker
# -A celery_config = app location
# -l info = log level
# --concurrency=2 = number of worker processes (adjust based on CPU)
# -Q default = queue name
# --max-tasks-per-child=50 = restart worker after N tasks (prevent memory leaks)

if [ -n "$USE_POETRY" ]; then
    echo "Using Poetry environment..."
    poetry run celery -A celery_config worker \
        --loglevel=info \
        --concurrency=2 \
        --max-tasks-per-child=50 \
        --task-events \
        --without-gossip \
        --without-mingle \
        --without-heartbeat
else
    celery -A celery_config worker \
        --loglevel=info \
        --concurrency=2 \
        --max-tasks-per-child=50 \
        --task-events \
        --without-gossip \
        --without-mingle \
        --without-heartbeat
fi
