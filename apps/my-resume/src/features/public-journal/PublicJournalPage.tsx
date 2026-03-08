import { useState, useEffect } from 'react';
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

export function PublicJournalPage() {
  const { userId } = useParams<{ userId: string }>();
  const [posts, setPosts] = useState<Post[]>([]);
  const [userName, setUserName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);

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

  useEffect(() => {
    loadPosts();
  }, [userId]);

  const loadPosts = async () => {
    if (!userId) return;

    setIsLoading(true);
    setError('');
    try {
      const response: PublicJournalResponse = await apiClient.getPublicPosts(userId);
      setPosts(response.posts || []);

      // Build user display name
      if (response.user) {
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
      } else {
        // Fallback if user data not returned by API
        setUserName('User');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load public posts');
    } finally {
      setIsLoading(false);
    }
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
      </div>

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
