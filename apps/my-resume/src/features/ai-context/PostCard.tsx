import { useState } from 'react';
import { apiClient } from '../../shared/api/client';
import { PostReactions } from './PostReactions';
import { PostReplies } from './PostReplies';
import { PostForm } from './PostForm';
import { linkifyText } from './utils/linkify';

interface PostCardProps {
  post: any;
  onUpdated: (post: any) => void;
  onDeleted: (postId: string) => void;
}

export function PostCard({ post, onUpdated, onDeleted }: PostCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [replyCount, setReplyCount] = useState(post.replies?.length || 0);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // X/Twitter-style: truncate at ~280 characters
  const TRUNCATE_LENGTH = 280;
  const shouldTruncate = post.text.length > TRUNCATE_LENGTH;

  const handleDelete = async () => {
    if (!confirm('Delete this journal entry?')) return;

    setIsDeleting(true);
    try {
      await apiClient.deleteAIContextPost(post.id);
      onDeleted(post.id);
    } catch (err) {
      alert('Failed to delete post');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm('Delete this file?')) return;

    setDeletingAttachmentId(attachmentId);
    try {
      await apiClient.removeAIContextAttachment(post.id, attachmentId);

      // Update post to remove the attachment
      const updatedPost = {
        ...post,
        attachments: post.attachments.filter((a: any) => a.id !== attachmentId),
      };
      onUpdated(updatedPost);
    } catch (err) {
      alert('Failed to delete attachment');
    } finally {
      setDeletingAttachmentId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
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

  if (isEditing) {
    return (
      <PostForm
        initialPost={post}
        postId={post.id}
        onPostCreated={(updatedPost) => {
          onUpdated(updatedPost);
          setIsEditing(false);
        }}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  return (
    <div className="card bg-base-100 shadow hover:shadow-lg transition-shadow">
      <div className="card-body">
        {/* Header */}
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1">
            <p className="text-sm text-base-content/60">
              📅 {formatDate(post.publishedAt)}
            </p>
            {post.updatedAt && post.publishedAt !== post.updatedAt && (
              <p className="text-xs text-base-content/40 mt-0.5">
                edited {getRelativeTime(post.updatedAt)}
              </p>
            )}
          </div>
          <div className="flex gap-1">
            {!post.includeInAI && (
              <div className="badge badge-warning gap-1 text-xs">
                🔒 Hidden from AI
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="text-base leading-relaxed">
          <p className="whitespace-pre-wrap">
            {shouldTruncate && !isExpanded
              ? linkifyText(post.text.substring(0, TRUNCATE_LENGTH) + '...')
              : linkifyText(post.text)}
          </p>
          {shouldTruncate && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-primary hover:underline text-sm mt-1 font-medium"
            >
              {isExpanded ? '← Show less' : 'Show more →'}
            </button>
          )}
        </div>

        {/* Attachments */}
        {post.attachments && post.attachments.length > 0 && (
          <div className="mt-3 divider my-2"></div>
        )}
        {post.attachments?.map((attachment: any) => {
          const isImage = attachment.fileType.startsWith('image/');
          const isPdf = attachment.fileType === 'application/pdf';
          const isDocument = ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/markdown', 'text/plain'].includes(attachment.fileType);
          const isDeleting = deletingAttachmentId === attachment.id;

          return (
            <div
              key={attachment.id}
              className="attachment mb-2 p-3 bg-base-200 rounded"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  {isImage ? (
                    <div className="flex flex-col gap-2">
                      <img
                        src={attachment.fileUrl}
                        alt={attachment.fileName}
                        className="max-h-64 rounded"
                      />
                      <span className="text-xs text-base-content/60">{attachment.fileName}</span>
                    </div>
                  ) : isPdf ? (
                    <a
                      href={attachment.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link gap-2 flex items-center"
                    >
                      📄 {attachment.fileName}
                    </a>
                  ) : isDocument ? (
                    <a
                      href={attachment.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link gap-2 flex items-center"
                    >
                      📝 {attachment.fileName}
                    </a>
                  ) : (
                    <a
                      href={attachment.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link gap-2 flex items-center"
                    >
                      📎 {attachment.fileName}
                    </a>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteAttachment(attachment.id)}
                  disabled={isDeleting}
                  className="btn btn-ghost btn-sm btn-circle text-error hover:bg-error hover:text-error-content"
                  title="Delete file"
                >
                  {isDeleting ? (
                    <span className="loading loading-spinner loading-xs"></span>
                  ) : (
                    '🗑️'
                  )}
                </button>
              </div>
            </div>
          );
        })}

        {/* Resume Tags */}
        {post.resumeTags && post.resumeTags.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-base-content/60 mb-1">Tagged to resumes:</p>
            <div className="flex flex-wrap gap-2">
              {post.resumeTags.map((tag: any) => (
                <div key={tag.id} className="badge badge-outline">
                  {tag.resume.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="divider my-3"></div>

        {/* Reactions */}
        <PostReactions postId={post.id} reactions={post.reactions} onReactionUpdated={() => { }} />

        {/* Actions */}
        <div className="card-actions justify-between mt-3">
          <button
            className="btn btn-ghost btn-sm gap-1"
            onClick={() => setShowReplies(!showReplies)}
          >
            💭 {replyCount} Reflections
          </button>
          <div className="flex gap-1">
            <button className="btn btn-ghost btn-sm" onClick={() => setIsEditing(true)}>
              ✏️ Edit
            </button>
            <button
              className="btn btn-ghost btn-sm btn-error"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? '...' : '🗑️'}
            </button>
          </div>
        </div>

        {/* Replies Section */}
        {showReplies && (
          <PostReplies
            postId={post.id}
            onRepliesChanged={(newCount) => setReplyCount(newCount)}
          />
        )}
      </div>
    </div>
  );
}
