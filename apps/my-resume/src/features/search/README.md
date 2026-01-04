# Resume Search Feature

## Overview

AI-powered semantic search for resumes using vector embeddings and pgvector.

## Features

- **Semantic Search**: Natural language queries that understand meaning, not just keywords
- **Similarity Scoring**: Each result includes a similarity score (0-1) showing match quality
- **Adjustable Threshold**: Control result quality with the minimum similarity slider
- **Real-time Results**: Fast search powered by HNSW indexes (sub-100ms typical)
- **Responsive UI**: Works on desktop and mobile with DaisyUI styling

## Usage

### Basic Search

Navigate to `/search` and enter a query like:
- "Python developer with AWS experience"
- "Senior security engineer"
- "Full stack React developer"

### Advanced Options

Click "Advanced Options" to adjust:
- **Minimum Similarity**: Higher values (0.6-0.8) = more strict matching, fewer results
- Default is 0.4 (40% similarity) which works well for most queries

### Understanding Similarity Scores

- **70-100%** (Green): Excellent match - very relevant
- **50-69%** (Blue): Good match - relevant skills/experience
- **40-49%** (Yellow): Fair match - some relevance
- **Below 40%**: Filtered out by default

## Technical Details

### API Endpoint

```typescript
POST /api/embeddings/search
{
  "query": "Python developer",
  "minSimilarity": 0.4,  // Optional, default: 0.4
  "limit": 10,            // Optional, default: 10
  "offset": 0,            // Optional, for pagination
  "publicOnly": true      // Optional, default: true
}
```

### Response Format

```typescript
{
  "query": "Python developer",
  "results": [
    {
      "id": "...",
      "slug": "john-doe",
      "title": "John Doe - Software Engineer",
      "content": "...",
      "userId": "...",
      "user": {
        "firstName": "John",
        "lastName": "Doe"
      },
      "similarity": 0.5614,
      "rank": 1
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0,
  "executionTime": 90
}
```

## Architecture

### Components

- `SearchPage.tsx`: Main search UI component
- `SearchService` (backend): Handles embedding generation and vector search
- `SearchResumesDto`: Request/response types

### Search Flow

1. User enters query → Generate embedding via Ollama (nomic-embed-text)
2. Execute pgvector cosine similarity search against resume embeddings
3. Filter by minimum similarity threshold
4. Return ranked results with similarity scores

### Database

- **Table**: `ResumeEmbedding`
- **Index**: HNSW index on `combinedEmbedding` column (m=16, ef_construction=64)
- **Vector Dimensions**: 768 (nomic-embed-text output)

## Development

### Local Testing

```bash
# Frontend dev server
cd apps/my-resume
yarn dev

# Visit http://localhost:3000/search
```

### API Testing

```bash
curl -X POST http://localhost:3000/api/embeddings/search \
  -H "Content-Type: application/json" \
  -d '{"query":"Python developer"}'
```

## Performance

- Typical search time: 70-150ms
- Includes:
  - Embedding generation: ~50-80ms
  - Vector search: ~10-30ms
  - Result processing: ~5-10ms

## Future Enhancements

- [ ] Filters by location, experience level, skills
- [ ] Saved searches
- [ ] Search history
- [ ] Email alerts for new matches
- [ ] Bulk operations (download multiple resumes)
- [ ] Advanced boolean queries (AND/OR/NOT)
