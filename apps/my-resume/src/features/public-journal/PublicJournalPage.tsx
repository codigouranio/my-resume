import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import { apiClient } from '../../shared/api/client';
import { linkifyText } from '../ai-context/utils/linkify';

interface Post {
  id: string;
  text: string;
  publishedAt: string;
  updatedAt: string;
  isPublic: boolean;
  reactions?: any[];
  attachments?: any[];
}

interface PublicJournalResponse {
  posts: Post[];
  user: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
}

const POSTS_PER_PAGE = 20;

export function PublicJournalPage() {
  const { userId } = useParams<{ userId: string }>();
  const [posts, setPosts] = useState<Post[]>([]);
  const [userName, setUserName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const observerTarget = useRef<HTMLDivElement>(null);
  const TRUNCATE_LENGTH = 280;

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (lightboxImage) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [lightboxImage]);

  // Load initial posts
  useEffect(() => {
    loadPosts(true);
  }, [userId]);

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
  }, [hasMore, isLoading, isLoadingMore, page]);

  // Show scroll to top button after scrolling
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 800);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const loadPosts = async (reset = false) => {
    if (!userId) return;

    if (reset) {
      setIsLoading(true);
    }

    setError('');
    try {
      const offset = reset ? 0 : page * POSTS_PER_PAGE;
      const response: PublicJournalResponse = await apiClient.getPublicPosts(
        userId,
        POSTS_PER_PAGE,
        offset
      );

      if (reset) {
        setPosts(response.posts || []);
        setPage(1);
      } else {
        setPosts(prev => [...prev, ...(response.posts || [])]);
        setPage(prev => prev + 1);
      }

      // Check if we got fewer posts than requested (means no more data)
      setHasMore((response.posts || []).length === POSTS_PER_PAGE);

      // Build user display name (only set on first load)
      if (reset && response.user) {
        const { firstName, lastName, email } = response.user;
        if (firstName && lastName) {
          setUserName(`${firstName} ${lastName}`);
        } else if (firstName) {
          setUserName(firstName);
        } else if (lastName) {
          setUserName(lastName);
        } else {
          setUserName(email.split('@')[0]);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load public posts');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMorePosts = async () => {
    if (!userId || isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const offset = page * POSTS_PER_PAGE;
      const response: PublicJournalResponse = await apiClient.getPublicPosts(
        userId,
        POSTS_PER_PAGE,
        offset
      );

      setPosts(prev => [...prev, ...(response.posts || [])]);
      setPage(prev => prev + 1);
      setHasMore((response.posts || []).length === POSTS_PER_PAGE);
    } catch (err: any) {
      setError(err.message || 'Failed to load more posts');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRelativeTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return formatDateTime(dateString);
  };

  const toggleExpanded = (postId: string) => {
    const newExpanded = new Set(expandedPosts);
    if (newExpanded.has(postId)) {
      newExpanded.delete(postId);
    } else {
      newExpanded.add(postId);
    }
    setExpandedPosts(newExpanded);
  };

  const groupReactions = (reactions: any[]) => {
    const REACTION_EMOJIS: Record<string, string> = {
      STAR: '⭐',
      LIKE: '👍',
      HEART: '❤️',
      MEDAL: '🏅',
      AWARD: '🏆',
      FIRE: '🔥',
      LAUGH: '😂',
      THUMBSUP: '✌️',
    };

    const counts: Record<string, number> = {};
    reactions.forEach(r => {
      counts[r.reactionType] = (counts[r.reactionType] || 0) + 1;
    });

    return Object.entries(counts).map(([type, count]) => ({
      emoji: REACTION_EMOJIS[type] || '❓',
      count,
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="loading loading-spinner loading-lg"></span>
          <p>Loading public journal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="alert alert-error max-w-md">
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      {/* Header */}
      <div className="bg-base-100 shadow-sm border-b border-base-300">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">📖 {userName ? `${userName}'s Journal` : 'Journal'}</h1>
          <p className="text-base-content/60 mt-2">
            Public thoughts, achievements, and reflections
          </p>
        </div>
      </div>

      {/* Posts */}
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {posts.length === 0 ? (
          <div className="card bg-base-100 shadow">
            <div className="card-body text-center">
              <p className="text-base-content/60">
                No public posts yet. Check back later!
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => {
              const shouldTruncate = post.text.length > TRUNCATE_LENGTH;
              const isExpanded = expandedPosts.has(post.id);
              const reactionGroups = groupReactions(post.reactions || []);

              return (
                <div key={post.id} className="card bg-base-100 shadow hover:shadow-lg transition-shadow">
                  <div className="card-body">
                    {/* Date */}
                    <p className="text-sm text-base-content/60">
                      📅 {formatDate(post.publishedAt)}
                    </p>
                    {post.updatedAt && post.publishedAt !== post.updatedAt && (
                      <p className="text-xs text-base-content/40 mt-0.5">
                        edited {getRelativeTime(post.updatedAt)}
                      </p>
                    )}

                    {/* Content */}
                    <div className="text-base leading-relaxed mt-2">
                      <p className="whitespace-pre-wrap">
                        {shouldTruncate && !isExpanded
                          ? linkifyText(post.text.substring(0, TRUNCATE_LENGTH) + '...')
                          : linkifyText(post.text)}
                      </p>
                      {shouldTruncate && (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(post.id)}
                          className="text-primary hover:underline text-sm mt-1 font-medium"
                        >
                          {isExpanded ? '← Show less' : 'Show more →'}
                        </button>
                      )}
                    </div>

                    {/* Attachments */}
                    {post.attachments && post.attachments.length > 0 && (
                      <>
                        <div className="divider my-2"></div>
                        {post.attachments.map((attachment: any) => {
                          const isImage = attachment.fileType.startsWith('image/');
                          const isPdf = attachment.fileType === 'application/pdf';
                          const isDocument = ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/markdown', 'text/plain'].includes(attachment.fileType);

                          return (
                            <div
                              key={attachment.id}
                              className="attachment mb-2 p-3 bg-base-200 rounded"
                            >
                              {isImage ? (
                                <div className="flex flex-col gap-2">
                                  <img
                                    src={attachment.fileUrl}
                                    alt={attachment.fileName}
                                    className="max-h-64 rounded object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => setLightboxImage({ url: attachment.fileUrl, name: attachment.fileName })}
                                    title="Click to view full size"
                                  />
                                  <span className="text-xs text-base-content/60">{attachment.fileName}</span>
                                </div>
                              ) : isPdf ? (
                                <a
                                  href={attachment.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="link link-primary gap-2 flex items-center"
                                >
                                  📄 {attachment.fileName}
                                </a>
                              ) : isDocument ? (
                                <a
                                  href={attachment.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="link link-primary gap-2 flex items-center"
                                >
                                  📝 {attachment.fileName}
                                </a>
                              ) : (
                                <a
                                  href={attachment.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="link link-primary gap-2 flex items-center"
                                >
                                  📎 {attachment.fileName}
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </>
                    )}

                    {/* Reactions */}
                    {reactionGroups.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {reactionGroups.map(({ emoji, count }, idx) => (
                          <div key={idx} className="badge badge-outline gap-1">
                            {emoji} {count}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Infinite scroll trigger */}
        {posts.length > 0 && (
          <div ref={observerTarget} className="py-8">
            {isLoadingMore && (
              <div className="flex justify-center">
                <span className="loading loading-spinner loading-md text-primary"></span>
              </div>
            )}
            {!hasMore && (
              <p className="text-center text-base-content/60 text-sm">
                🎉 You've reached the end
              </p>
            )}
          </div>
        )}
      </div>

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

      {/* Image Lightbox Modal - Rendered via Portal */}
      {lightboxImage && createPortal(
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 overflow-hidden"
          style={{ zIndex: 99999 }}
          onClick={() => setLightboxImage(null)}
        >
          {/* Close Button - Fixed at top right of screen */}
          <button
            className="fixed top-4 right-4 btn btn-circle btn-sm bg-white/10 border-white/20 text-white hover:bg-white/20"
            onClick={() => setLightboxImage(null)}
          >
            ✕
          </button>

          <div className="relative max-w-7xl max-h-full flex flex-col items-center gap-4">
            <img
              src={lightboxImage.url}
              alt={lightboxImage.name}
              className="max-w-full max-h-[85vh] object-contain rounded"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="text-white text-center text-sm">{lightboxImage.name}</p>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
