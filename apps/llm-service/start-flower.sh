#!/bin/bash
# Start Flower monitoring dashboard for Celery

set -e

cd "$(dirname "$0")"

# Load environment variables
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
fi

REDIS_HOST=${REDIS_HOST:-localhost}
REDIS_PORT=${REDIS_PORT:-6380}
FLOWER_PORT=${FLOWER_PORT:-5555}

echo "🌸 Starting Flower monitoring dashboard"
echo "   Redis: $REDIS_HOST:$REDIS_PORT"
echo "   Dashboard: http://localhost:$FLOWER_PORT"
echo ""

# Start Flower
# -A celery_config = app location
# --port=5555 = web interface port
# --broker = Redis URL
# --persistent = enable persistent mode (saves state)
# --db = SQLite database for persistence

if [ -n "$USE_POETRY" ]; then
    echo "Using Poetry environment..."
    poetry run celery -A celery_config flower \
        --port=$FLOWER_PORT \
        --persistent=True \
        --db=flower.db
else
    celery -A celery_config flower \
        --port=$FLOWER_PORT \
        --persistent=True \
        --db=flower.db
fi
