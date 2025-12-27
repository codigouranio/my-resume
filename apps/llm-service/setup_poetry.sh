#!/bin/bash
# Setup script for LLM service with Poetry

set -e

echo "Setting up LLM Service with Poetry..."

# Check if poetry is available
if ! command -v poetry &> /dev/null; then
    echo "Error: poetry command not found."
    echo "Please install Poetry first:"
    echo "  curl -sSL https://install.python-poetry.org | python3 -"
    echo "Or visit: https://python-poetry.org/docs/#installation"
    exit 1
fi

# Configure poetry to create virtualenv in project
poetry config virtualenvs.in-project true

# Install dependencies (excluding llama-cpp-python which needs special build)
echo "Installing dependencies with Poetry..."
poetry install --no-root

# Install llama-cpp-python with CUDA support
echo "Installing llama-cpp-python with CUDA support..."
poetry run pip install llama-cpp-python --force-reinstall --no-cache-dir \
    --config-settings=cmake.args="-DLLAMA_CUBLAS=on"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    echo "Please edit .env and set LLAMA_MODEL_PATH to your model file"
fi

# Create models directory
if [ ! -d "models" ]; then
    echo "Creating models directory..."
    mkdir models
    echo "Please download a LLAMA model in GGUF format to the models/ directory"
    echo "Example: wget https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q4_K_M.gguf"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Download a LLAMA model to models/ directory"
echo "2. Edit .env and set LLAMA_MODEL_PATH"
echo "3. Run the service:"
echo "   USE_POETRY=true ./run.sh"
echo ""
echo "To activate the Poetry environment manually:"
echo "   poetry shell"
