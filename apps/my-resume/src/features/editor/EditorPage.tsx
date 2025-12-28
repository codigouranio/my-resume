import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { apiClient } from '../../shared/api/client';
import './Editor.css';

export function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '# My Resume\n\n## Experience\n\n### Company Name\nRole Title (2020-Present)\n- Achievement 1\n- Achievement 2\n\n## Skills\n\n- Skill 1\n- Skill 2',
    llmContext: '',
    isPublic: false,
    isPublished: false,
    theme: 'default',
  });
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    if (!isNew) {
      fetchResume();
    }
  }, [id]);

  const fetchResume = async () => {
    try {
      const data = await apiClient.getResume(id!);
      setFormData({
        title: data.title,
        slug: data.slug,
        content: data.content,
        llmContext: data.llmContext || '',
        isPublic: data.isPublic,
        isPublished: data.isPublished,
        theme: data.theme || 'default',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load resume');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title || !formData.slug) {
      setError('Title and slug are required');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      if (isNew) {
        const newResume = await apiClient.createResume(formData);
        navigate(`/editor/${newResume.id}`, { replace: true });
      } else {
        await apiClient.updateResume(id!, formData);
      }
      alert('Resume saved successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to save resume');
    } finally {
      setIsSaving(false);
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleTitleChange = (value: string) => {
    setFormData({
      ...formData,
      title: value,
      slug: isNew ? generateSlug(value) : formData.slug,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="editor-container">
      {/* Header */}
      <div className="editor-header">
        <button className="btn btn-ghost gap-2" onClick={() => navigate('/dashboard')}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back to Dashboard
        </button>

        <div className="flex gap-2">
          <button
            className="btn btn-ghost gap-2"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? '📝 Edit Only' : '👁️ Show Preview'}
          </button>
          <button
            className={`btn btn-primary gap-2 ${isSaving ? 'loading' : ''}`}
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : '💾 Save'}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error mx-4">
          <span>{error}</span>
        </div>
      )}

      {/* Editor Content */}
      <div className="editor-content">
        {/* Sidebar Settings */}
        <div className="editor-sidebar">
          <h3 className="text-lg font-bold mb-4">Settings</h3>

          <div className="form-control w-full mb-4">
            <label className="label">
              <span className="label-text font-semibold">Title</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="My Professional Resume"
            />
          </div>

          <div className="form-control w-full mb-4">
            <label className="label">
              <span className="label-text font-semibold">URL Slug</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="my-resume"
            />
            <label className="label">
              <span className="label-text-alt">yoursite.com/resume/{formData.slug || 'slug'}</span>
            </label>
          </div>

          <div className="divider"></div>

          <div className="form-control mb-4">
            <label className="label cursor-pointer">
              <span className="label-text">Public</span>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={formData.isPublic}
                onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
              />
            </label>
            <p className="text-xs text-base-content/60 mt-1">Anyone can view your resume</p>
          </div>

          <div className="form-control mb-4">
            <label className="label cursor-pointer">
              <span className="label-text">Published</span>
              <input
                type="checkbox"
                className="toggle toggle-success"
                checked={formData.isPublished}
                onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
              />
            </label>
            <p className="text-xs text-base-content/60 mt-1">Make resume visible in search</p>
          </div>

          <div className="divider"></div>

          <div className="alert alert-info">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span className="text-xs">Use Markdown for formatting. HTML tags are supported.</span>
          </div>
        </div>

        {/* Editor and Preview */}
        <div className={`editor-main ${showPreview ? 'split-view' : 'full-view'}`}>
          {/* Markdown Editor */}
          <div className="editor-pane">
            <div className="tabs tabs-boxed mb-4">
              <a className="tab tab-active">Content</a>
              <a className="tab" onClick={() => document.getElementById('llm-context-tab')?.scrollIntoView()}>AI Context</a>
            </div>

            <textarea
              className="textarea textarea-bordered w-full h-full font-mono text-sm"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Write your resume in Markdown..."
            ></textarea>

            <div id="llm-context-tab" className="mt-4">
              <label className="label">
                <span className="label-text font-semibold">Hidden AI Context</span>
                <span className="badge badge-secondary">Private</span>
              </label>
              <textarea
                className="textarea textarea-bordered w-full font-mono text-sm"
                rows={8}
                value={formData.llmContext}
                onChange={(e) => setFormData({ ...formData, llmContext: e.target.value })}
                placeholder="Add detailed career info, metrics, accomplishments for AI chatbot (not shown publicly)..."
              ></textarea>
              <p className="text-xs text-base-content/60 mt-2">
                This content is only accessible to the AI chatbot for better responses
              </p>
            </div>
          </div>

          {/* Preview */}
          {showPreview && (
            <div className="preview-pane">
              <h3 className="text-lg font-bold mb-4">Preview</h3>
              <div className="preview-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                  {formData.content}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
