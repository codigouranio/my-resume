import { useState, useEffect } from 'react';
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
}

export function PublicJournalPage() {
  const { username } = useParams<{ username: string }>();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());

  const TRUNCATE_LENGTH = 280;

  useEffect(() => {
    loadPosts();
  }, [username]);

  const loadPosts = async () => {
    if (!username) return;

    setIsLoading(true);
    setError('');
    try {
      const response = await apiClient.getPublicPosts(username);
      setPosts(response.posts || []);
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
          <h1 className="text-3xl font-bold">📖 {username}'s Journal</h1>
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
    </div>
  );
}
