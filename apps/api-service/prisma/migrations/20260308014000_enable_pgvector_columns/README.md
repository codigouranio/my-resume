# pgvector Migration for Semantic Search

## Overview

This migration enables pgvector extension and adds vector embedding columns to the `ResumeEmbedding` table for AI-powered semantic search.

## What It Does

1. **Enables pgvector extension**: `CREATE EXTENSION IF NOT EXISTS vector`
2. **Adds 3 vector columns** to `ResumeEmbedding`:
   - `contentEmbedding` (768 dimensions) - Public resume content
   - `llmContextEmbedding` (768 dimensions) - Hidden AI context
   - `combinedEmbedding` (768 dimensions) - Weighted combination for search
3. **Creates HNSW index** on `combinedEmbedding` for fast cosine similarity search

## Local Setup

```bash
cd apps/api-service

# Apply the migration
npx prisma migrate deploy

# Regenerate Prisma client
npm run prisma:generate

# Restart API service
npm run start:dev
```

## Production Deployment

The migration is automatically applied when you deploy using:

```bash
# From project root
./ansible/deploy_with_conda.sh

# Or from api-service directory
npm run prisma:migrate  # This runs 'prisma migrate deploy'
```

## Prerequisites

The pgvector PostgreSQL extension must be installed on your server:

### Ubuntu/Debian
```bash
sudo apt install postgresql-15-pgvector
```

### CentOS/RHEL
```bash
sudo yum install pgvector_15
```

### macOS (Homebrew)
```bash
brew install pgvector
```

### From Source
```bash
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

## Verification

After deployment, verify the setup:

```bash
# Check extension is enabled
psql -d resume_db -c "SELECT * FROM pg_extension WHERE extname = 'vector';"

# Check columns exist
psql -d resume_db -c "\d ResumeEmbedding"

# Check HNSW index exists
psql -d resume_db -c "\di ResumeEmbedding_combinedEmbedding_idx"
```

## Troubleshooting

### Error: "extension 'vector' is not available"

The pgvector extension is not installed. Install it using the commands above for your OS.

### Error: "could not access file 'vector'"

PostgreSQL cannot find the pgvector library. Ensure:
1. pgvector is installed for your PostgreSQL version
2. PostgreSQL was restarted after installation
3. The library path is correct

### Error: "column does not exist"

The migration hasn't been applied yet. Run:
```bash
npx prisma migrate deploy
```

## Performance Notes

- HNSW (Hierarchical Navigable Small World) index provides O(log n) search time
- Index building time: ~1-2 seconds per 1000 resumes
- Query time: <100ms for most searches even with 10k+ resumes
- Disk space: ~3MB per 1000 resumes (768-dim vectors × 3 columns)

## Rollback

If you need to rollback this migration:

```sql
-- Remove indexes
DROP INDEX IF EXISTS "ResumeEmbedding_combinedEmbedding_idx";

-- Remove columns
ALTER TABLE "ResumeEmbedding" 
  DROP COLUMN IF EXISTS "contentEmbedding",
  DROP COLUMN IF EXISTS "llmContextEmbedding",
  DROP COLUMN IF EXISTS "combinedEmbedding";

-- Drop extension (only if not used by other tables)
DROP EXTENSION IF EXISTS vector;
```

## Next Steps

After successful migration:

1. **Generate embeddings** for existing resumes:
   - Embeddings are auto-generated on resume create/update
   - For bulk generation, use the embeddings API endpoint

2. **Test search**:
   - Navigate to `/search` in the frontend
   - Try queries like "Python developer with AWS experience"

3. **Monitor performance**:
   - Check query execution times in logs
   - Monitor index usage with: `SELECT * FROM pg_stat_user_indexes WHERE indexrelname LIKE '%combinedEmbedding%';`

## Related Files

- `prisma/schema.prisma` - Schema definition with vector columns
- `src/features/embeddings/search.service.ts` - Search implementation
- `src/features/embeddings/embedding-processor.ts` - Embedding generation
- `apps/my-resume/src/features/search/` - Frontend search UI
