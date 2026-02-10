#!/bin/bash
# Wrapper script to run LLM service

# Change to service directory
cd /opt/my-resume/apps/llm-service

export $(grep -v '^#' .env | xargs)

# Run the Flask app with absolute python path from conda
exec /opt/miniconda3/bin/python3 app_remote.py
