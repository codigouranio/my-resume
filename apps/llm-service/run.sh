#!/bin/bash
# Run script for LLM service

set -e

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check which environment manager to use
if [ "$USE_POETRY" = "true" ]; then
    echo "Using Poetry environment..."
    # Check if poetry is available
    if command -v poetry &> /dev/null; then
        # Poetry will use the virtualenv in .venv
        PYTHON_CMD="poetry run python"
        GUNICORN_CMD="poetry run gunicorn"
    else
        echo "Error: poetry command not found. Please install Poetry or set USE_POETRY=false"
        exit 1
    fi
elif [ "$USE_CONDA" = "true" ]; then
    echo "Using conda environment..."
    # Check if conda is available
    if command -v conda &> /dev/null; then
        # Activate conda environment
        eval "$(conda shell.bash hook)"
        conda activate llm-service
        PYTHON_CMD="python"
        GUNICORN_CMD="gunicorn"
    else
        echo "Error: conda command not found. Please install conda or set USE_CONDA=false"
        exit 1
    fi
else
    # Activate virtual environment if it exists
    if [ -d "venv" ]; then
        echo "Using virtual environment..."
        source venv/bin/activate
    fi
    PYTHON_CMD="python"
    GUNICORN_CMD="gunicorn"
fi

# Check if model file exists
if [ ! -f "$LLAMA_MODEL_PATH" ]; then
    echo "Error: Model file not found at $LLAMA_MODEL_PATH"
    echo "Please download a LLAMA model in GGUF format"
    exit 1
fi

echo "Starting LLM service..."
echo "Model: $LLAMA_MODEL_PATH"
echo "Port: ${PORT:-5000}"

# Run with gunicorn for production or python for development
if [ "$FLASK_ENV" = "development" ]; then
    $PYTHON_CMD app.py
else
    $GUNICORN_CMD -w 1 -b ${HOST:-0.0.0.0}:${PORT:-5000} --timeout 120 --log-level info app:app
fi
