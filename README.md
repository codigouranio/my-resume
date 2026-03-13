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

**Authentication:** JWT-based service-to-service authentication (see [JWT_AUTH_GUIDE.md](JWT_AUTH_GUIDE.md))

**Quick Start:**
```bash
cd apps/llm-service

# 1. Setup environment and dependencies
./setup_poetry.sh

# 2. Configure JWT authentication
cp .env.example .env
# Edit .env and set LLM_SERVICE_USERNAME and LLM_SERVICE_PASSWORD
# (must match credentials in API service)

# 3. Install PyJWT for authentication
pip install pyjwt

# 4. Start service
USE_POETRY=true ./run.sh
```

See [apps/llm-service/README.md](apps/llm-service/README.md) for detailed setup.  
See [JWT_AUTH_GUIDE.md](JWT_AUTH_GUIDE.md) for authentication configuration.

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

### Automated Deployment with GitHub Actions

The project includes automated CI/CD with GitHub Actions:

1. **Setup GitHub Secrets** (Settings → Secrets and variables → Actions):
   - `AWS_ACCESS_KEY_ID` - AWS access key
   - `AWS_SECRET_ACCESS_KEY` - AWS secret key
   - `AWS_REGION` - AWS region (e.g., `us-east-1`)
   - `LLM_API_URL` - Your LLM service URL (optional)

2. **Deploy automatically**:
   - Push to `main` branch triggers deployment
   - Or manually trigger from GitHub Actions tab

3. **Monitor deployment**:
   - Check GitHub Actions tab for logs
   - View CloudFormation stack in AWS Console

See [.github/workflows/README.md](.github/workflows/README.md) for details.

## Environment Setup

### Resume App

```bash
cd apps/my-resume
cp .env.example .env
# Edit .env and set PUBLIC_LLM_API_URL to your LLM service URL
npm run build
```

### LLM Service

```bash
cd apps/llm-service

# 1. Install dependencies
pip install pyjwt
# Or with Poetry: poetry add pyjwt

# 2. Create environment file
cp .env.example .env

# 3. Configure JWT authentication
# Edit .env and set:
#   API_SERVICE_URL=http://localhost:3000
#   LLM_SERVICE_USERNAME=llm-service
#   LLM_SERVICE_PASSWORD=<same-as-api-service>
#
# Generate secure password:
#   openssl rand -base64 32

# 4. Configure LLAMA model
# Edit .env and set:
#   LLAMA_SERVER_URL=http://localhost:11434
#   OLLAMA_MODEL=llama3.1:latest
```

**⚠️ Important:** The `LLM_SERVICE_PASSWORD` must be identical in both API service and LLM service `.env` files.

See [JWT_AUTH_GUIDE.md](JWT_AUTH_GUIDE.md) for detailed authentication setup.

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
