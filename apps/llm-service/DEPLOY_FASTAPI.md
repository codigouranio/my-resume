# Deploy FastAPI Migration

## Changes Made

Updated deployment configuration to use **FastAPI** (`app_fastapi.py`) instead of Flask (`app_remote.py`).

### Files Updated

1. ✅ **ansible/templates/ecosystem.config.js.j2** - Ansible template
2. ✅ **ecosystem.config.js** - Local PM2 config  
3. ✅ **run-llm-service.sh** - Wrapper script
4. ✅ **pyproject.toml** - Added fastapi and uvicorn dependencies

### Key Changes

**Before (Flask):**
```bash
interpreter: python
script: app_remote.py
```

**After (FastAPI):**
```bash
interpreter: python
script: .venv/bin/uvicorn
args: app_fastapi:app --host 0.0.0.0 --port 5000 --workers 2
```

## Deployment Steps

### 1. Install Dependencies

On your production server:

```bash
cd /opt/my-resume/apps/llm-service

# If using Poetry
Poetry add fastapi 'uvicorn[standard]'

# Or if using conda/pip
pip install fastapi 'uvicorn[standard]'
```

### 2. Test Locally First

Before deploying, test that FastAPI works:

```bash
# Activate your environment
source .venv/bin/activate  # or conda activate

# Test uvicorn directly
uvicorn app_fastapi:app --reload --port 5000

# Visit http://localhost:5000/api/docs
# Should see Swagger UI
```

### 3. Update Production

#### Option A: Use Ansible (Recommended)

```bash
cd ansible

# Deploy updated ecosystem config
ansible-playbook -i inventory-production.yml update-services.yml

# Or full deployment
./deploy_with_conda.sh
```

This will:
- Update ecosystem.config.js from template
- Restart PM2 services
- FastAPI will start automatically

#### Option B: Manual Deployment

```bash
# SSH to your server
ssh your-server

# Navigate to project
cd /opt/my-resume

# Pull latest code
git pull origin main

# Install dependencies
cd apps/llm-service
poetry install  # or pip install -r requirements.txt

# Restart PM2
pm2 restart llm-service

# Check logs
pm2 logs llm-service --lines 50
```

### 4. Verify Deployment

```bash
# Check service is running
pm2 status llm-service

# Test health endpoint
curl http://localhost:5000/health

# Test Swagger docs
curl -I https://llm-service.paskot.com/api/docs
# Should return: HTTP/1.1 200 OK

# Visit in browser
open https://llm-service.paskot.com/api/docs
```

### 5. Check Logs

```bash
# Watch PM2 logs
pm2 logs llm-service

# You should see:
# ================================================================================
# 🚀 FastAPI LLM Service Starting
# ================================================================================
# LLAMA Server: http://localhost:11434
# LLAMA Model: llama3.1
# API Type: ollama
# ================================================================================
# 📖 Swagger UI: http://localhost:5000/api/docs
# 📖 ReDoc: http://localhost:5000/api/redoc
# ================================================================================
```

## Performance Notes

### Workers Configuration

FastAPI is configured with **2 workers** for production:
```bash
--workers 2
```

**Why 2 workers?**
- LLM service is I/O bound (waiting for Ollama/vLLM responses)
- 2 workers allow handling concurrent requests
- More workers = more memory usage (watch memory on home server)

**Adjust workers based on:**
- Available RAM: 1 worker ≈ 100-200MB
- CPU cores: Generally 2x cores, but start with 2
- Workload: Monitor with `pm2 monit`

### Memory Management

PM2 is configured to restart if memory exceeds 1GB:
```javascript
max_memory_restart: '1G'
```

Monitor memory usage:
```bash
pm2 monit          # Interactive monitor
pm2 list           # Memory per service
htop               # System-wide memory
```

## Rollback Plan

If FastAPI has issues, rollback to Flask:

### Quick Rollback

```bash
# Edit ecosystem.config.js on server
cd /opt/my-resume

# Change back to Flask
vim ecosystem.config.js
# Change:
#   script: '.venv/bin/uvicorn'
#   args: 'app_fastapi:app --host 0.0.0.0 --port 5000 --workers 2'
# To:
#   script: 'app_remote.py'
#   (remove args line)

# Restart
pm2 restart llm-service
```

### Full Rollback with Git

```bash
# Revert the commit
git log --oneline  # Find commit hash
git revert <commit-hash>
git push

# Redeploy
cd ansible
./deploy_with_conda.sh
```

## Troubleshooting

### Error: "uvicorn: command not found"

```bash
# Install uvicorn
cd /opt/my-resume/apps/llm-service
poetry add 'uvicorn[standard]'

# Or with pip
pip install 'uvicorn[standard]'

# Restart
pm2 restart llm-service
```

### Error: "ModuleNotFoundError: No module named 'fastapi'"

```bash
# Install FastAPI
poetry add fastapi

# Restart
pm2 restart llm-service
```

### Service won't start

```bash
# Check detailed logs
pm2 logs llm-service --err --lines 100

# Check processes
pm2 list

# Try starting manually
cd /opt/my-resume/apps/llm-service
source .venv/bin/activate
uvicorn app_fastapi:app --host 0.0.0.0 --port 5000
```

### Swagger docs return 404

Check that URLs are correct:
- ✅ `/api/docs` (correct)
- ❌ `/docs` (old location)

If still 404, check CORS configuration in `app_fastapi.py`.

## Testing Checklist

After deployment, verify:

- [ ] Service starts: `pm2 status llm-service`
- [ ] Health check: `curl http://localhost:5000/health`
- [ ] Swagger UI: https://llm-service.paskot.com/api/docs
- [ ] API endpoints work: Test chat via Swagger UI
- [ ] API key auth works: Try with/without X-API-Key header
- [ ] Logs look normal: `pm2 logs llm-service`
- [ ] Memory usage reasonable: `pm2 monit`
- [ ] No crashes: Check PM2 restart count

## Benefits of FastAPI Migration

✅ **Automatic API Documentation** - Swagger UI at `/api/docs`  
✅ **Input Validation** - Pydantic models catch errors early  
✅ **Better Performance** - Async/await support  
✅ **Type Safety** - Full Python type hints  
✅ **Modern Framework** - Active development, growing ecosystem  
✅ **OpenAPI Schema** - Auto-generated at `/api/openapi.json`  
✅ **ReDoc Alternative** - Clean docs at `/api/redoc`  

## Support

If you encounter issues:

1. Check logs: `pm2 logs llm-service --err`
2. Test locally: `uvicorn app_fastapi:app --reload`
3. Compare with Flask: Keep `app_remote.py` as reference
4. Check dependencies: `poetry show` or `pip list`
5. Verify environment: `echo $PATH`, `which uvicorn`

## Next Steps

Once FastAPI is stable:

1. **Update API clients** - Frontend already compatible (same endpoints)
2. **Remove Flask** - Can delete `app_remote.py` after confidence period
3. **Add tests** - FastAPI has excellent testing tools
4. **Monitor performance** - Compare response times vs Flask
5. **Expand docs** - Add more OpenAPI metadata
