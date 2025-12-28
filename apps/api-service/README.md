# API Service

NestJS REST API with Prisma, PostgreSQL, and JWT authentication for the resume platform.

## Features

- 🔐 JWT Authentication (register/login)
- 👤 User management
- 📄 Resume CRUD operations with slug-based URLs
- 🎨 Template system
- 🔒 Role-based access control
- 📊 Swagger API documentation
- 🗄️ Prisma ORM with migrations
- ✅ Input validation
- 🚀 Ready for production

## Tech Stack

- **NestJS** 10.3 - Progressive Node.js framework
- **Prisma** 5.8 - Next-generation ORM
- **PostgreSQL** - Production database
- **Passport JWT** - Authentication
- **Swagger** - API documentation
- **TypeScript** - Type safety

## Database Schema

### User
- Authentication (email/password)
- Profile (firstName, lastName)
- Role (USER/ADMIN)
- Subscription tier (FREE/PRO/ENTERPRISE)

### Resume
- Markdown content
- Slug-based URLs (`/resume/{slug}`)
- Public/private visibility
- Template & theme customization
- SEO metadata
- View analytics

### Template
- Reusable resume layouts
- Premium/free tiers

## Setup

### 1. Install Dependencies

```bash
cd apps/api-service
npm install
```

### 2. Database Setup

Create a PostgreSQL database:

```bash
# Using Docker (recommended)
docker run --name resume-db -e POSTGRES_PASSWORD=password -e POSTGRES_DB=resume_db -p 5432:5432 -d postgres:15

# Or use your existing PostgreSQL instance
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/resume_db?schema=public"
JWT_SECRET="your-secure-random-secret-change-this"
JWT_EXPIRES_IN="7d"
PORT=3000
LLM_SERVICE_URL="http://localhost:5000"
```

### 4. Run Prisma Migrations

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio to view data
npm run prisma:studio
```

### 5. Start Development Server

```bash
npm run start:dev
```

Server runs on: http://localhost:3000  
Swagger docs: http://localhost:3000/api/docs

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Users
- `GET /api/users/me` - Get current user profile
- `PATCH /api/users/me` - Update current user
- `DELETE /api/users/me` - Delete account

### Resumes
- `POST /api/resumes` - Create resume
- `GET /api/resumes` - Get user's resumes
- `GET /api/resumes/:id` - Get resume by ID
- `GET /api/resumes/public/:slug` - Get public resume by slug
- `PATCH /api/resumes/:id` - Update resume
- `DELETE /api/resumes/:id` - Delete resume

### Templates
- `GET /api/templates` - Get all templates
- `GET /api/templates/:id` - Get template by ID

## Database Migrations

### Create a new migration

```bash
npm run prisma:migrate -- --name add_new_field
```

### Apply migrations to production

```bash
npm run prisma:deploy
```

### Reset database (development only)

```bash
npx prisma migrate reset
```

## Scripts

```bash
# Development
npm run start:dev          # Start with hot reload
npm run start:debug        # Start with debugger

# Production
npm run build              # Build for production
npm run start:prod         # Run production build

# Database
npm run prisma:generate    # Generate Prisma client
npm run prisma:migrate     # Run migrations (dev)
npm run prisma:deploy      # Deploy migrations (prod)
npm run prisma:studio      # Open Prisma Studio GUI

# Testing
npm run test               # Run unit tests
npm run test:watch         # Run tests in watch mode
npm run test:cov           # Generate coverage report
npm run test:e2e           # Run e2e tests

# Code quality
npm run lint               # Run ESLint
npm run format             # Format with Prettier
```

## Example Usage

### 1. Register User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

Response includes `access_token` - use in subsequent requests.

### 3. Create Resume

```bash
curl -X POST http://localhost:3000/api/resumes \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "john-doe",
    "title": "Software Engineer",
    "content": "# John Doe\n\n## Experience\n...",
    "isPublic": true,
    "isPublished": true
  }'
```

### 4. View Public Resume

```bash
# By slug (no auth required)
curl http://localhost:3000/api/resumes/public/john-doe?view=true
```

## Architecture

```
src/
├── features/               # Business features (screaming architecture)
│   ├── auth/               # Authentication module
│   │   ├── strategies/     # Passport strategies (JWT, Local)
│   │   ├── guards/         # Auth guards
│   │   ├── decorators/     # Custom decorators (@CurrentUser, @Public)
│   │   └── dto/            # Login/Register DTOs
│   ├── users/              # Users module
│   │   ├── dto/            # User DTOs
│   │   ├── users.controller.ts
│   │   └── users.service.ts
│   ├── resumes/            # Resumes module
│   │   ├── dto/            # Resume DTOs
│   │   ├── resumes.controller.ts
│   │   └── resumes.service.ts
│   └── templates/          # Templates module
├── shared/                 # Shared utilities and services
│   ├── database/           # Prisma module
│   │   ├── prisma.service.ts
│   │   └── prisma.module.ts
│   ├── config/             # Configuration (future)
│   └── utils/              # Utilities (future)
├── app.module.ts           # Root module
└── main.ts                 # Application entry point

prisma/
├── schema.prisma           # Database schema
├── migrations/             # Version-controlled migrations
└── seed.ts                 # (Optional) Seed data
```

## Security Features

- **Password hashing** with bcrypt (salt rounds: 10)
- **JWT authentication** with configurable expiration
- **Input validation** with class-validator
- **CORS** configured for frontend origins
- **SQL injection protection** via Prisma
- **Role-based access control** (USER/ADMIN)
- **Ownership validation** for resumes

## Production Deployment

### Environment Variables

```env
NODE_ENV=production
DATABASE_URL="postgresql://..."
JWT_SECRET="strong-random-secret"
PORT=3000
CORS_ORIGINS="https://yourdomain.com"
```

### Build & Run

```bash
npm run build
npm run start:prod
```

### With Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
RUN npx prisma generate
CMD ["npm", "run", "start:prod"]
```

## Integration with LLM Service

The API can communicate with the Python LLM service:

```typescript
// In a new service
async askLLM(question: string, resumeContent: string) {
  const response = await fetch(`${process.env.LLM_SERVICE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: question,
      context: resumeContent
    })
  });
  return response.json();
}
```

## GraphQL Support (Future)

To add GraphQL alongside REST:

```bash
npm install @nestjs/graphql @nestjs/apollo @apollo/server graphql
```

Update `app.module.ts` - both REST and GraphQL will work together.

## Next Steps

1. **Add email verification** for registration
2. **Implement password reset** flow
3. **Add file upload** for resume attachments
4. **Create admin dashboard** endpoints
5. **Add rate limiting** for public endpoints
6. **Implement caching** with Redis
7. **Add webhooks** for integrations
8. **Create GraphQL resolvers** for complex queries

## Troubleshooting

### Database connection error
- Verify PostgreSQL is running
- Check `DATABASE_URL` in `.env`
- Ensure database exists

### Migration errors
```bash
npx prisma migrate reset  # Resets database (dev only)
npx prisma generate        # Regenerate client
```

### Port already in use
```bash
# Change PORT in .env or kill process
lsof -ti:3000 | xargs kill -9
```

## Support

- NestJS Docs: https://docs.nestjs.com
- Prisma Docs: https://www.prisma.io/docs
- Swagger UI: http://localhost:3000/api/docs (when running)
