# My Resume Project

Full-stack resume website with AI chatbot powered by LLAMA.

## 🔐 Service Authentication

The platform uses **dual authentication** for secure service-to-service communication:

- **API → LLM:** API Key Authentication (X-API-Key header)
- **LLM → API:** JWT Authentication (Bearer token)

📖 **[Read the Complete Service Interactions Guide →](docs/guides/SERVICE_INTERACTIONS.md)**
📚 **[Browse All Documentation →](docs/README.md)**

Quick setup:
```bash
# Generate credentials
openssl rand -hex 32        # API key
openssl rand -base64 32     # JWT password

# Configure .env files (see docs/guides/SERVICE_INTERACTIONS.md for details)
```

## Project Structure

```
apps/
  my-resume/          # React frontend application
  api-service/        # NestJS backend with GraphQL/REST
  llm-service/        # Flask API with LLAMA integration
docs/                 # 📚 All project documentation (organized by category)
infra/                # AWS CDK infrastructure code
ansible/              # Deployment automation
data/                 # Resume data files
```

## 📚 Documentation

All documentation is organized in the [`docs/`](docs/) and [`infra/docs/`](infra/docs/) directories:

- **[Architecture](docs/architecture/)** - System design and technical decisions
- **[Deployment](docs/deployment/)** - Infrastructure and deployment guides
- **[Features](docs/features/)** - Feature-specific documentation
- **[Guides](docs/guides/)** - How-to guides and tutorials ⭐
- **[Setup](docs/setup/)** - Initial configuration
- **[Implementation](docs/implementation/)** - Implementation details and changelogs
- **[Testing](docs/testing/)** - Test reports and QA documentation
- **[Infrastructure Docs](infra/docs/)** - GCP deployment and troubleshooting 🚀

**Start here:** [Documentation Index](docs/README.md)

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

**Authentication:** Dual authentication (API Key + JWT) - see [SERVICE_INTERACTIONS.md](docs/guides/SERVICE_INTERACTIONS.md)

**Quick Start:**
```bash
cd apps/llm-service

# 1. Setup environment and dependencies
./setup_poetry.sh

# 2. Configure authentication (API keys + JWT)
cp .env.example .env
# Edit .env and set LLM_SERVICE_USERNAME and LLM_SERVICE_PASSWORD
# (must match credentials in API service)

# 3. Install PyJWT for authentication
pip install pyjwt

# 4. Start service
USE_POETRY=true ./run.sh
```

See [apps/llm-service/README.md](apps/llm-service/README.md) for detailed setup.  
See [SERVICE_INTERACTIONS.md](docs/guides/SERVICE_INTERACTIONS.md) for complete authentication setup (API keys + JWT).

## Infrastructure & Deployment

### GCP Cloud Run (Production)

**Quick Deploy:**
```bash
cd infra/scripts

# Deploy everything (frontend + API)
./deploy-all.sh

# Or deploy individually
./deploy-frontend.sh
./deploy-api-service.sh
```

See [infra/docs/DEPLOY_SCRIPTS.md](infra/docs/DEPLOY_SCRIPTS.md) for deployment guide.  
See [infra/docs/GCP_DEPLOYMENT_GUIDE.md](infra/docs/GCP_DEPLOYMENT_GUIDE.md) for full GCP setup.

### Home Server (LLM Service)

Ansible deployment for GPU server:
```bash
cd ansible
ansible-playbook -i inventory.yml update-services.yml
```

See [ansible/DEPLOYMENT.md](ansible/DEPLOYMENT.md) for details.

### AWS CloudFront (Alternative)

AWS CDK infrastructure for deploying to CloudFront + S3:

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

**⚠️ Important:** 
- The `LLM_SERVICE_PASSWORD` must be identical in both API service and LLM service `.env` files
- The `LLM_API_KEY` must exist in the LLM service's `LLM_API_KEYS` JSON

See [SERVICE_INTERACTIONS.md](docs/guides/SERVICE_INTERACTIONS.md) for complete authentication setup including API keys.

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
