# Features

This directory contains all the main business features of the application.

Each feature is a self-contained module with its own:
- Controller (API endpoints)
- Service (business logic)
- DTOs (data transfer objects)
- Guards, strategies, decorators (if needed)

## Current Features

### 🔐 Auth
User authentication and authorization
- Registration and login
- JWT token generation
- Passport strategies (Local, JWT)
- Auth guards and decorators

**Endpoints:**
- `POST /api/auth/register`
- `POST /api/auth/login`

### 👤 Users
User profile management
- Get current user profile
- Update user information
- Delete account

**Endpoints:**
- `GET /api/users/me`
- `PATCH /api/users/me`
- `DELETE /api/users/me`

### 📄 Resumes
Resume creation and management
- CRUD operations for resumes
- Public resume viewing (slug-based URLs)
- Hidden context for LLAMA integration
- View analytics

**Endpoints:**
- `GET /api/resumes` - List user's resumes
- `POST /api/resumes` - Create resume
- `GET /api/resumes/:id` - Get resume by ID
- `GET /api/resumes/public/:slug` - Public view
- `GET /api/resumes/llm/:slug` - Full context for AI
- `PATCH /api/resumes/:id` - Update resume
- `DELETE /api/resumes/:id` - Delete resume

### 🎨 Templates
Resume templates
- List available templates
- Get template details
- Premium/free templates

**Endpoints:**
- `GET /api/templates` - List all templates
- `GET /api/templates/:id` - Get template by ID

## Adding a New Feature

1. Create feature directory: `features/my-feature/`
2. Create module file: `my-feature.module.ts`
3. Create service: `my-feature.service.ts`
4. Create controller: `my-feature.controller.ts`
5. Create DTOs folder: `dto/`
6. Import module in `app.module.ts`

Example structure:
```
features/
└── my-feature/
    ├── my-feature.module.ts
    ├── my-feature.controller.ts
    ├── my-feature.service.ts
    └── dto/
        ├── create-my-feature.dto.ts
        └── update-my-feature.dto.ts
```

## Feature Dependencies

- All features can depend on `shared/database` (Prisma)
- Features can import other features (e.g., Auth imports Users)
- Keep dependencies minimal and unidirectional
- Avoid circular dependencies
