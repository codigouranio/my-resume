# Resume Hidden Context Feature

## Overview

Resumes support two types of content:

1. **Public Content** (`content` field) - Displayed to visitors
2. **Hidden Context** (`llmContext` field) - Only accessible to LLAMA for better AI responses

## Why?

Users can provide detailed career information, metrics, accomplishments, and context for the AI chatbot without cluttering their public resume view.

## Usage

### Creating a Resume with Hidden Context

```json
POST /api/resumes
{
  "slug": "john-doe",
  "title": "Software Engineer",
  "content": "# John Doe\n\n## Experience\n\n### Company A\nSoftware Engineer (2020-2023)",
  "llmContext": "### Detailed Context for AI:\n\n**Company A Accomplishments:**\n- Led migration project that reduced costs by 40%\n- Managed team of 5 engineers\n- Tech stack: React, Node.js, PostgreSQL\n- Key challenges: Legacy system integration\n- Learned: Team leadership, cost optimization\n\n**Skills not on public resume:**\n- Proficient in Python, Ruby\n- Experience with AWS, Docker\n- Soft skills: Mentoring, conflict resolution",
  "isPublic": true,
  "isPublished": true
}
```

### How It Works

1. **Public View** (`GET /api/resumes/public/:slug`)
   - Returns only `content` field
   - `llmContext` is stripped out
   - Safe for public consumption

2. **LLM Integration** (`GET /api/resumes/llm/:slug`)
   - Requires authentication
   - Returns combined context: `content` + `llmContext`
   - Used by AI chatbot for rich responses

3. **Owner View** (`GET /api/resumes/:id`)
   - Authenticated user sees both fields
   - Can edit both sections

## Markdown Format Examples

### Option 1: Structured Hidden Content

**Public Content:**
```markdown
# Jane Smith

## Experience

### Tech Corp - Senior Engineer
- Built scalable APIs
- Led team of 3
```

**Hidden Context:**
```markdown
### DETAILED METRICS (AI CONTEXT)

**Tech Corp Details:**
- Reduced API latency by 60% (from 500ms to 200ms)
- Increased throughput from 1K to 10K req/s
- Stack: Node.js, PostgreSQL, Redis, Kubernetes
- Team: 3 junior engineers + 1 intern
- Budget: $200K project
- Timeline: 6 months

**Key Achievements:**
- Implemented caching strategy (Redis)
- Refactored monolith to microservices
- Set up CI/CD pipeline (GitHub Actions)

**Challenges Overcome:**
- Legacy PHP system integration
- Database migration with zero downtime
- Team skill gaps (mentored juniors in Kubernetes)

**Technologies (not all listed publicly):**
- Python, Ruby, Go
- AWS (EC2, RDS, Lambda, S3)
- Terraform, Ansible
- Datadog, Sentry
```

### Option 2: Comment-Style Hidden Sections

**All in Content Field (Alternative Approach):**
```markdown
# John Doe

## Experience

### Company A - Engineer

Built and deployed web applications.

<!-- LLAMA_CONTEXT_START
**Detailed Metrics:**
- 50% performance improvement
- 99.9% uptime achieved
- Managed $500K budget
- Tech: React, Node, PostgreSQL, Redis
LLAMA_CONTEXT_END -->

### Company B - Senior Engineer

Led platform modernization.

<!-- LLAMA_CONTEXT_START
**Impact:**
- Reduced infrastructure costs by $100K/year
- Migrated 200+ legacy services
- Team of 8 engineers
- 12-month timeline
LLAMA_CONTEXT_END -->
```

## Frontend Integration

### Parsing Hidden Sections (if using single content field)

```typescript
// Remove LLAMA context for public display
function getPublicContent(markdown: string): string {
  return markdown.replace(/<!-- LLAMA_CONTEXT_START[\s\S]*?LLAMA_CONTEXT_END -->/g, '');
}

// Extract full content for LLAMA
function getFullContext(markdown: string): string {
  return markdown.replace(/<!-- LLAMA_CONTEXT_START/g, '')
                 .replace(/LLAMA_CONTEXT_END -->/g, '');
}
```

### Using Separate Fields (Recommended)

```typescript
// Public view
<Resume content={resume.content} />

// LLAMA chat integration
const fullContext = `${resume.content}\n\n${resume.llmContext}`;
fetch('/api/llm/chat', {
  body: JSON.stringify({
    message: userQuestion,
    context: fullContext
  })
});
```

## Best Practices

### What to Include in Hidden Context

✅ **Good for llmContext:**
- Detailed metrics and KPIs
- Specific technologies and tools
- Team sizes and budget numbers
- Challenges overcome
- Soft skills and learnings
- Additional skills not listed publicly
- Project timelines and scope
- Private achievements

❌ **Don't Include:**
- Confidential company information
- Proprietary code or algorithms
- Personal sensitive data
- Negative information about companies/people
- Information that violates NDAs

### Security Considerations

1. **Access Control**
   - `llmContext` never exposed in public endpoints
   - Only available via authenticated `/api/resumes/llm/:slug`
   - Owner verification before serving

2. **LLM Service Authentication**
   - Backend-to-backend communication
   - API keys or JWT tokens
   - Rate limiting

3. **Content Validation**
   - Sanitize markdown input
   - Max length limits (e.g., 50KB)
   - No executable code

## Database Schema

```prisma
model Resume {
  content    String  @db.Text  // Public content
  llmContext String? @db.Text  // Hidden AI context
}
```

## API Response Examples

### Public View (No Auth Required)
```json
GET /api/resumes/public/john-doe

{
  "id": "clx...",
  "slug": "john-doe",
  "title": "Software Engineer",
  "content": "# John Doe\n\n## Experience...",
  "template": {...},
  "user": {
    "firstName": "John",
    "lastName": "Doe"
  }
}
```
*Note: `llmContext` is excluded*

### LLM View (Auth Required)
```json
GET /api/resumes/llm/john-doe
Authorization: Bearer xxx

{
  "id": "clx...",
  "title": "Software Engineer",
  "content": "# John Doe\n\n## Experience...",
  "llmContext": "### Detailed metrics...",
  "fullContext": "# John Doe\n\n## Experience...\n\n<!-- ADDITIONAL CONTEXT FOR AI -->\n### Detailed metrics...",
  "user": {
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

### Owner View (Auth Required)
```json
GET /api/resumes/clx...
Authorization: Bearer xxx

{
  "id": "clx...",
  "slug": "john-doe",
  "content": "...",
  "llmContext": "...",
  "isPublic": true,
  "isPublished": true,
  "template": {...}
}
```
*Both fields available for editing*

## Migration Example

If you already have resumes, create a migration:

```bash
npm run prisma:migrate -- --name add_llm_context
```

Existing resumes will have `llmContext = null` (optional field).

## Future Enhancements

- **Version Control**: Track changes to both fields separately
- **Templates**: Pre-filled llmContext templates
- **AI Suggestions**: Auto-generate llmContext from content
- **Analytics**: Track which context sections LLAMA uses most
- **Encryption**: Encrypt llmContext at rest
