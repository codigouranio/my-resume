import { useState } from 'react';
import { apiClient } from '../../shared/api/client';

interface PostFormProps {
  onPostCreated: (post: any) => void;
  onCancel: () => void;
  initialPost?: any;
  postId?: string;
}

export function PostForm({ onPostCreated, onCancel, initialPost, postId }: PostFormProps) {
  const [text, setText] = useState(initialPost?.text || '');
  const [publishedAt, setPublishedAt] = useState(
    initialPost?.publishedAt ? new Date(initialPost.publishedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [includeInAI, setIncludeInAI] = useState(initialPost?.includeInAI ?? true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const publishedAtISO = new Date(publishedAt).toISOString();

      let response;
      if (postId) {
        response = await apiClient.updateAIContextPost(postId, text, publishedAtISO, includeInAI);
      } else {
        response = await apiClient.createAIContextPost(text, publishedAtISO, includeInAI);
      }

      onPostCreated(response);
      setText('');
      setPublishedAt(new Date().toISOString().split('T')[0]);
      setIncludeInAI(true);
    } catch (err: any) {
      setError(err.message || 'Failed to save post');
    } finally {
      setIsLoading(false);
    }
  };

  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  const isOverLimit = wordCount > 500;

  return (
    <form onSubmit={handleSubmit} className="card bg-base-100 shadow mb-6">
      <div className="card-body">
        <h3 className="card-title">
          {postId ? '✏️ Edit Entry' : '✍️ New Journal Entry'}
        </h3>

        {error && <div className="alert alert-error text-sm">{error}</div>}

        {/* Text Area */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What would you like to remember? Share achievements, lessons learned, memories, or reflections..."
          maxLength={2500}
          className="textarea textarea-bordered h-32"
          required
        />

        <div className="flex justify-between items-center text-xs text-base-content/60">
          <span>{wordCount} / 500 words {isOverLimit && '(exceeds limit)'}</span>
          <span>{text.length} / 2500 characters</span>
        </div>

        {/* Date Picker */}
        <div>
          <label className="label">
            <span className="label-text">📅 Date (backdate if needed)</span>
          </label>
          <input
            type="date"
            value={publishedAt}
            onChange={(e) => setPublishedAt(e.target.value)}
            className="input input-bordered w-full"
          />
        </div>

        {/* AI Context Toggle */}
        <div className="form-control">
          <label className="label cursor-pointer">
            <span className="label-text">🤖 Include in AI Context</span>
            <input
              type="checkbox"
              checked={includeInAI}
              onChange={(e) => setIncludeInAI(e.target.checked)}
              className="checkbox checkbox-primary"
            />
          </label>
          <p className="text-xs text-base-content/60 ml-0">
            When enabled, this post becomes available for the AI to use when generating or improving resumes, cover letters, and providing career coaching.
          </p>
        </div>

        {/* Actions */}
        <div className="card-actions justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-ghost"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading || text.trim().length === 0 || isOverLimit}
          >
            {isLoading ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Saving...
              </>
            ) : (
              postId ? 'Update Entry' : 'Save Entry'
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
