#!/bin/bash
# Setup script for LLM service with conda

set -e

echo "Setting up LLM Service with conda..."

# Check if conda is available
if ! command -v conda &> /dev/null; then
    echo "Error: conda command not found. Please install Miniconda or Anaconda first."
    echo "Visit: https://docs.conda.io/en/latest/miniconda.html"
    exit 1
fi

# Create conda environment
echo "Creating conda environment from environment.yml..."
conda env create -f environment.yml

# Activate environment
echo "Activating llm-service environment..."
eval "$(conda shell.bash hook)"
conda activate llm-service

# Install llama-cpp-python with CUDA support
echo "Installing llama-cpp-python with CUDA support..."
CMAKE_ARGS="-DLLAMA_CUBLAS=on" pip install llama-cpp-python --force-reinstall --no-cache-dir

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
echo "   USE_CONDA=true ./run.sh"
echo ""
echo "To activate the environment manually:"
echo "   conda activate llm-service"
