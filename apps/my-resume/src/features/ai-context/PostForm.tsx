import { useState } from 'react';
import { apiClient } from '../../shared/api/client';

interface PostFormProps {
  onPostCreated: (post: any) => void;
  onCancel: () => void;
  initialPost?: any;
  postId?: string;
}

interface AttachmentItem {
  id?: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  fileSizeBytes?: number;
}

export function PostForm({ onPostCreated, onCancel, initialPost, postId }: PostFormProps) {
  const [text, setText] = useState(initialPost?.text || '');
  const [publishedAt, setPublishedAt] = useState(
    initialPost?.publishedAt ? new Date(initialPost.publishedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [includeInAI, setIncludeInAI] = useState(initialPost?.includeInAI ?? true);
  const [isPublic, setIsPublic] = useState(initialPost?.isPublic ?? false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [attachments, setAttachments] = useState<AttachmentItem[]>(initialPost?.attachments || []);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const publishedAtISO = new Date(publishedAt).toISOString();

      let response;
      if (postId) {
        response = await apiClient.updateAIContextPost(postId, text, publishedAtISO, includeInAI, isPublic);
      } else {
        response = await apiClient.createAIContextPost(text, publishedAtISO, includeInAI, isPublic);
      }

      // Add attachments to the post after creation
      if (!postId && attachments.length > 0) {
        for (const attachment of attachments) {
          await apiClient.addAIContextAttachment(
            response.id,
            attachment.fileUrl,
            attachment.fileName,
            attachment.fileType,
            attachment.fileSizeBytes
          );
        }
        // Refresh post to get attachments
        response = await apiClient.getAIContextPost(response.id);
      }

      onPostCreated(response);
      setText('');
      setPublishedAt(new Date().toISOString().split('T')[0]);
      setIncludeInAI(true);
      setIsPublic(false);
      setAttachments([]);
    } catch (err: any) {
      setError(err.message || 'Failed to save post');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress('');
    setError('');

    try {
      const file = files[0];

      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size must be less than 10MB');
      }

      setUploadProgress(`Uploading ${file.name}...`);

      // Upload file to document storage
      const uploadResult = await apiClient.uploadDocument(file);

      // Add to attachments list
      const newAttachment: AttachmentItem = {
        fileName: file.name,
        fileType: file.type,
        fileUrl: uploadResult.viewUrl,
        fileSizeBytes: file.size,
      };

      setAttachments([...attachments, newAttachment]);
      setUploadProgress('');

      // If editing existing post, immediately add attachment
      if (postId) {
        await apiClient.addAIContextAttachment(
          postId,
          newAttachment.fileUrl,
          newAttachment.fileName,
          newAttachment.fileType,
          newAttachment.fileSizeBytes
        );
        const updatedPost = await apiClient.getAIContextPost(postId);
        onPostCreated(updatedPost);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleRemoveAttachment = async (index: number, attachmentId?: string) => {
    if (attachmentId && postId) {
      // Remove from backend if editing existing post
      try {
        await apiClient.removeAIContextAttachment(postId, attachmentId);
        const updatedPost = await apiClient.getAIContextPost(postId);
        onPostCreated(updatedPost);
      } catch (err: any) {
        setError(err.message || 'Failed to remove attachment');
        return;
      }
    }

    // Remove from local state
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const wordCount = text.split(/\s+/).filter((word: string) => word.length > 0).length;
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
          <label className="label cursor-pointer" htmlFor="includeInAI">
            <span className="label-text">🤖 Include in AI Context</span>
            <input
              id="includeInAI"
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

        {/* Public Toggle */}
        <div className="form-control">
          <label className="label cursor-pointer" htmlFor="isPublic">
            <span className="label-text">🌐 Make Public</span>
            <input
              id="isPublic"
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="checkbox checkbox-secondary"
            />
          </label>
          <p className="text-xs text-base-content/60 ml-0">
            When enabled, this post will be visible on your public journal page that anyone can view.
          </p>
        </div>

        {/* File Attachments */}
        <div className="form-control">
          <label className="label">
            <span className="label-text">📎 Attachments</span>
            <span className="label-text-alt text-xs">Max 10MB per file</span>
          </label>

          {/* File Upload Button */}
          <div className="flex gap-2 items-center">
            <label className="btn btn-outline btn-sm cursor-pointer">
              📁 Add File
              <input
                type="file"
                className="hidden"
                onChange={handleFileSelect}
                disabled={isUploading || isLoading}
                accept="image/*,.pdf,.doc,.docx,.txt,.md"
              />
            </label>
            {isUploading && (
              <span className="text-xs text-base-content/60 flex items-center gap-2">
                <span className="loading loading-spinner loading-xs"></span>
                {uploadProgress}
              </span>
            )}
          </div>

          {/* Attachment List */}
          {attachments.length > 0 && (
            <div className="mt-3 space-y-2">
              {attachments.map((attachment, index) => {
                const isImage = attachment.fileType.startsWith('image/');
                const sizeKB = attachment.fileSizeBytes ? Math.round(attachment.fileSizeBytes / 1024) : 0;

                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-base-200 rounded gap-2"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isImage ? '🖼️' : '📄'}
                      <span className="text-sm truncate">{attachment.fileName}</span>
                      {sizeKB > 0 && (
                        <span className="text-xs text-base-content/60">({sizeKB}KB)</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(index, attachment.id)}
                      className="btn btn-ghost btn-xs"
                      disabled={isLoading || isUploading}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
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
