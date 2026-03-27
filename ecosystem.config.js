module.exports = {
  apps: [
    {
      name: "api-service",
      script: "dist/src/main.js",
      interpreter: "node",
      cwd: "/opt/my-resume/apps/api-service",
      instances: 2,
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        DATABASE_URL:
          "postgresql://resume_user:secure_db_password_change_me@localhost:5432/resume_db?schema=public",
        JWT_SECRET: "change_me_use_long_random_string_min_32_chars",
        LLM_SERVICE_URL: "http://localhost:5000",
        // API Key for LLM service access (NEW)
        LLM_API_KEY: "change_me_32_chars_min_api_key_here",
        // JWT authentication for LLM service (Phase 1 & 2)
        LLM_SERVICE_USERNAME: "llm-service",
        LLM_SERVICE_PASSWORD: "change_me_32_chars_min_secure_password",
        // Static token (optional - backward compatibility)
        LLM_SERVICE_TOKEN: "change_me_32_chars_min_secure_token",
      },
      max_memory_restart: "512M",
      error_file: "/opt/my-resume/apps/api-service/api-service-error.log",
      out_file: "/opt/my-resume/apps/api-service/api-service.log",
    },
    {
      name: "llm-service",
      script: "/opt/my-resume/apps/llm-service/.venv/bin/uvicorn",
      args: "app_fastapi:app --host 0.0.0.0 --port 5000 --workers 2",
      interpreter: "/opt/my-resume/apps/llm-service/.venv/bin/python",
      cwd: "/opt/my-resume/apps/llm-service",
      instances: 1,
      env: {
        PORT: 5000,
        LLAMA_SERVER_URL: "http://localhost:11434",
        LLAMA_API_TYPE: "ollama",
        OLLAMA_MODEL: "llama3.1:latest",
        // API Key Authentication (NEW)
        LLM_API_KEYS: JSON.stringify({
          "api-service": "change_me_32_chars_min_api_key_here",
          "admin-dashboard": "change_me_32_chars_min_admin_key_here",
        }),
        // DATABASE_URL removed - LLM service now uses API calls
        // JWT authentication (recommended - Phase 2)
        API_SERVICE_URL: "http://localhost:3000",
        LLM_SERVICE_USERNAME: "llm-service",
        LLM_SERVICE_PASSWORD: "change_me_32_chars_min_secure_password",
        // Static token (legacy - optional for backward compatibility)
        // LLM_SERVICE_TOKEN: "change_me_32_chars_min_secure_token",
        ADMIN_TOKEN: "change_me_in_production",
        LLM_WEBHOOK_SECRET: "change_me_32_chars_min",
        REDIS_HOST: "localhost",
        REDIS_PORT: 6379, // Shared Redis
        REDIS_DB: 1, // Database 1 (API uses 0)
        REDIS_PASSWORD: "",
      },
      error_file: "/opt/my-resume/apps/llm-service/llm-service-error.log",
      out_file: "/opt/my-resume/apps/llm-service/llm-service.log",
    },
    {
      name: "llm-celery-worker",
      script: "celery",
      args: "-A celery_config worker --loglevel=info --concurrency=2 --max-tasks-per-child=50 --task-events --without-gossip --without-mingle --without-heartbeat",
      interpreter: "/opt/my-resume/apps/llm-service/.venv/bin/python",
      cwd: "/opt/my-resume/apps/llm-service",
      instances: 1,
      env: {
        // DATABASE_URL removed - Celery worker now uses API calls
        // JWT authentication (Phase 2)
        API_SERVICE_URL: "http://localhost:3000",
        LLM_SERVICE_USERNAME: "llm-service",
        LLM_SERVICE_PASSWORD: "change_me_32_chars_min_secure_password",
        // Static token (optional - backward compatibility)
        LLM_SERVICE_TOKEN: "change_me_32_chars_min_secure_token",
        REDIS_HOST: "localhost",
        REDIS_PORT: 6379, // Shared Redis
        REDIS_DB: 1, // Database 1 (API uses 0)
        REDIS_PASSWORD: "",
        LLM_WEBHOOK_SECRET: "change_me_32_chars_min",
        LLAMA_SERVER_URL: "http://localhost:11434",
        LLAMA_API_TYPE: "ollama",
      },
      error_file:
        "/opt/my-resume/apps/llm-service/logs/celery-worker-error.log",
      out_file: "/opt/my-resume/apps/llm-service/logs/celery-worker.log",
      max_memory_restart: "1G",
    },
    {
      name: "llm-flower",
      script: "celery",
      args: "-A celery_config flower --address=0.0.0.0 --port=5555 --persistent=True --db=flower.db",
      interpreter: "/opt/my-resume/apps/llm-service/.venv/bin/python",
      cwd: "/opt/my-resume/apps/llm-service",
      instances: 1,
      env: {
        // DATABASE_URL removed - Flower monitoring doesn't need DB
        API_SERVICE_URL: "http://localhost:3000",
        LLM_SERVICE_TOKEN: "change_me_32_chars_min_secure_token",
        LLM_WEBHOOK_SECRET: "change_me_32_chars_min",
        FLOWER_UNAUTHENTICATED_API: "true",
        REDIS_HOST: "localhost",
        REDIS_PORT: 6379, // Shared Redis
        REDIS_DB: 2, // Database 2 (for Flower isolation)
        REDIS_PASSWORD: "",
      },
      error_file: "/opt/my-resume/apps/llm-service/logs/flower-error.log",
      out_file: "/opt/my-resume/apps/llm-service/logs/flower.log",
      max_memory_restart: "512M",
    },
  ],
};
