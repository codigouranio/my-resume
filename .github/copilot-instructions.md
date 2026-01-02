# AI Resume Platform - Copilot Instructions

## Architecture Overview

This is a monorepo with three main services deployed together:

1. **Frontend** (`apps/my-resume/`) - React 19 + Rsbuild + DaisyUI resume display with AI chat
2. **API Service** (`apps/api-service/`) - NestJS + GraphQL/REST + Prisma + PostgreSQL backend
3. **LLM Service** (`apps/llm-service/`) - Flask service connecting to Ollama for AI chat

Key integration: Frontend → API Service (auth, resume CRUD) → LLM Service (chat) → Ollama (AI) + PostgreSQL (resume data)

## Development Commands

### Frontend (apps/my-resume/)
```bash
yarn dev          # Dev server (port 3000)
yarn build        # Production build
yarn test         # Run tests with rstest
yarn check        # Lint/format with Biome
```

### API Service (apps/api-service/)
```bash
npm run start:dev      # Dev with watch (port 3000)
npm run prisma:generate # Generate Prisma client
npm run prisma:migrate  # Run migrations
npm run prisma:studio   # Open DB GUI
npm run build          # Build for production
```

### LLM Service (apps/llm-service/)
```bash
./setup_poetry.sh              # One-time setup with Poetry
USE_POETRY=true ./run.sh       # Start service (port 5000)
# Requires Ollama running at localhost:11434
```

## Code Organization Patterns

### Frontend: Feature-Based Architecture ("Screaming Architecture")
```
apps/my-resume/src/
  features/
    resume/      # Resume display feature
    chat/        # AI chat widget
    badges/      # GitHub-style badges
  shared/        # Reusable components/utils
```

- Each feature is self-contained with components, styles, and logic
- Features export public API via `index.ts`
- Use feature folders, not technical type folders (no `/components`, `/hooks` at root)

### API Service: NestJS Feature Modules + CQRS
```
apps/api-service/src/
  features/
    auth/        # JWT authentication
    resumes/     # Resume CRUD with CQRS
    users/       # User management
    templates/   # Resume templates
    badges/      # Badge generation
  shared/
    database/    # Prisma service (global)
```

- Each feature has: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`
- **CQRS Pattern** used in resumes feature: separate queries (`queries/`) and commands (`commands/`)
- Use `@shared/database` path alias for PrismaService
- Both REST (`/api/*`) and GraphQL (`/graphql`) endpoints coexist

### Database: Prisma Schema Patterns
- Use `cuid()` for IDs, not auto-increment
- Soft deletes with `deletedAt` field (see RecruiterInterest, ResumeAnalytics)
- Always add `@@index` for fields used in queries (see `User.email`)
- Enum types in schema (Role, SubscriptionTier)

## Critical Concepts

### Resume Hidden Context (`llmContext`)
Resumes have two content fields:
- `content` (public) - shown to visitors
- `llmContext` (private) - additional context only for AI chatbot

**Security:** Never expose `llmContext` in public endpoints. See `/api/resumes/public/:slug` vs `/api/resumes/llm/:slug`

### Environment Variables
Each service requires specific env vars:

**API Service:**
- `DATABASE_URL` - PostgreSQL connection
- `JWT_SECRET` - Must be 32+ chars for production
- `LLM_SERVICE_URL` - Flask service URL (default: http://localhost:5000)

**LLM Service:**
- `LLAMA_SERVER_URL` - Ollama URL (default: http://localhost:11434)
- `LLAMA_API_TYPE` - Usually "ollama"
- `DATABASE_URL` - Same PostgreSQL (reads resume data)
- `ADMIN_TOKEN` - For `/api/reload-resume` endpoint

**Frontend:**
- `PUBLIC_API_URL` - Backend API URL
- `PUBLIC_LLM_API_URL` - LLM service URL

### Deployment Architecture
Production uses Ansible with:
- Nginx reverse proxy (Cloudflare SSL termination)
- PM2 process manager (2 API instances in cluster mode, 1 LLM instance)
- Conda environments for Node.js and Python
- PostgreSQL 15 local database
- Ollama service for AI (models: llama3.1:latest or gemma3:27b)

Commands: `./ansible/deploy_with_conda.sh` (full deploy) or `./ansible/update-quick.sh` (app updates only)

## Testing

- **Frontend:** Use `@rstest/core` framework, not Jest
- **API:** Jest tests (run `npm test`)
- **Integration:** Test full stack by hitting REST/GraphQL endpoints

## Key Files to Reference

- [apps/my-resume/AGENTS.md](../apps/my-resume/AGENTS.md) - Frontend tooling
- [apps/api-service/GRAPHQL_CQRS.md](../apps/api-service/GRAPHQL_CQRS.md) - GraphQL queries
- [apps/api-service/HIDDEN_CONTEXT.md](../apps/api-service/HIDDEN_CONTEXT.md) - LLM context pattern
- [apps/llm-service/OPERATIONS.md](../apps/llm-service/OPERATIONS.md) - LLM service operations
- [ansible/DEPLOYMENT.md](../ansible/DEPLOYMENT.md) - Production deployment guide

## When Adding Features

1. **Frontend feature:** Create `src/features/{name}/` with component, styles, `index.ts`, `README.md`
2. **API feature:** Create `src/features/{name}/` with module, controller, service, DTOs
3. **New Prisma model:** Add to `schema.prisma` → `npm run prisma:migrate` → restart API
4. **GraphQL support:** Add resolver (`*.resolver.ts`) with `@Query` decorators for read-only ops

## Common Pitfalls

- Don't use `npm` in frontend (use `yarn`)
- Don't use `yarn` in API service (use `npm`)
- Always run `prisma:generate` after schema changes
- Frontend uses **Rsbuild** not Webpack/Vite - check [rsbuild.rs](https://rsbuild.rs) docs
- LLM service must query database for resume content, not read local files (see `load_resume_from_db()`)
- PM2 restart after code changes: `pm2 restart api-service` or `pm2 restart llm-service`
