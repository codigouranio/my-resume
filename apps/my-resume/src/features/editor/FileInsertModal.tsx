import { useState, useEffect } from 'react';
import { apiClient } from '../../shared/api/client';

interface UploadedDocument {
  id: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  fileSizeBytes?: number;
  createdAt: string;
  postId?: string;
}

interface FileInsertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (embedCode: string) => void;
}

export function FileInsertModal({ isOpen, onClose, onInsert }: FileInsertModalProps) {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchDocuments();
    }
  }, [isOpen]);

  const fetchDocuments = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Fetch all AI context posts with attachments
      const response = await apiClient.getAIContextPosts();
      console.log('[FileInsertModal] API response:', response);

      // Extract all attachments from posts
      const allAttachments: UploadedDocument[] = [];

      // API returns array directly, not wrapped in { posts: [] }
      const posts = Array.isArray(response) ? response : response.posts || [];
      console.log('[FileInsertModal] Found posts:', posts.length);

      posts.forEach((post: any) => {
        if (post.attachments && post.attachments.length > 0) {
          console.log(`[FileInsertModal] Post ${post.id} has ${post.attachments.length} attachments`);
          post.attachments.forEach((attachment: any) => {
            allAttachments.push({
              id: attachment.id,
              fileName: attachment.fileName,
              fileType: attachment.fileType,
              fileUrl: attachment.fileUrl,
              fileSizeBytes: attachment.fileSizeBytes,
              createdAt: attachment.createdAt,
              postId: post.id,
            });
          });
        }
      });

      console.log('[FileInsertModal] Total attachments found:', allAttachments.length);
      setDocuments(allAttachments);
    } catch (err: any) {
      console.error('[FileInsertModal] Error:', err);
      setError(err.message || 'Failed to load documents');
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

      // Insert the embed code directly
      onInsert(uploadResult.embedCode);

      // Refresh document list
      await fetchDocuments();

      setUploadProgress('');
    } catch (err: any) {
      setError(err.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleInsertDocument = (doc: UploadedDocument) => {
    const fileExt = doc.fileName.split('.').pop()?.toLowerCase();
    let embedCode = '';

    // Generate embed code based on file type
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(fileExt || '')) {
      embedCode = `![${doc.fileName}](${doc.fileUrl})`;
    } else if (['pdf'].includes(fileExt || '')) {
      embedCode = `[📄 ${doc.fileName}](${doc.fileUrl})`;
    } else if (['doc', 'docx', 'txt', 'md'].includes(fileExt || '')) {
      embedCode = `[📝 ${doc.fileName}](${doc.fileUrl})`;
    } else {
      embedCode = `[📎 ${doc.fileName}](${doc.fileUrl})`;
    }

    onInsert(embedCode);
  };

  const filteredDocuments = documents.filter((doc) =>
    doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-3xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">📎 Insert File</h3>
          <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        {error && (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        )}

        {/* Upload New File */}
        <div className="card bg-base-200 mb-4">
          <div className="card-body p-4">
            <div className="flex items-center gap-4">
              <label className="btn btn-primary btn-sm cursor-pointer">
                📁 Upload New File
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                  accept="image/*,.pdf,.doc,.docx,.txt,.md"
                />
              </label>
              {isUploading && (
                <span className="text-sm flex items-center gap-2">
                  <span className="loading loading-spinner loading-xs"></span>
                  {uploadProgress}
                </span>
              )}
              {!isUploading && (
                <span className="text-xs text-base-content/60">
                  Max 10MB • Images, PDFs, Documents
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="form-control mb-4">
          <input
            type="text"
            placeholder="🔍 Search files..."
            className="input input-bordered"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Document List */}
        <div className="divider">Your Uploaded Files</div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center py-8 text-base-content/60">
            {searchQuery ? (
              <>
                <p>No files found matching "{searchQuery}"</p>
                <button
                  className="btn btn-sm btn-ghost mt-2"
                  onClick={() => setSearchQuery('')}
                >
                  Clear search
                </button>
              </>
            ) : (
              <>
                <svg className="mx-auto h-12 w-12 text-base-content/20 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <p>No files uploaded yet</p>
                <p className="text-sm mt-1">Upload files through Journal AI Context or use the button above</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto">
            {filteredDocuments.map((doc) => {
              const isImage = doc.fileType.startsWith('image/');
              const sizeKB = doc.fileSizeBytes ? Math.round(doc.fileSizeBytes / 1024) : 0;
              const date = new Date(doc.createdAt).toLocaleDateString();

              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 bg-base-200 rounded hover:bg-base-300 transition-colors cursor-pointer"
                  onClick={() => handleInsertDocument(doc)}
                >
                  {/* File Icon/Preview */}
                  <div className="flex-shrink-0">
                    {isImage ? (
                      <img
                        src={doc.fileUrl}
                        alt={doc.fileName}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className="text-2xl">
                        {doc.fileType === 'application/pdf' ? '📄' :
                          ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown'].includes(doc.fileType) ? '📝' : '📎'}
                      </div>
                    )}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{doc.fileName}</p>
                    <p className="text-xs text-base-content/60">
                      {sizeKB > 0 && `${sizeKB}KB • `}
                      {date}
                    </p>
                  </div>

                  {/* Insert Button */}
                  <button className="btn btn-primary btn-sm">
                    Insert
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
}
