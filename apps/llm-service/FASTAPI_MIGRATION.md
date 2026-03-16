# FastAPI Migration Guide

## Overview

The LLM service has been migrated from Flask to FastAPI to provide **automatic OpenAPI/Swagger documentation** at the `/docs` endpoint.

## What Changed

### Dependencies

**Added:**
- `fastapi ^0.109.0` - Modern web framework with automatic docs
- `uvicorn ^0.27.0` - ASGI server for FastAPI

**Kept:**
- All existing functionality (llama-cpp-python, requests, celery, etc.)

**Replaced:**
- Flask routing → FastAPI routing
- flask-cors → FastAPI CORS middleware
- Manual JSON parsing → Pydantic models (automatic validation)

### Architecture Changes

#### 1. Request/Response Models (Pydantic)

**Before (Flask):**
```python
@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json()
    message = data.get("message")  # No validation
    return jsonify({"response": "..."})
```

**After (FastAPI):**
```python
class ChatRequest(BaseModel):
    message: str
    slug: str
    conversationId: Optional[str] = None

@app.post("/api/chat", response_model=ChatResponse)
async def chat(chat_request: ChatRequest):
    return ChatResponse(response="...", conversationId="...")
```

**Benefits:**
- Automatic validation
- Type safety
- Auto-generated API docs with examples

#### 2. Authentication

**Before (Flask decorator):**
```python
@require_api_key
def protected_route():
    pass
```

**After (FastAPI dependency injection):**
```python
async def verify_api_key(x_api_key: str = Header(...)):
    # Validation logic
    return service_name

@app.post("/api/endpoint")
async def protected_route(service: str = Depends(verify_api_key)):
    pass
```

**Benefits:**
- Automatic OpenAPI security documentation
- Better testability
- Type-safe authentication

#### 3. CORS Configuration

**Before (Flask-CORS):**
```python
CORS(app, resources={r"/api/.*": {"origins": [...]}})
```

**After (FastAPI middleware):**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
)
```

## Installation

### 1. Install FastAPI Dependencies

```bash
cd apps/llm-service
poetry add fastapi uvicorn[standard]
```

### 2. Run FastAPI Server

**Development (with auto-reload):**
```bash
poetry run uvicorn app_fastapi:app --reload --host 0.0.0.0 --port 5000
```

**Production (with gunicorn):**
```bash
poetry run gunicorn app_fastapi:app \
    --workers 4 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:5000
```

## Accessing Documentation

Once the server is running:

1. **Swagger UI** (Interactive): http://localhost:5000/docs
   - Try out API endpoints directly in browser
   - See request/response schemas
   - Test authentication

2. **ReDoc** (Alternative): http://localhost:5000/redoc
   - Clean documentation view
   - Better for reading

3. **OpenAPI Schema** (JSON): http://localhost:5000/openapi.json
   - Raw OpenAPI 3.0 specification
   - Import into Postman/Insomnia

## API Endpoints

All endpoints from the original Flask app are preserved:

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | None | Health check |
| `/api/chat` | POST | API Key | Chat with resume |
| `/api/resume` | GET | API Key | Get resume data |
| `/api/improve-text` | POST | API Key | Improve text |
| `/api/embed` | POST | API Key | Generate embeddings |
| `/api/embed/batch` | POST | API Key | Batch embeddings |
| `/api/reload-resume` | POST | Webhook | Reload cache |
| `/api/companies/enrich` | POST | API Key | Company research |
| `/api/positions/score` | POST | API Key | Position scoring |

## Testing

### Test with curl

**Health check:**
```bash
curl http://localhost:5000/health
```

**Chat (with API key):**
```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "message": "What are your Python skills?",
    "slug": "john-doe"
  }'
```

### Test with Swagger UI

1. Go to http://localhost:5000/docs
2. Click "Authorize" button (top right)
3. Enter your API key
4. Try any endpoint with the "Try it out" button

## Deployment

### Update PM2 Ecosystem Config

Replace Flask gunicorn command with FastAPI uvicorn:

**Before:**
```javascript
{
  name: 'llm-service',
  script: 'gunicorn',
  args: 'app_remote:app --bind 0.0.0.0:5000'
}
```

**After:**
```javascript
{
  name: 'llm-service',
  script: 'uvicorn',
  args: 'app_fastapi:app --host 0.0.0.0 --port 5000 --workers 4'
}
```

Or use gunicorn with uvicorn workers:
```javascript
{
  name: 'llm-service',
  script: 'gunicorn',
  args: 'app_fastapi:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:5000'
}
```

### Restart Service

```bash
pm2 restart llm-service
pm2 logs llm-service  # Verify startup
```

### Verify Documentation

```bash
curl -I https://llm-service.paskot.com/docs
# Should return 200 OK with HTML content
```

## Comparison: Flask vs FastAPI

| Feature | Flask | FastAPI |
|---------|-------|---------|
| **Routing** | `@app.route()` | `@app.get()`, `@app.post()` |
| **Request body** | `request.get_json()` | Pydantic models |
| **Response** | `jsonify()` | Return dict/model |
| **Validation** | Manual | Automatic |
| **Docs** | Manual (Flasgger) | Automatic (built-in) |
| **Type hints** | Optional | Required |
| **Async** | Limited | Full support |
| **Performance** | Good | Excellent |
| **OpenAPI** | Add-on | Native |

## Migration Checklist

- [x] Add fastapi and uvicorn to pyproject.toml
- [x] Create Pydantic models for all endpoints
- [x] Convert Flask routes to FastAPI
- [x] Replace @require_api_key with Depends()
- [x] Update CORS configuration
- [x] Test all endpoints
- [ ] Update PM2 config
- [ ] Deploy to production
- [ ] Update API documentation
- [ ] Update client code (if needed)

## Backward Compatibility

Both `app_remote.py` (Flask) and `app_fastapi.py` (FastAPI) can coexist. You can:

1. **Run FastAPI on different port for testing:**
   ```bash
   # Flask on 5000
   poetry run gunicorn app_remote:app --bind 0.0.0.0:5000
   
   # FastAPI on 5001 (for comparison)
   poetry run uvicorn app_fastapi:app --port 5001
   ```

2. **Switch between them in PM2:**
   ```bash
   pm2 stop llm-service
   pm2 start ecosystem.config.js --only llm-service-fastapi
   ```

## Troubleshooting

### Import Errors

If you see `ModuleNotFoundError`:
```bash
poetry install  # Reinstall dependencies
poetry run which uvicorn  # Verify uvicorn installed
```

### Port Already in Use

```bash
lsof -ti:5000 | xargs kill -9  # Kill process on port 5000
```

### Swagger UI Not Loading

Check that FastAPI is actually running:
```bash
curl http://localhost:5000/openapi.json
# Should return OpenAPI schema
```

## Next Steps

1. **Test locally** with `uvicorn app_fastapi:app --reload`
2. **Access docs** at http://localhost:5000/docs
3. **Test endpoints** using Swagger UI
4. **Update deployment** scripts
5. **Deploy to production**

## Resources

- FastAPI Documentation: https://fastapi.tiangolo.com/
- Pydantic Models: https://docs.pydantic.dev/
- Uvicorn Server: https://www.uvicorn.org/
- OpenAPI Specification: https://swagger.io/specification/
