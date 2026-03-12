"""
Celery configuration for LLM Service.

For MVP/POC: Shares Redis with API service using different database.
API service uses database 0, LLM service uses database 1.
"""

import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

# Redis configuration (shared with API service, different database)
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")  # Same port as API service
REDIS_DB = os.getenv("REDIS_DB", "1")  # Database 1 (API uses 0)
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)

# Build Redis URL
redis_url = (
    f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"
    if REDIS_PASSWORD
    else f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"
)

# Create Celery app
celery_app = Celery(
    "llm_service",
    broker=redis_url,
    backend=redis_url,
)

# Celery configuration
celery_app.conf.update(
    # Task execution settings
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Task time limits
    task_time_limit=600,  # 10 minutes hard limit
    task_soft_time_limit=540,  # 9 minutes soft limit
    # Retry settings
    task_acks_late=True,  # Acknowledge task after completion
    task_reject_on_worker_lost=True,  # Re-queue if worker crashes
    # Result backend settings
    result_expires=3600,  # Results expire after 1 hour
    result_backend_transport_options={
        "master_name": "mymaster",
        "retry_on_timeout": True,
    },
    # Rate limiting (per customer/API key)
    task_annotations={
        "llm_service.tasks.research_company_task": {
            "rate_limit": "10/m",  # 10 per minute
        },
        "llm_service.tasks.analyze_position_task": {
            "rate_limit": "10/m",  # 10 per minute
        },
    },
    # Worker settings
    worker_prefetch_multiplier=1,  # One task at a time per worker
    worker_max_tasks_per_child=50,  # Restart worker after 50 tasks (prevent memory leaks)
    # Monitoring
    worker_send_task_events=True,  # Enable task events for Flower
    task_send_sent_event=True,
)

# Import tasks module to register tasks with Celery
# This must be done after celery_app is configured to avoid circular imports
try:
    import tasks  # noqa: F401
except ImportError as e:
    import logging
    logging.warning(f"Could not import tasks module: {e}")
