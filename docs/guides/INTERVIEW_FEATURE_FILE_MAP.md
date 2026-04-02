# Interview Feature File Map

Use this as a technical walkthrough checklist during SWE interviews.

## 1) Internationalization (i18n)
- Frontend i18n bootstrap: `apps/my-resume/src/i18n/config.ts`
- Locale strings (English): `apps/my-resume/src/i18n/locales/en/common.json`
- Language switch component: `apps/my-resume/src/shared/components/LanguageSwitcher.tsx`
- User preferred language persistence/apply: `apps/my-resume/src/shared/contexts/AuthContext.tsx`

## 2) Authentication and Authorization
- Auth controller (login/register/refresh): `apps/api-service/src/features/auth/auth.controller.ts`
- Auth service (tokens, password flows): `apps/api-service/src/features/auth/auth.service.ts`
- JWT strategy: `apps/api-service/src/features/auth/strategies/jwt.strategy.ts`
- JWT guard: `apps/api-service/src/features/auth/guards/jwt-auth.guard.ts`
- Roles guard + decorator: `apps/api-service/src/features/auth/guards/roles.guard.ts`, `apps/api-service/src/features/auth/decorators/roles.decorator.ts`
- Public route decorator: `apps/api-service/src/features/auth/decorators/public.decorator.ts`

## 3) Rate Limiting / Throttling
- Global throttler guard: `apps/api-service/src/shared/guards/throttler.guard.ts`
- Global guard registration: `apps/api-service/src/app.module.ts`

## 4) LLM Guardrails and Service-to-Service Security
- Chat proxy endpoint (public): `apps/api-service/src/features/chat/chat.controller.ts`
- Chat proxy service (forwards with service auth headers): `apps/api-service/src/features/chat/chat.service.ts`
- LLM API auth module/controller/service: `apps/api-service/src/features/llm-service-api/llm-service-api.module.ts`, `apps/api-service/src/features/llm-service-api/llm-service-api.controller.ts`, `apps/api-service/src/features/llm-service-api/llm-service-api.service.ts`
- LLM-side API key + tenant validation: `apps/llm-service/api_key_auth.py`
- LLM FastAPI auth dependency / checks: `apps/llm-service/app_fastapi.py`

## 5) Swagger / API Documentation
- Swagger setup and route: `apps/api-service/src/main.ts`
- Swagger decorators examples: `apps/api-service/src/features/chat/chat.controller.ts`, `apps/api-service/src/features/admin/admin.controller.ts`

## 6) Validation and DTO Contracts
- Global validation pipe: `apps/api-service/src/main.ts`
- Chat DTO: `apps/api-service/src/features/chat/dto/chat.dto.ts`
- Auth DTOs: `apps/api-service/src/features/auth/dto/login.dto.ts`, `apps/api-service/src/features/auth/dto/register.dto.ts`

## 7) Subscription/Billing (Stripe)
- Subscriptions controller (checkout, webhook, admin upgrade): `apps/api-service/src/features/subscriptions/subscriptions.controller.ts`
- Subscriptions service (Stripe logic, tier transitions): `apps/api-service/src/features/subscriptions/subscriptions.service.ts`
- Pricing UI: `apps/my-resume/src/features/pricing/PricingPage.tsx`
- Settings subscription UX: `apps/my-resume/src/features/settings/SettingsPage.tsx`

## 8) Backoffice/Admin Operations
- Backoffice page UI: `apps/my-resume/src/features/backoffice/BackofficePage.tsx`
- Admin endpoints: `apps/api-service/src/features/admin/admin.controller.ts`
- Admin service (overview/users/manual PRO upgrade): `apps/api-service/src/features/admin/admin.service.ts`
- Frontend admin API client methods: `apps/my-resume/src/shared/api/client.ts`

## 9) Resume Core + Public/Private Context Split
- Resume API controller: `apps/api-service/src/features/resumes/resumes.controller.ts`
- Resume service logic: `apps/api-service/src/features/resumes/resumes.service.ts`
- Prisma model showing `content` vs `llmContext`: `apps/api-service/prisma/schema.prisma`
- Public resume page + chat widget integration: `apps/my-resume/src/features/resume/Resume.tsx`, `apps/my-resume/src/features/chat/ChatWidget.tsx`

## 10) Analytics (Views + Chat Analytics)
- Chat analytics controller/service: `apps/api-service/src/features/analytics/chat-analytics.controller.ts`, `apps/api-service/src/features/analytics/chat-analytics.service.ts`
- Analytics dashboard components: `apps/my-resume/src/features/analytics/AnalyticsDashboard.tsx`, `apps/my-resume/src/features/analytics/ChatAnalyticsDashboard.tsx`

## 11) Queue/Async Processing
- Embedding queue service + processor: `apps/api-service/src/features/embeddings/embedding-queue.service.ts`, `apps/api-service/src/features/embeddings/embedding.processor.ts`
- Bull board module: `apps/api-service/src/shared/bull-board/bull-board.module.ts`
- Queue dashboard mount: `apps/api-service/src/main.ts`

## 12) Search/Embeddings
- Embeddings module + search service: `apps/api-service/src/features/embeddings/embeddings.module.ts`, `apps/api-service/src/features/embeddings/search.service.ts`
- DTOs for search/generation: `apps/api-service/src/features/embeddings/dto/search-resumes.dto.ts`, `apps/api-service/src/features/embeddings/dto/generate-embedding.dto.ts`

## 13) Deployment and Operations
- GCP deploy wrapper: `infra/deploy.sh`
- GCP infra deploy (Terraform flow): `infra/gcp/deploy.sh`
- Code deploy scripts: `infra/scripts/deploy-all.sh`, `infra/scripts/deploy-api-service.sh`, `infra/scripts/deploy-frontend.sh`
- Ansible app deploy: `ansible/deploy.sh`, `ansible/playbooks/03-application-deploy.yml`

## 14) Data Model Highlights
- Core schema (users, resumes, tiers, analytics): `apps/api-service/prisma/schema.prisma`
- Database service wiring: `apps/api-service/src/shared/database/prisma.service.ts`

## 15) Interview Demo Flow (Suggested)
1. Start at architecture/module wiring: `apps/api-service/src/app.module.ts`, `apps/my-resume/src/App.tsx`.
2. Show auth + guards + public route pattern.
3. Show chat proxy + LLM auth guardrails.
4. Show subscription and admin backoffice manual PRO upgrade.
5. Show analytics and queue operations.
6. Close with deploy/ops scripts and a production incident you solved.
