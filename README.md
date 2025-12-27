# My Resume Project

Full-stack resume website with AI chatbot powered by LLAMA.

## Project Structure

```
apps/
  my-resume/          # React frontend application
  llm-service/        # Flask API with LLAMA integration
infra/                # AWS CDK infrastructure code
data/                 # Resume data files
```

## Applications

### Resume Website ([apps/my-resume](apps/my-resume/))

React application with:
- Interactive resume display
- Company logos and embedded videos
- Skills sidebar
- AI-powered chat widget
- DaisyUI + Tailwind CSS styling

**Tech Stack:** React 19, TypeScript, Rsbuild, DaisyUI

**Quick Start:**
```bash
cd apps/my-resume
npm install
npm run dev
```

### LLM Service ([apps/llm-service](apps/llm-service/))

Flask API service that uses LLAMA running on RTX 3090 GPU to answer questions about career experience.

**Tech Stack:** Python 3.10+, Flask, llama-cpp-python, CUDA

**Quick Start:**
```bash
cd apps/llm-service

# With Poetry (recommended)
./setup_poetry.sh
USE_POETRY=true ./run.sh

# With Conda
./setup_conda.sh
USE_CONDA=true ./run.sh
```

See [apps/llm-service/README.md](apps/llm-service/README.md) for detailed setup.

## Infrastructure

AWS CDK infrastructure for deploying to CloudFront + S3.

**Quick Start:**
```bash
cd infra

# With conda
USE_CONDA=true ./deploy.sh

# With venv
./deploy.sh
```

## Environment Setup

### Resume App

```bash
cd apps/my-resume
cp .env.example .env
# Edit .env and set REACT_APP_LLM_API_URL to your LLM service URL
npm run build
```

### LLM Service

```bash
cd apps/llm-service
cp .env.example .env
# Edit .env and set LLAMA_MODEL_PATH to your model file
```

## Development Workflow

1. **Start LLM Service** (on home server with GPU):
   ```bash
   cd apps/llm-service
   USE_POETRY=true ./run.sh
   ```

2. **Start Resume App** (local development):
   ```bash
   cd apps/my-resume
   npm run dev
   ```

3. **Deploy to AWS**:
   ```bash
   cd infra
   ./deploy.sh
   ```

## License

MIT
