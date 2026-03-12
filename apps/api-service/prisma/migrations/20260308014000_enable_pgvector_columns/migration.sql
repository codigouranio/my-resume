-- Enable pgvector extension (required for vector columns)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add vector columns to ResumeEmbedding table
-- These were commented out in the initial migration, now we're adding them

ALTER TABLE "ResumeEmbedding" 
  ADD COLUMN IF NOT EXISTS "contentEmbedding" vector(768),
  ADD COLUMN IF NOT EXISTS "llmContextEmbedding" vector(768),
  ADD COLUMN IF NOT EXISTS "combinedEmbedding" vector(768);

-- Create HNSW indexes for fast vector similarity search
-- These indexes dramatically improve search performance (O(log n) instead of O(n))
CREATE INDEX IF NOT EXISTS "ResumeEmbedding_combinedEmbedding_idx" 
  ON "ResumeEmbedding" 
  USING hnsw ("combinedEmbedding" vector_cosine_ops);

-- Optional: Indexes for individual embeddings if needed
-- CREATE INDEX IF NOT EXISTS "ResumeEmbedding_contentEmbedding_idx" 
--   ON "ResumeEmbedding" 
--   USING hnsw ("contentEmbedding" vector_cosine_ops);

-- CREATE INDEX IF NOT EXISTS "ResumeEmbedding_llmContextEmbedding_idx" 
--   ON "ResumeEmbedding" 
--   USING hnsw ("llmContextEmbedding" vector_cosine_ops);
