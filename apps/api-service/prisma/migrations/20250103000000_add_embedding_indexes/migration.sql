-- CreateIndex: Add HNSW vector indexes for fast similarity search
-- HNSW (Hierarchical Navigable Small World) is optimal for <1M vectors
-- Provides better query performance than IVFFlat for our use case

-- Index on combinedEmbedding (most common search target)
CREATE INDEX IF NOT EXISTS "ResumeEmbedding_combinedEmbedding_idx" 
ON "ResumeEmbedding" 
USING hnsw ("combinedEmbedding" vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Index on contentEmbedding (for content-only searches)
CREATE INDEX IF NOT EXISTS "ResumeEmbedding_contentEmbedding_idx" 
ON "ResumeEmbedding" 
USING hnsw ("contentEmbedding" vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Index on llmContextEmbedding (for context-only searches, sparse because of NULLs)
CREATE INDEX IF NOT EXISTS "ResumeEmbedding_llmContextEmbedding_idx" 
ON "ResumeEmbedding" 
USING hnsw ("llmContextEmbedding" vector_cosine_ops)
WITH (m = 16, ef_construction = 64)
WHERE "llmContextEmbedding" IS NOT NULL;

-- HNSW Parameters:
-- m = 16: Number of bidirectional links per node (default). Higher = better recall, more memory
-- ef_construction = 64: Size of dynamic candidate list during index construction (default)
--                        Higher = better quality index, slower to build
-- vector_cosine_ops: Use cosine distance for similarity (1 - cosine_similarity)
--                    Returns 0 for identical vectors, 2 for opposite vectors

-- Performance characteristics:
-- - Build time: O(n log n), ~1-2 seconds per 10,000 vectors
-- - Query time: Sub-100ms for k-NN search across millions of vectors  
-- - Memory: ~200-400 bytes per vector (depends on m parameter)
-- - Recall: 95-99% at typical settings

-- For production tuning:
-- - Increase m to 24-32 for better recall at cost of memory
-- - Increase ef_construction to 128-200 for better index quality
-- - At query time, can adjust ef_search (SET hnsw.ef_search = 100) for recall vs speed tradeoff
