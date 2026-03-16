#!/bin/bash
# Quick test script for FastAPI migration

set -e

cd "$(dirname "$0")"

echo "================================================"
echo "FastAPI LLM Service - Quick Start"
echo "================================================"

# Check if we need to install dependencies
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Copy from .env.example:"
    echo "   cp .env.example .env"
    exit 1
fi

# Load environment
export $(cat .env | grep -v '^#' | xargs)

# Try to use existing Poetry installation
if [ -f ./setup_poetry.sh ]; then
    echo "Using Poetry setup script..."
    source ./setup_poetry.sh
    poetry add fastapi 'uvicorn[standard]'
    
    echo ""
    echo "================================================"
    echo "✅ Dependencies installed"
    echo "================================================"
    echo ""
    echo "Starting FastAPI server..."
    echo "📖 Swagger UI: http://localhost:5000/docs"
    echo "📖 ReDoc: http://localhost:5000/redoc"
    echo ""
    
    poetry run uvicorn app_fastapi:app --reload --host 0.0.0.0 --port 5000
else
    echo "No Poetry setup found, using pip..."
    
    # Create venv if doesn't exist
    if [ ! -d venv ]; then
        python3 -m venv venv
    fi
    
    source venv/bin/activate
    
    pip install -q fastapi 'uvicorn[standard]' python-dotenv requests pyjwt
    
    echo ""
    echo "================================================"
    echo "✅ Dependencies installed"
    echo "================================================"
    echo ""
    echo "Starting FastAPI server..."
    echo "📖 Swagger UI: http://localhost:5000/docs"
    echo "📖 ReDoc: http://localhost:5000/redoc"
    echo ""
    
    uvicorn app_fastapi:app --reload --host 0.0.0.0 --port 5000
fi
