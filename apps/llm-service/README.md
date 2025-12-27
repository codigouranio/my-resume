# LLM Service for Resume Chatbot

Flask API service that uses LLAMA running on RTX 3090 to answer questions about Jose Blanco's resume.

## Requirements

- Python 3.10+
- NVIDIA RTX 3090 GPU
- CUDA 11.8+ and cuDNN
- LLAMA model file (GGUF format)

## Setup

### 1. Install Dependencies

#### Option A: Using Poetry (Recommended for Development)

```bash
# Install Poetry if not already installed
curl -sSL https://install.python-poetry.org | python3 -

# Run automated setup
./setup_poetry.sh
```

Or manually:
```bash
# Install dependencies
poetry install --no-root

# Install llama-cpp-python with CUDA support
poetry run pip install llama-cpp-python --force-reinstall --no-cache-dir \
    --config-settings=cmake.args="-DLLAMA_CUBLAS=on"
```

#### Option B: Using conda

```bash
# Create conda environment from environment.yml
conda env create -f environment.yml

# Activate the environment
conda activate llm-service

# Install llama-cpp-python with CUDA support
CMAKE_ARGS="-DLLAMA_CUBLAS=on" pip install llama-cpp-python --force-reinstall --no-cache-dir
```

#### Option C: Using pip with virtualenv

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install llama-cpp-python with CUDA support
CMAKE_ARGS="-DLLAMA_CUBLAS=on" pip install llama-cpp-python --force-reinstall --no-cache-dir

# Install other dependencies
pip install -r requirements.txt
```

### 2. Download LLAMA Model

Download a LLAMA model in GGUF format (recommended: llama-2-7b-chat or llama-2-13b-chat):

```bash
mkdir models
cd models

# Example: Download from Hugging Face
# You can use any GGUF model compatible with llama.cpp
wget https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q4_K_M.gguf
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env and set LLAMA_MODEL_PATH to your model file
```

### 4. Run the Service

#### Quick Setup (Automated)

```bash
# With Poetry
./setup_poetry.sh
USE_POETRY=true ./run.sh

# With Conda
./setup_conda.sh
USE_CONDA=true ./run.sh
```

#### Manual Start - Development Mode

```bash
# With Poetry
poetry shell
python app.py

# With conda
conda activate llm-service
python app.py

# With venv
source venv/bin/activate
python app.py
```

#### Production Mode with Gunicorn

```bash
# With Poetry
USE_POETRY=true ./run.sh

# With conda
USE_CONDA=true ./run.sh

# With venv
./run.sh
```

**Note:** Use only 1 worker (-w 1) since the model is loaded in GPU memory.

## API Endpoints

### Health Check
```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "model_loaded": true
}
```

### Chat (Non-streaming)
```bash
POST /api/chat
Content-Type: application/json

{
  "message": "What is Jose's experience with Python?"
}
```

Response:
```json
{
  "response": "Jose Blanco has extensive experience with Python...",
  "tokens_used": 145
}
```

### Chat (Streaming)
```bash
POST /api/chat/stream
Content-Type: application/json

{
  "message": "Tell me about Jose's cloud experience"
}
```

Returns Server-Sent Events (SSE) stream.

### Get Resume Context
```bash
GET /api/resume
```

## Testing

```bash
# Test health endpoint
curl http://localhost:5000/health

# Test chat endpoint
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What programming languages does Jose know?"}'
```

## Integration with Resume App

Update the `ChatWidget.tsx` component to use this API:

```typescript
const API_URL = 'http://your-server-ip:5000';

const response = await fetch(`${API_URL}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: userMessage })
});
```

## GPU Configuration

The service is configured to use your RTX 3090 with:
- `n_gpu_layers=35`: Offloads model layers to GPU
- `n_ctx=2048`: Context window size
- `n_threads=8`: CPU threads for remaining operations

Adjust these values in `app.py` based on your specific model and performance needs.

## Troubleshooting

### CUDA Out of Memory
- Reduce `n_gpu_layers` in app.py
- Use a smaller quantized model (Q4_K_M instead of Q5_K_M)
- Ensure no other processes are using GPU memory

### Slow Responses
- Increase `n_gpu_layers` to offload more to GPU
- Use a smaller model (7B instead of 13B)
- Adjust `n_threads` for better CPU utilization

### Model Not Found
- Verify `LLAMA_MODEL_PATH` in .env points to correct file
- Ensure model file is in GGUF format
- Check file permissions

## Production Deployment

For production use:

1. **Use Gunicorn**: Better performance and process management
2. **Add HTTPS**: Use nginx reverse proxy with SSL certificate
3. **Add Authentication**: Implement API key or JWT authentication
4. **Rate Limiting**: Add request rate limiting to prevent abuse
5. **Monitoring**: Add logging and monitoring (Prometheus, Grafana)
6. **Systemd Service**: Create systemd unit for auto-restart

Example systemd service (`/etc/systemd/system/llm-service.service`):

```ini
[Unit]
Description=LLM Resume Service
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/llm-service
Environment="PATH=/path/to/venv/bin"
ExecStart=/path/to/venv/bin/gunicorn -w 1 -b 0.0.0.0:5000 --timeout 120 app:app
Restart=always

[Install]
WantedBy=multi-user.target
```

## License

MIT
