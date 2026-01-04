import { useState } from 'react';

interface SearchResult {
  id: string;
  slug: string;
  title: string;
  content: string;
  userId: string;
  user?: {
    firstName: string;
    lastName: string;
  };
  similarity: number;
  rank: number;
}

interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
  limit: number;
  offset: number;
  executionTime: number;
}

export const SearchPage = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInfo, setSearchInfo] = useState<{
    total: number;
    executionTime: number;
  } | null>(null);
  const [minSimilarity, setMinSimilarity] = useState(0.4);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (query.trim().length < 3) {
      setError('Query must be at least 3 characters');
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const apiUrl = import.meta.env.PUBLIC_API_URL || 'http://localhost:3000/api';
      const response = await fetch(`${apiUrl}/embeddings/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          minSimilarity,
          limit: 20,
        }),
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data: SearchResponse = await response.json();
      setResults(data.results);
      setSearchInfo({
        total: data.total,
        executionTime: data.executionTime,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 0.7) return 'badge-success';
    if (similarity >= 0.5) return 'badge-info';
    if (similarity >= 0.4) return 'badge-warning';
    return 'badge-error';
  };

  const getSimilarityLabel = (similarity: number) => {
    if (similarity >= 0.7) return 'Excellent Match';
    if (similarity >= 0.5) return 'Good Match';
    if (similarity >= 0.4) return 'Fair Match';
    return 'Weak Match';
  };

  return (
    <div className="min-h-screen bg-base-200">
      {/* Header */}
      <div className="bg-base-100 border-b border-base-300">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h1 className="text-3xl font-bold">Resume Search</h1>
          </div>
          <p className="text-base-content/70 max-w-2xl">
            Use AI-powered semantic search to find resumes based on skills, experience, and job descriptions.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Search Form */}
        <form onSubmit={handleSearch} className="card bg-base-100 shadow-xl mb-8">
          <div className="card-body">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Search Query</span>
              </label>
              <div className="join w-full">
                <input
                  type="text"
                  placeholder="e.g., Python developer with AWS and Docker experience"
                  className="input input-bordered join-item flex-1"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="submit"
                  className={`btn btn-primary join-item ${loading ? 'loading' : ''}`}
                  disabled={loading || query.trim().length < 3}
                >
                  {loading ? (
                    <>
                      <span className="loading loading-spinner loading-sm"></span>
                      Searching...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Search
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Advanced Options */}
            <div className="collapse collapse-arrow bg-base-200 mt-4">
              <input type="checkbox" />
              <div className="collapse-title text-sm font-medium">
                Advanced Options
              </div>
              <div className="collapse-content">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Minimum Similarity: {(minSimilarity * 100).toFixed(0)}%</span>
                    <span className="label-text-alt">Higher = more strict</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={minSimilarity}
                    onChange={(e) => setMinSimilarity(parseFloat(e.target.value))}
                    className="range range-primary range-sm"
                  />
                  <div className="flex justify-between text-xs px-2 mt-1">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Error Alert */}
        {error && (
          <div className="alert alert-error mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Search Info */}
        {searchInfo && results.length > 0 && (
          <div className="flex items-center justify-between mb-6 text-sm text-base-content/70">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>Found {searchInfo.total} result{searchInfo.total !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>in {searchInfo.executionTime}ms</span>
            </div>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-4">
            {results.map((result) => (
              <div key={result.id} className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
                <div className="card-body">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="card-title text-xl">
                          <a
                            href={`/${result.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link link-hover"
                          >
                            {result.title}
                          </a>
                        </h2>
                        <div className="badge badge-neutral">#{result.rank}</div>
                      </div>

                      {result.user && (
                        <div className="flex items-center gap-2 text-sm text-base-content/70 mb-3">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span>{result.user.firstName} {result.user.lastName}</span>
                        </div>
                      )}

                      <div className="prose prose-sm max-w-none text-base-content/80">
                        <p className="line-clamp-3">{result.content}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className={`badge ${getSimilarityColor(result.similarity)} badge-lg`}>
                        {(result.similarity * 100).toFixed(1)}%
                      </div>
                      <span className="text-xs text-base-content/60">
                        {getSimilarityLabel(result.similarity)}
                      </span>
                    </div>
                  </div>

                  <div className="card-actions justify-end mt-4">
                    <a
                      href={`/${result.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-sm"
                    >
                      View Resume
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No Results State */}
        {!loading && results.length === 0 && searchInfo && (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body items-center text-center py-12">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 text-base-content/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="text-xl font-semibold mb-2">No results found</h3>
              <p className="text-base-content/70 max-w-md">
                Try adjusting your search query or lowering the minimum similarity threshold in advanced options.
              </p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !searchInfo && !error && (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body items-center text-center py-12">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 text-primary/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="text-xl font-semibold mb-2">Start Searching</h3>
              <p className="text-base-content/70 max-w-md mb-4">
                Enter keywords, skills, or job descriptions to find matching resumes using AI-powered semantic search.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 text-left">
                <div className="card bg-base-200">
                  <div className="card-body p-4">
                    <h4 className="font-semibold text-sm mb-2">By Skills</h4>
                    <p className="text-xs text-base-content/70">Python, AWS, Docker, React</p>
                  </div>
                </div>
                <div className="card bg-base-200">
                  <div className="card-body p-4">
                    <h4 className="font-semibold text-sm mb-2">By Role</h4>
                    <p className="text-xs text-base-content/70">Senior Full Stack Developer</p>
                  </div>
                </div>
                <div className="card bg-base-200">
                  <div className="card-body p-4">
                    <h4 className="font-semibold text-sm mb-2">By Domain</h4>
                    <p className="text-xs text-base-content/70">Cybersecurity, Cloud Infrastructure</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
