# Shared

This directory contains shared utilities, services, and modules used across multiple features.

## Current Shared Modules

### 🗄️ Database
Prisma ORM setup and database access
- `prisma.service.ts` - Database connection service
- `prisma.module.ts` - Global Prisma module

**Usage:**
```typescript
import { PrismaService } from '@shared/database/prisma.service';

constructor(private prisma: PrismaService) {}
```

### ⚙️ Config
Configuration utilities (future)
- Environment variable validation
- App configuration
- Feature flags

### 🛠️ Utils
Shared utility functions (future)
- String helpers
- Date formatters
- Validators
- Transformers

## Guidelines

1. **Keep it Generic**: Only add code that's truly reusable across multiple features
2. **No Business Logic**: Shared code should be infrastructure, not domain logic
3. **Well Documented**: Add clear comments and examples
4. **Type Safe**: Use TypeScript to its fullest
5. **Tested**: Write tests for shared utilities

## Path Aliases

Use TypeScript path aliases for cleaner imports:

```typescript
// ✅ Good
import { PrismaService } from '@shared/database/prisma.service';

// ❌ Avoid
import { PrismaService } from '../../shared/database/prisma.service';
```

Configure in `tsconfig.json`:
```json
{
  "paths": {
    "@shared/*": ["src/shared/*"]
  }
}
```
