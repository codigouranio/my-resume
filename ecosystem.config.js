module.exports = {
  apps: [
    {
      name: "api-service",
      script: "/opt/my-resume/apps/api-service/dist/main.js",
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
      },
      max_memory_restart: "512M",
      error_file: "/opt/my-resume/apps/api-service/api-service-error.log",
      out_file: "/opt/my-resume/apps/api-service/api-service.log",
    },
    {
      name: "llm-service",
      script: "/opt/my-resume/run-llm-service.sh",
      cwd: "/opt/my-resume/apps/llm-service",
      instances: 1,
      env: {
        PORT: 5000,
        LLAMA_SERVER_URL: "http://localhost:11434",
        LLAMA_API_TYPE: "ollama",
        OLLAMA_MODEL: "llama3.1:latest",
        DATABASE_URL:
          "postgresql://resume_user:secure_db_password_change_me@localhost:5432/resume_db?schema=public",
        ADMIN_TOKEN: "change_me_in_production",
      },
      error_file: "/opt/my-resume/apps/llm-service/llm-service-error.log",
      out_file: "/opt/my-resume/apps/llm-service/llm-service.log",
    },
  ],
};
