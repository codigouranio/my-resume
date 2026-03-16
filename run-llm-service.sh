#!/bin/bash
# Wrapper script to run LLM service with FastAPI

# Change to service directory
cd /opt/my-resume/apps/llm-service

export $(grep -v '^#' .env | xargs)

# Run FastAPI with uvicorn (2 workers for production)
exec /opt/miniconda3/bin/python3 -m uvicorn app_fastapi:app --host 0.0.0.0 --port ${PORT:-5000} --workers 2
