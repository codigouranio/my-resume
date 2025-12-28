# Connecting to Existing LLAMA Server

If you already have LLAMA running on your server, you can connect to it instead of loading the model separately. This is more efficient and allows sharing one LLAMA instance across multiple services.

## Supported LLAMA Servers

### 1. llama.cpp Server Mode

Run llama.cpp as an HTTP server:

```bash
# Start llama.cpp server
./llama-server \
  --model ./models/llama-2-7b-chat.gguf \
  --n-gpu-layers 35 \
  --ctx-size 2048 \
  --port 8080 \
  --host 0.0.0.0
```

### 2. Ollama

Run Ollama (easiest option):

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull and run model
ollama pull llama2
ollama serve  # Runs on port 11434 by default
```

### 3. OpenAI-Compatible (LocalAI, vLLM)

Run any OpenAI-compatible server like LocalAI or vLLM.

## Setup Instructions

### Step 1: Configure Environment

```bash
cd apps/llm-service
cp .env.example .env
```

Edit `.env`:

```bash
# For llama.cpp server
LLAMA_SERVER_URL=http://localhost:8080
LLAMA_API_TYPE=llama-cpp

# For Ollama
LLAMA_SERVER_URL=http://localhost:11434
LLAMA_API_TYPE=ollama
OLLAMA_MODEL=llama2

# For OpenAI-compatible
LLAMA_SERVER_URL=http://localhost:8000
LLAMA_API_TYPE=openai
MODEL_NAME=llama-2-7b-chat
```

### Step 2: Use Remote App

Instead of running `app.py`, use `app_remote.py`:

```bash
# With Poetry
poetry run python app_remote.py

# Or use the run script with environment variable
USE_REMOTE=true USE_POETRY=true ./run.sh
```

### Step 3: Test Connection

```bash
# Health check
curl http://localhost:5000/health

# Test chat
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What programming languages does Jose know?"}'
```

## Comparison: Local vs Remote

| Feature | Local (`app.py`) | Remote (`app_remote.py`) |
|---------|------------------|--------------------------|
| **Model Loading** | Loads in Flask process | Connects to external server |
| **Memory Usage** | High (model in memory) | Low (just API calls) |
| **GPU Usage** | Managed by Flask app | Managed by external server |
| **Startup Time** | Slow (load model) | Fast (just connect) |
| **Sharing** | One service only | Multiple services can share |
| **Simplicity** | Self-contained | Requires external service |

## Recommended Setup for Production

**Option 1: Ollama (Easiest)**
- Easy to install and manage
- Automatic model management
- Good performance
- Simple API

```bash
# On server with GPU
ollama serve

# In Flask service
LLAMA_API_TYPE=ollama
LLAMA_SERVER_URL=http://localhost:11434
```

**Option 2: llama.cpp Server (Most Control)**
- Maximum control over parameters
- Best performance tuning
- Direct GPU control
- Lighter weight

```bash
# On server with GPU
./llama-server --model llama-2-7b-chat.gguf --n-gpu-layers 35

# In Flask service
LLAMA_API_TYPE=llama-cpp
LLAMA_SERVER_URL=http://localhost:8080
```

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│  Server with RTX 3090                   │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  LLAMA Server (Ollama/llama.cpp)  │ │
│  │  - Port 8080 or 11434             │ │
│  │  - GPU acceleration               │ │
│  │  - Handles model inference        │ │
│  └─────────────┬─────────────────────┘ │
│                │ HTTP API               │
│  ┌─────────────▼─────────────────────┐ │
│  │  Flask Service (app_remote.py)    │ │
│  │  - Port 5000                      │ │
│  │  - Makes HTTP calls to LLAMA      │ │
│  │  - Manages context & safety       │ │
│  └─────────────┬─────────────────────┘ │
└────────────────┼───────────────────────┘
                 │ HTTP API
┌────────────────▼───────────────────────┐
│  Resume Website (ChatWidget)           │
└────────────────────────────────────────┘
```

## Benefits of Remote Approach

1. **Shared Resources**: Multiple services can use same LLAMA instance
2. **Better Scalability**: Scale LLAMA and Flask services independently
3. **Easier Updates**: Update LLAMA without touching Flask code
4. **Resource Management**: Better control over GPU memory
5. **Monitoring**: Easier to monitor and debug separate services

## When to Use Each Approach

**Use Local (`app.py`):**
- Simple single-service setup
- All-in-one deployment
- Maximum simplicity

**Use Remote (`app_remote.py`):**
- Already running LLAMA server
- Multiple services need LLM access
- Better resource management needed
- Easier scaling and updates
