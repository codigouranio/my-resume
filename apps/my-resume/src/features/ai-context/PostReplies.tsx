import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../shared/api/client';

interface Reply {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

interface PostRepliesProps {
  postId: string;
  onRepliesChanged?: (replyCount: number) => void;
}

export function PostReplies({ postId, onRepliesChanged }: PostRepliesProps) {
  const { t } = useTranslation();
  const [replies, setReplies] = useState<Reply[]>([]);
  const [newReplyText, setNewReplyText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  useEffect(() => {
    fetchReplies();
  }, [postId]);

  const fetchReplies = async () => {
    setIsLoading(true);
    try {
      const replies = await apiClient.getAIContextReplies(postId);
      setReplies(replies);
    } catch (err) {
      console.error('Failed to load replies:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReplyText.trim()) return;

    setIsSaving(true);
    try {
      const reply = await apiClient.addAIContextReply(postId, newReplyText);
      const updatedReplies = [...replies, reply];
      setReplies(updatedReplies);
      setNewReplyText('');
      onRepliesChanged?.(updatedReplies.length);
    } catch (err) {
      alert('Failed to add reflection');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateReply = async (replyId: string) => {
    if (!editingText.trim()) return;

    setIsSaving(true);
    try {
      const reply = await apiClient.updateAIContextReply(postId, replyId, editingText);
      setReplies(replies.map(r => (r.id === replyId ? reply : r)));
      setEditingReplyId(null);
      setEditingText('');
    } catch (err) {
      alert('Failed to update reflection');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    if (!confirm('Delete this reflection?')) return;

    try {
      await apiClient.deleteAIContextReply(postId, replyId);
      const updatedReplies = replies.filter(r => r.id !== replyId);
      setReplies(updatedReplies);
      onRepliesChanged?.(updatedReplies.length);
    } catch (err) {
      alert('Failed to delete reflection');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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

  return (
    <div className="replies-section mt-4 pl-4 border-l-2 border-primary">
      <h4 className="font-semibold mb-3">💭 {t('ai_context.threaded_reflections')}</h4>

      {/* Add Reply Form */}
      <form onSubmit={handleAddReply} className="mb-4">
        <textarea
          value={newReplyText}
          onChange={(e) => setNewReplyText(e.target.value)}
          placeholder={t('ai_context.add_reflection_placeholder')}
          className="textarea textarea-bordered textarea-sm w-full mb-2"
          rows={2}
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="btn btn-sm btn-primary"
            disabled={isSaving || !newReplyText.trim()}
          >
            {isSaving ? '...' : t('ai_context.add_reflection')}
          </button>
        </div>
      </form>

      {/* Replies List */}
      <div className="space-y-2">
        {isLoading ? (
          <p className="text-sm text-base-content/60">{t('ai_context.loading_reflections')}</p>
        ) : replies.length === 0 ? (
          <p className="text-sm text-base-content/60">{t('ai_context.no_reflections')}</p>
        ) : (
          replies.map(reply => (
            <div key={reply.id} className="bg-base-200 p-3 rounded text-sm">
              {editingReplyId === reply.id ? (
                <div>
                  <textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    className="textarea textarea-bordered textarea-sm w-full mb-2"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateReply(reply.id)}
                      className="btn btn-sm btn-primary btn-outline"
                      disabled={isSaving}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingReplyId(null);
                        setEditingText('');
                      }}
                      className="btn btn-sm btn-ghost"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-base-content/80">{reply.text}</p>
                  <div className="flex justify-between items-center mt-2">
                    <div className="flex-1">
                      <p className="text-xs text-base-content/60">{formatDate(reply.createdAt)}</p>
                      {reply.updatedAt && reply.createdAt !== reply.updatedAt && (
                        <p className="text-xs text-base-content/40 mt-0.5">
                          edited {getRelativeTime(reply.updatedAt)}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditingReplyId(reply.id);
                          setEditingText(reply.text);
                        }}
                        className="btn btn-xs btn-ghost"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteReply(reply.id)}
                        className="btn btn-xs btn-ghost text-error"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
