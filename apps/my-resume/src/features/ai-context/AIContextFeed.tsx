import { Button } from "@shared/components/button";
import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../shared/api/client';
import { useAuth } from '../../shared/contexts/AuthContext';
import { PostCard } from './PostCard';
import { PostForm } from './PostForm';
import { SearchPosts } from './SearchPosts';
import { Input } from "@shared/components/input"

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
const POSTS_PER_PAGE = 20;

export function AIContextFeed() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [showPostForm, setShowPostForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const observerTarget = useRef<HTMLDivElement>(null);

  // Reset pagination when search changes
  useEffect(() => {
    setPosts([]);
    setPage(0);
    setHasMore(true);
    fetchPosts(true);
  }, [searchQuery]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          loadMorePosts();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [hasMore, isLoading, isLoadingMore, page, searchQuery]);

  // Show scroll to top button after scrolling
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 800);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fetchPosts = async (reset = false) => {
    if (reset) {
      setIsLoading(true);
    }

    try {
      const offset = reset ? 0 : page * POSTS_PER_PAGE;
      const newPosts = await apiClient.getAIContextPosts(
        searchQuery,
        undefined,
        undefined,
        POSTS_PER_PAGE,
        offset
      );

      if (reset) {
        setPosts(newPosts);
        setPage(1);
      } else {
        setPosts(prev => [...prev, ...newPosts]);
        setPage(prev => prev + 1);
      }

      // Check if we got fewer posts than requested (means no more data)
      setHasMore(newPosts.length === POSTS_PER_PAGE);
    } catch (err: any) {
      setError(err.message || 'Failed to load posts');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMorePosts = async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const offset = page * POSTS_PER_PAGE;
      const newPosts = await apiClient.getAIContextPosts(
        searchQuery,
        undefined,
        undefined,
        POSTS_PER_PAGE,
        offset
      );

      setPosts(prev => [...prev, ...newPosts]);
      setPage(prev => prev + 1);
      setHasMore(newPosts.length === POSTS_PER_PAGE);
    } catch (err: any) {
      setError(err.message || 'Failed to load more posts');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        <div className="flex justify-between items-start">
          <div>
            <h2>{t('ai_context.journal')}</h2>
            <p className="feed-description">
              {t('ai_context.journal_description')}
            </p>
          </div>
          {user && (
            <Link
              to={`/journal/${user.id}`}
              className="btn btn-ghost btn-sm gap-1"
              target="_blank"
              rel="noopener noreferrer"
            >
              🌐 {t('ai_context.view_public_journal')}
            </Link>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Post Form Toggle */}
      {!showPostForm ? (
        <Button
          variant="outline"
          className="gap-2 mb-6"
          // className="btn btn-primary btn-lg gap-2 mb-6"
          onClick={() => setShowPostForm(true)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          {t('ai_context.new_entry')}
        </Button>
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
            <h3 className="mt-4 text-lg font-medium">{t('ai_context.no_entries')}</h3>
            <p className="mt-2 text-sm text-base-content/60">{t('ai_context.start_capturing')}</p>
            <Button
              className="btn btn-primary mt-6"
              onClick={() => setShowPostForm(true)}
            >
              {t('ai_context.create_first_entry')}
            </Button>
          </div>
        </div>
      ) : (
        <>
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

          {/* Infinite scroll trigger */}
          <div ref={observerTarget} className="py-4">
            {isLoadingMore && (
              <div className="flex justify-center">
                <span className="loading loading-spinner loading-md text-primary"></span>
              </div>
            )}
            {!hasMore && posts.length > 0 && (
              <p className="text-center text-base-content/60 text-sm">
                🎉 {t('ai_context.reached_end')}
              </p>
            )}
          </div>
        </>
      )}

      {/* Scroll to top button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 btn btn-circle btn-primary shadow-lg z-50 hover:scale-110 transition-transform"
          title="Scroll to top"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 10l7-7m0 0l7 7m-7-7v18"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
