import { useState } from 'react';
import { apiClient } from '../../shared/api/client';

interface PostReactionsProps {
  postId: string;
  reactions: any[];
  onReactionUpdated: () => void;
}

const REACTION_TYPES = [
  { type: 'LIKE', emoji: '👍' },
  { type: 'HEART', emoji: '❤️' },
  { type: 'MEDAL', emoji: '🏅' },
  { type: 'AWARD', emoji: '🏆' },
  { type: 'FIRE', emoji: '🔥' },
  { type: 'LAUGH', emoji: '😂' },
  { type: 'THUMBSUP', emoji: '✌️' },
];

export function PostReactions({ postId, reactions, onReactionUpdated }: PostReactionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [localReactions, setLocalReactions] = useState(reactions);

  const toggleReaction = async (reactionType: string, emoji: string) => {
    setIsLoading(true);
    try {
      const hasReaction = localReactions.some(r => r.reactionType === reactionType);

      if (hasReaction) {
        await apiClient.removeAIContextReaction(postId, reactionType);
        setLocalReactions(localReactions.filter(r => r.reactionType !== reactionType));
      } else {
        const response = await apiClient.addAIContextReaction(postId, reactionType);
        setLocalReactions([...localReactions, response]);
      }

      onReactionUpdated();
    } catch (err) {
      console.error('Failed to update reaction:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Group reactions by type
  const reactionCounts = REACTION_TYPES.reduce((acc, { type, emoji }) => {
    const count = localReactions.filter(r => r.reactionType === type).length;
    if (count > 0) {
      acc.push({ type, emoji, count });
    }
    return acc;
  }, [] as Array<{ type: string; emoji: string; count: number }>);

  return (
    <div className="reactions-container">
      <div className="flex flex-wrap gap-2 mb-3">
        {/* Display current reactions */}
        {reactionCounts.map(({ type, emoji, count }) => (
          <button
            key={type}
            onClick={() => toggleReaction(type, emoji)}
            disabled={isLoading}
            className="btn btn-sm btn-outline btn-primary"
          >
            {emoji} {count}
          </button>
        ))}
      </div>

      {/* Reaction buttons */}
      <div className="flex flex-wrap gap-2">
        {REACTION_TYPES.map(({ type, emoji }) => {
          const isActive = localReactions.some(r => r.reactionType === type);
          return (
            <button
              key={type}
              onClick={() => toggleReaction(type, emoji)}
              disabled={isLoading}
              className={`btn btn-xs gap-1 ${isActive ? 'btn-primary' : 'btn-ghost'}`}
              title={type}
            >
              {emoji}
            </button>
          );
        })}
      </div>
    </div>
  );
}
