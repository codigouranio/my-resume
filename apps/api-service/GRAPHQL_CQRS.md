# GraphQL API for My Resume Platform

## Overview

This document explains the GraphQL API implementation using CQRS (Command Query Responsibility Segregation) pattern alongside the existing REST API.

## Architecture

### CQRS Pattern

We've implemented CQRS to separate read operations (queries) from write operations (commands):

- **Queries**: Read-only operations (GET operations in REST)
- **Commands**: Write operations (POST, PATCH, DELETE in REST)
- **Handlers**: Process queries and commands independently

**Benefits:**
- Clear separation of concerns
- Easier to optimize reads vs writes separately
- Better scalability
- Simpler testing

### Dual API Approach

Both REST and GraphQL APIs are available:

**REST API** (existing):
- `/api/resumes` - Full CRUD operations
- `/api/auth` - Authentication
- `/api/users` - User management
- `/api/templates` - Template management

**GraphQL API** (new):
- `/graphql` - Query-only operations (reads)
- GraphQL Playground available at `/graphql` in development

## GraphQL Queries

### Public Queries

#### Get Resume by Slug
```graphql
query GetResume {
  resume(slug: "john-doe") {
    id
    title
    slug
    content
    isPublic
    isPublished
    viewCount
    user {
      firstName
      lastName
    }
    template {
      name
      description
    }
  }
}
```

**Note:** This query excludes `llmContext` for security.

### Authenticated Queries

#### Get My Resume
```graphql
query GetMyResume {
  myResume(id: "clx1234567890") {
    id
    title
    slug
    content
    llmContext  # Only available to owner
    isPublic
    isPublished
    theme
    customCss
    metaTitle
    metaDescription
    viewCount
    createdAt
    updatedAt
  }
}
```

#### Get All My Resumes
```graphql
query GetMyResumes {
  myResumes {
    id
    title
    slug
    isPublic
    isPublished
    viewCount
    updatedAt
  }
}
```

## Authentication

GraphQL queries marked with `@Public()` don't require authentication. Others require JWT token:

```
Authorization: Bearer <your-jwt-token>
```

## CQRS Implementation

### Query Structure

```
queries/
├── get-resume.query.ts              # Query definition
├── get-resume-by-slug.query.ts
├── get-resumes.query.ts
└── handlers/
    ├── get-resume.handler.ts         # Query handler (business logic)
    ├── get-resume-by-slug.handler.ts
    ├── get-resumes.handler.ts
    └── index.ts
```

### How It Works

1. **GraphQL Resolver** receives the request
2. **QueryBus** dispatches the query to appropriate handler
3. **Query Handler** executes business logic via Prisma
4. **Result** returned through GraphQL schema

### Example Flow

```typescript
// 1. Resolver receives request
@Query(() => Resume)
getResumeBySlug(@Args('slug') slug: string) {
  return this.queryBus.execute(new GetResumeBySlugQuery(slug));
}

// 2. Query is created
export class GetResumeBySlugQuery {
  constructor(public readonly slug: string) {}
}

// 3. Handler processes query
@QueryHandler(GetResumeBySlugQuery)
export class GetResumeBySlugHandler {
  async execute(query: GetResumeBySlugQuery) {
    const resume = await this.prisma.resume.findUnique({
      where: { slug: query.slug },
    });
    // Business logic...
    return resume;
  }
}
```

## Testing GraphQL

### Using GraphQL Playground

1. Start the server: `npm run start:dev`
2. Open browser: `http://localhost:3000/graphql`
3. Use the interactive playground to test queries

### Example Request with Authentication

```graphql
# Add to HTTP HEADERS in playground:
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

query {
  myResumes {
    id
    title
    slug
  }
}
```

## Future Enhancements

### Mutations (not yet implemented)

For write operations, you can add mutations following the same CQRS pattern:

```
commands/
├── create-resume.command.ts
├── update-resume.command.ts
└── handlers/
    ├── create-resume.handler.ts
    └── update-resume.handler.ts
```

Example mutation structure:
```graphql
mutation CreateResume($input: CreateResumeInput!) {
  createResume(input: $input) {
    id
    title
    slug
  }
}
```

## REST vs GraphQL

| Feature | REST | GraphQL |
|---------|------|---------|
| Endpoint | Multiple (`/api/resumes`, `/api/users`) | Single (`/graphql`) |
| Over-fetching | Yes (returns all fields) | No (client specifies fields) |
| Under-fetching | Yes (multiple requests needed) | No (nested queries) |
| Versioning | URL versions (`/v1/`, `/v2/`) | Schema evolution |
| Caching | HTTP caching works well | Requires special handling |
| Learning Curve | Familiar | Steeper |

**Recommendation:** Use REST for mutations (write operations) and GraphQL for complex read queries.

## Schema Generation

GraphQL schema is auto-generated from TypeScript decorators:

```typescript
@ObjectType()
export class Resume {
  @Field(() => ID)
  id: string;
  
  @Field()
  title: string;
  
  @Field({ nullable: true })
  llmContext?: string;
}
```

Schema file: `src/schema.gql` (auto-generated, do not edit manually)

## Error Handling

GraphQL errors follow the same patterns as REST:
- `NotFoundException` → GraphQL error with "Resume not found"
- `ForbiddenException` → GraphQL error with "Access denied"
- Auth errors → "Unauthorized" errors

## Performance

- **DataLoader** pattern: Add for N+1 query optimization
- **Query complexity**: Can limit deep nested queries
- **Caching**: Consider Apollo Server caching plugins

## Resources

- [NestJS GraphQL](https://docs.nestjs.com/graphql/quick-start)
- [NestJS CQRS](https://docs.nestjs.com/recipes/cqrs)
- [Apollo Server](https://www.apollographql.com/docs/apollo-server/)
