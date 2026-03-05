import { useState, useEffect } from 'react';
import { apiClient } from '../../shared/api/client';
import { PostForm } from './PostForm';
import { PostCard } from './PostCard';
import { SearchPosts } from './SearchPosts';
import './AIContextFeed.css';

interface Post {
  id: string;
  text: string;
  publishedAt: string;
  includeInAI: boolean;
  attachments: any[];
  reactions: any[];
  replies: any[];
  resumeTags: any[];
  createdAt: string;
  updatedAt: string;
}

const API_URL = import.meta.env.PUBLIC_API_URL || '';

export function AIContextFeed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPostForm, setShowPostForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchPosts();
  }, [searchQuery]);

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      const posts = await apiClient.getAIContextPosts(searchQuery);
      setPosts(posts);
    } catch (err: any) {
      setError(err.message || 'Failed to load posts');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePostCreated = (newPost: Post) => {
    setPosts([newPost, ...posts]);
    setShowPostForm(false);
  };

  const handlePostUpdated = (updatedPost: Post) => {
    setPosts(posts.map(p => (p.id === updatedPost.id ? updatedPost : p)));
  };

  const handlePostDeleted = (postId: string) => {
    setPosts(posts.filter(p => p.id !== postId));
  };

  return (
    <div className="ai-context-feed">
      <div className="feed-header">
        <h2>🤖 AI Context Journal</h2>
        <p className="feed-description">
          Organize your personal life and achievements. All enabled posts become rich context for AI.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Post Form Toggle */}
      {!showPostForm ? (
        <button
          className="btn btn-primary btn-lg gap-2 mb-6"
          onClick={() => setShowPostForm(true)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          New Journal Entry
        </button>
      ) : (
        <PostForm
          onPostCreated={handlePostCreated}
          onCancel={() => setShowPostForm(false)}
        />
      )}

      {/* Search */}
      <SearchPosts onSearch={setSearchQuery} />

      {/* Posts */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="card bg-base-100 shadow">
              <div className="card-body">
                <div className="skeleton h-6 w-3/4"></div>
                <div className="skeleton h-4 w-full"></div>
                <div className="skeleton h-4 w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="empty-state">
          <div className="text-center">
            <svg className="mx-auto h-24 w-24 text-base-content/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 19c-1.1 0-2-.9-2-2V7c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2H7z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium">No entries yet</h3>
            <p className="mt-2 text-sm text-base-content/60">Start capturing your life and achievements</p>
            <button
              className="btn btn-primary mt-6"
              onClick={() => setShowPostForm(true)}
            >
              Create Your First Entry
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onUpdated={handlePostUpdated}
              onDeleted={handlePostDeleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}
