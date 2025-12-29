# LLM Service Operations Guide

## Architecture

The LLM service is a Flask application that provides an AI chat assistant about Jose's resume. It uses Ollama as the backend for running LLaMA models locally.

**Current Setup:**
- Model: llama3.1:latest (4.9 GB)
- Alternative: gemma3:27b (17 GB)
- Backend: Ollama server at http://localhost:11434
- Process Manager: PM2 (single instance)
- Capacity: ~10-20 concurrent users

## Configuration

Environment variables (set in PM2 or `.env` file):

```bash
PORT=5000                                  # Flask server port
LLAMA_SERVER_URL=http://localhost:11434    # Ollama server URL
LLAMA_API_TYPE=ollama                      # API type: ollama, llama-cpp, openai-compatible
OLLAMA_MODEL=llama3.1:latest              # Model to use
RESUME_PATH=../../data/resume.md          # Path to resume markdown (optional, defaults to this)
ADMIN_TOKEN=change-me-in-production        # Token for /api/reload-resume endpoint
```

## Updating Resume Content

### Method 1: Automatic Reload (Recommended)

The service automatically loads the resume from `data/resume.md` on startup.

**Update Process:**

```bash
# 1. Edit the resume
vim /opt/my-resume/data/resume.md

# 2. Restart the service (triggers reload)
cd /opt/my-resume/apps/llm-service
source /opt/miniconda3/etc/profile.d/conda.sh
conda activate /opt/my-resume/apps/api-service/conda-env
pm2 restart llm-service

# 3. Verify in logs
pm2 logs llm-service --lines 10 --nostream
# Should see: "INFO:__main__:Loaded resume context from ../../data/resume.md (XXXX chars)"
```

### Method 2: Hot Reload (No Downtime)

Use the `/api/reload-resume` endpoint to reload without restarting:

```bash
curl -X POST http://localhost:5000/api/reload-resume \
  -H "X-Admin-Token: your-admin-token-here"

# Response:
# {
#   "status": "success",
#   "message": "Resume context reloaded",
#   "old_length": 5119,
#   "new_length": 5230
# }
```

**Security Note:** Change `ADMIN_TOKEN` in production!

### Method 3: Git Deploy Workflow

```bash
# On your local machine:
cd my-resume
vim data/resume.md
git add data/resume.md
git commit -m "Update resume: added new certification"
git push origin main

# On the remote server:
ssh jose@172.16.23.127
cd /opt/my-resume
git pull
source /opt/miniconda3/etc/profile.d/conda.sh
conda activate /opt/my-resume/apps/api-service/conda-env
cd apps/llm-service
pm2 restart llm-service
```

## Scaling for Multiple Users

### Current Capacity

**Single Process (Current):** ~10-20 concurrent users
- Flask development server
- 1 PM2 instance
- Suitable for personal portfolio/demo

### Option 1: Gunicorn with Multiple Workers (Recommended for Production)

**Capacity:** ~40-80 concurrent users (with 4 workers)

```bash
# 1. Install Gunicorn
cd /opt/my-resume/apps/llm-service
source /opt/miniconda3/etc/profile.d/conda.sh
conda activate /opt/my-resume/apps/api-service/conda-env
pip install gunicorn

# 2. Stop Flask development server
pm2 delete llm-service

# 3. Start with Gunicorn
pm2 start "gunicorn -w 4 -b 0.0.0.0:5000 --timeout 120 app_remote:app" --name llm-service

# 4. Save configuration
pm2 save
```

**Gunicorn Configuration:**
- `-w 4`: 4 worker processes (adjust based on CPU cores)
- `-b 0.0.0.0:5000`: Bind to all interfaces on port 5000
- `--timeout 120`: 120-second timeout for LLM responses
- `--workers` formula: `(2 × CPU_cores) + 1`

**Benefits:**
- Production-grade WSGI server
- Better performance and stability
- Automatic worker restarts on crashes
- Request load balancing

### Option 2: PM2 Cluster Mode

**Capacity:** ~30-60 concurrent users (with 3 instances)

```bash
# Stop current service
pm2 delete llm-service

# Start in cluster mode with 3 instances
cd /opt/my-resume/apps/llm-service
source /opt/miniconda3/etc/profile.d/conda.sh
conda activate /opt/my-resume/apps/api-service/conda-env

# Set environment variables and start
PORT=5000 \
LLAMA_SERVER_URL=http://localhost:11434 \
LLAMA_API_TYPE=ollama \
OLLAMA_MODEL=llama3.1:latest \
pm2 start app_remote.py --name llm-service --instances 3

# Save configuration
pm2 save
```

**Benefits:**
- Simpler setup (uses existing PM2)
- Automatic load balancing
- Zero-downtime reloads

**Limitations:**
- Still using Flask dev server (not ideal for production)
- Less mature than Gunicorn

### Monitoring Performance

```bash
# Check PM2 status
pm2 status

# Monitor resource usage
pm2 monit

# View logs
pm2 logs llm-service

# Check Ollama server
curl http://localhost:11434/api/tags
```

## API Endpoints

### GET /health
Health check endpoint.

```bash
curl http://localhost:5000/health
```

Response:
```json
{
  "status": "healthy",
  "api_type": "ollama",
  "llama_server": "http://localhost:11434",
  "server_reachable": true
}
```

### POST /api/chat
Chat with the AI assistant about Jose's resume.

```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is Jose'\''s experience with AWS?"}'
```

Response:
```json
{
  "response": "According to Jose's profile, he has extensive experience...",
  "server": "http://localhost:11434",
  "tokens_used": 0
}
```

### GET /api/resume
Get the current resume context loaded in memory.

```bash
curl http://localhost:5000/api/resume
```

### POST /api/reload-resume
Reload resume from file without restarting (requires admin token).

```bash
curl -X POST http://localhost:5000/api/reload-resume \
  -H "X-Admin-Token: your-admin-token"
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
pm2 logs llm-service --err

# Common issues:
# 1. Ollama not running
sudo systemctl status ollama

# 2. Port already in use
lsof -i :5000

# 3. Missing dependencies
cd /opt/my-resume/apps/llm-service
source /opt/miniconda3/etc/profile.d/conda.sh
conda activate /opt/my-resume/apps/api-service/conda-env
pip install -r requirements.txt
```

### Slow Responses

```bash
# Check Ollama resource usage
ps aux | grep ollama

# Try smaller model
# Edit PM2 config to use llama3.1 instead of gemma3:27b

# Check if model is loaded in memory
curl http://localhost:11434/api/tags
```

### Resume Not Updating

```bash
# Verify file path
cd /opt/my-resume/apps/llm-service
ls -la ../../data/resume.md

# Check what's loaded
curl http://localhost:5000/api/resume | jq '.context' | head -20

# Force reload
curl -X POST http://localhost:5000/api/reload-resume \
  -H "X-Admin-Token: change-me-in-production"

# Check logs
pm2 logs llm-service | grep "Loaded resume"
```

### Memory Issues

```bash
# Check memory usage
free -h
ps aux --sort=-%mem | head -20

# Ollama can use a lot of RAM (model + context)
# llama3.1:latest: ~5GB RAM
# gemma3:27b: ~28GB RAM

# Reduce workers if low on memory
pm2 scale llm-service 2  # Reduce to 2 instances
```

## Model Management

### List Available Models

```bash
ollama list
```

### Switch Models

```bash
# Edit PM2 environment or .env
vim /opt/my-resume/apps/llm-service/.env

# Change OLLAMA_MODEL
OLLAMA_MODEL=gemma3:27b  # or llama3.1:latest

# Restart
cd /opt/my-resume/apps/llm-service
source /opt/miniconda3/etc/profile.d/conda.sh
conda activate /opt/my-resume/apps/api-service/conda-env
pm2 restart llm-service
```

### Pull New Models

```bash
ollama pull llama3.2
ollama pull mistral
ollama pull codellama
```

## Security Recommendations

1. **Change Admin Token:**
   ```bash
   # Generate secure token
   openssl rand -hex 32
   
   # Update .env
   ADMIN_TOKEN=your-new-secure-token-here
   ```

2. **Rate Limiting:**
   Consider adding Flask-Limiter for production:
   ```python
   from flask_limiter import Limiter
   limiter = Limiter(app, default_limits=["200 per day", "50 per hour"])
   ```

3. **Authentication:**
   For public deployment, add proper authentication to chat endpoint

4. **HTTPS:**
   Ensure Nginx terminates SSL/TLS

5. **Firewall:**
   Restrict port 5000 to localhost only (Nginx handles public access)
   ```bash
   sudo ufw deny 5000
   sudo ufw allow from 127.0.0.1 to any port 5000
   ```

## Maintenance

### Log Rotation

PM2 handles log rotation automatically, but you can configure:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Backup Resume

```bash
# Automated backup script
cd /opt/my-resume/data
cp resume.md resume.md.backup.$(date +%Y%m%d)

# Keep last 30 days
find . -name "resume.md.backup.*" -mtime +30 -delete
```

### Update Dependencies

```bash
cd /opt/my-resume/apps/llm-service
source /opt/miniconda3/etc/profile.d/conda.sh
conda activate /opt/my-resume/apps/api-service/conda-env
pip install --upgrade flask requests
pm2 restart llm-service
```
