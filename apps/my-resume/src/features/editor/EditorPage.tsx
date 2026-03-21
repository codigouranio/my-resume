import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../shared/contexts/AuthContext';
import { apiClient } from '../../shared/api/client';
import { formatResumeDisplayPath } from '../../shared/utils/domain';
import { FileInsertModal } from './FileInsertModal';
import './Editor.css';

const MUSASHI_BADGE_MARKER = '/* resumecast:musashi-badge=enabled */';

function hasMusashiBadgeMarker(customCss?: string): boolean {
  return Boolean(customCss && customCss.includes(MUSASHI_BADGE_MARKER));
}

function setMusashiBadgeMarker(customCss: string | undefined, enabled: boolean): string {
  const current = (customCss || '').replace(MUSASHI_BADGE_MARKER, '').trim();
  if (!enabled) {
    return current;
  }
  return current ? `${current}\n\n${MUSASHI_BADGE_MARKER}` : MUSASHI_BADGE_MARKER;
}

export function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const isNew = id === 'new';
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: t('editor.default_content'),
    llmContext: '',
    isPublic: false,
    isPublished: false,
    theme: 'default',
    customCss: '',
  });
  const [showMusashiBadge, setShowMusashiBadge] = useState(false);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [slugError, setSlugError] = useState('');
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [activeTab, setActiveTab] = useState<'content' | 'ai-context'>('content');
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [isImprovingText, setIsImprovingText] = useState(false);
  const [showImproveButton, setShowImproveButton] = useState(false);
  const [improveButtonPosition, setImproveButtonPosition] = useState({ top: 0, left: 0 });
  const [improvedText, setImprovedText] = useState('');
  const [showImproveModal, setShowImproveModal] = useState(false);
  const [originalSelectedText, setOriginalSelectedText] = useState('');
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [showFileInsertModal, setShowFileInsertModal] = useState(false);

  useEffect(() => {
    if (!isNew) {
      fetchResume();
    }
  }, [id]);

  useEffect(() => {
    if (!formData.slug) return;

    const timeoutId = setTimeout(() => {
      checkSlugAvailability(formData.slug);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData.slug]);

  // Auto-save effect - triggers 2 seconds after changes stop
  useEffect(() => {
    // Don't auto-save for new resumes (need initial manual save first)
    if (isNew) return;
    // Don't auto-save if there are validation errors
    if (!formData.title || !formData.slug || slugError) return;
    // Don't auto-save if already saving
    if (isSaving || isAutoSaving) return;
    // Don't auto-save on initial load
    if (!hasUnsavedChanges) return;

    const autoSaveTimeout = setTimeout(() => {
      autoSave();
    }, 2000); // Auto-save 2 seconds after last change

    return () => clearTimeout(autoSaveTimeout);
  }, [formData, isNew, slugError, hasUnsavedChanges]);

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
        customCss: data.customCss || '',
      });
      setShowMusashiBadge(hasMusashiBadgeMarker(data.customCss || ''));
    } catch (err: any) {
      setError(err.message || t('editor.errors.load_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const autoSave = async () => {
    if (!formData.title || !formData.slug || isNew) return;

    setIsAutoSaving(true);
    setError('');

    try {
      await apiClient.updateResume(id!, {
        ...formData,
        customCss: setMusashiBadgeMarker(formData.customCss, showMusashiBadge),
      });
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
    } catch (err: any) {
      // Silently fail auto-save, don't alert user
      console.error('Auto-save failed:', err);
    } finally {
      setIsAutoSaving(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title || !formData.slug) {
      setError(t('editor.errors.title_slug_required'));
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const payload = {
        ...formData,
        customCss: setMusashiBadgeMarker(formData.customCss, showMusashiBadge),
      };

      if (isNew) {
        const newResume = await apiClient.createResume(payload);
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
        navigate(`/editor/${newResume.id}`, { replace: true });
      } else {
        await apiClient.updateResume(id!, payload);
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
      }
      alert(t('editor.success.saved'));
    } catch (err: any) {
      // Show more helpful error message for slug conflicts
      if (err.message?.includes('Slug already exists') || err.message?.includes('slug')) {
        setError(t('editor.errors.slug_taken', { slug: formData.slug }));
      } else {
        setError(err.message || t('editor.errors.save_failed'));
      }
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

  const checkSlugAvailability = async (slug: string) => {
    if (!slug) {
      setSlugError('');
      return;
    }

    // If editing existing resume and slug hasn't changed, don't check
    if (!isNew && id) {
      const currentResume = await apiClient.getResume(id);
      if (currentResume.slug === slug) {
        setSlugError('');
        return;
      }
    }

    setIsCheckingSlug(true);
    try {
      // Try to fetch a resume with this slug
      await apiClient.checkSlugAvailability(slug);
      // If we get here, the slug exists
      setSlugError(t('editor.errors.slug_unavailable'));
    } catch (err: any) {
      // 404 means slug is available
      if (err.message?.includes('404') || err.message?.includes('not found') || err.message?.includes('Resume not found')) {
        setSlugError('');
      } else {
        // Other errors, just clear the slug error
        setSlugError('');
      }
    } finally {
      setIsCheckingSlug(false);
    }
  };

  const handleSlugChange = (value: string) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setFormData({ ...formData, slug: sanitized });
    setHasUnsavedChanges(true);
  };

  const handleTitleChange = (value: string) => {
    setFormData({
      ...formData,
      title: value,
      slug: isNew ? generateSlug(value) : formData.slug,
    });
    setHasUnsavedChanges(true);
  };

  const handleContentChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
    setHasUnsavedChanges(true);
  };

  const handleTextSelection = () => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end).trim();

    console.log('Text selection:', { length: selected.length, text: selected.substring(0, 50) });

    if (selected && selected.length > 10 && selected.length < 500) {
      console.log('Showing improve button');
      setSelectedText(selected);
      setShowImproveButton(true);

      // Calculate button position
      const rect = textarea.getBoundingClientRect();
      const textBeforeSelection = textarea.value.substring(0, start);
      const lines = textBeforeSelection.split('\n').length;
      const lineHeight = 24; // approximate line height

      setImproveButtonPosition({
        top: rect.top + (lines * lineHeight) - textarea.scrollTop,
        left: rect.right + 10
      });
    } else {
      console.log('Hiding improve button - length:', selected.length);
      setSelectedText('');
      setShowImproveButton(false);
    }
  };

  const improveSelectedText = async () => {
    if (!selectedText || !textareaRef.current) return;

    // Store the current selection positions before making the API call
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    setSelectionStart(start);
    setSelectionEnd(end);

    setIsImprovingText(true);
    try {
      const result = await apiClient.improveText(selectedText, 'resume');

      // Store the improved text and show modal for review
      setImprovedText(result.improved);
      setOriginalSelectedText(selectedText);
      setShowImproveModal(true);
      setShowImproveButton(false);
    } catch (err: any) {
      setError(err.message || t('editor.errors.improve_failed'));
    } finally {
      setIsImprovingText(false);
    }
  };

  const acceptImprovedText = () => {
    if (!textareaRef.current) return;

    // Replace selected text with improved version using stored positions
    const before = formData.content.substring(0, selectionStart);
    const after = formData.content.substring(selectionEnd);

    const newContent = before + improvedText + after;
    setFormData({ ...formData, content: newContent });
    setHasUnsavedChanges(true);

    // Reset state
    setShowImproveModal(false);
    setImprovedText('');
    setOriginalSelectedText('');
    setSelectedText('');
    setSelectionStart(0);
    setSelectionEnd(0);

    // Show success message briefly
    const originalError = error;
    setError(t('editor.success.text_improved'));
    setTimeout(() => setError(originalError), 3000);
  };

  const handleInsertFile = (embedCode: string) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;

    // Insert embed code at cursor position (or replace selection)
    const before = formData.content.substring(0, start);
    const after = formData.content.substring(end);

    // Add newlines around embed code for better formatting
    const newContent = before + '\n\n' + embedCode + '\n\n' + after;

    setFormData({ ...formData, content: newContent });
    setHasUnsavedChanges(true);
    setShowFileInsertModal(false);

    // Focus textarea and move cursor after inserted content
    setTimeout(() => {
      if (textareaRef.current) {
        const newPosition = start + embedCode.length + 4; // +4 for the newlines
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPosition, newPosition);
      }
    }, 100);
  };

  const cancelImprovedText = () => {
    setShowImproveModal(false);
    setImprovedText('');
    setOriginalSelectedText('');
  };

  const formatLastSaved = (date: Date) => {
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 10) return t('editor.time.just_now');
    if (seconds < 60) return t('editor.time.seconds_ago', { seconds });

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return t('editor.time.minutes_ago', { minutes });

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('editor.time.hours_ago', { hours });

    return date.toLocaleTimeString();
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
          {t('editor.nav.back_to_dashboard')}
        </button>

        <div className="flex items-center gap-2">
          {/* Auto-save status indicator */}
          {!isNew && (
            <div className="text-sm text-gray-500 mr-2">
              {isAutoSaving && (
                <span className="flex items-center gap-1">
                  <span className="loading loading-spinner loading-xs"></span>
                  {t('editor.status.auto_saving')}
                </span>
              )}
              {!isAutoSaving && lastSaved && (
                <span className="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-success" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {t('editor.status.saved')} {formatLastSaved(lastSaved)}
                </span>
              )}
              {!isAutoSaving && !lastSaved && hasUnsavedChanges && (
                <span className="text-warning">{t('editor.status.unsaved_changes')}</span>
              )}
            </div>
          )}
          <button
            className="btn btn-ghost gap-2"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? `${t('editor.view.edit_only')}` : `👁️ ${t('editor.view.show_preview')}`}
          </button>
          <button
            className={`btn btn-primary gap-2 ${isSaving ? 'loading' : ''}`}
            onClick={handleSave}
            disabled={isSaving || !!slugError || isCheckingSlug}
          >
            {isSaving ? t('editor.status.saving') : `${t('editor.actions.save')}`}
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
          <h3 className="text-lg font-bold mb-4">{t('editor.sections.settings')}</h3>

          <div className="form-control w-full mb-4">
            <label className="label">
              <span className="label-text font-semibold">{t('editor.fields.title')}</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder={t('editor.placeholders.title')}
            />
          </div>

          <div className="form-control w-full mb-4">
            <label className="label">
              <span className="label-text font-semibold">{t('editor.fields.url_slug')}</span>
              {isCheckingSlug && (
                <span className="label-text-alt">
                  <span className="loading loading-spinner loading-xs"></span> {t('editor.status.checking')}
                </span>
              )}
              {!isCheckingSlug && slugError && (
                <span className="label-text-alt text-error">❌ {slugError}</span>
              )}
              {!isCheckingSlug && !slugError && formData.slug && (
                <span className="label-text-alt text-success"> {t('editor.status.slug_available')}</span>
              )}
            </label>
            <input
              type="text"
              className={`input input-bordered w-full ${slugError ? 'input-error' : ''}`}
              value={formData.slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder={t('editor.placeholders.slug')}
            />
            <label className="label">
              <span className="label-text-alt">
                {formatResumeDisplayPath(formData.slug || 'slug', user?.customDomain)}
              </span>
            </label>
          </div>

          <div className="divider"></div>

          <div className="form-control mb-4">
            <label className="label cursor-pointer">
              <span className="label-text">{t('editor.fields.public')}</span>
              <input
                type="checkbox"
                className="toggle"
                checked={formData.isPublic}
                onChange={(e) => handleContentChange('isPublic', e.target.checked)}
              />
            </label>
            <p className="text-xs text-base-content/60 mt-1">{t('editor.help.public')}</p>
          </div>

          <div className="form-control mb-4">
            <label className="label cursor-pointer">
              <span className="label-text">{t('editor.fields.published')}</span>
              <input
                type="checkbox"
                className="toggle toggle-success"
                checked={formData.isPublished}
                onChange={(e) => handleContentChange('isPublished', e.target.checked)}
              />
            </label>
            <p className="text-xs text-base-content/60 mt-1">{t('editor.help.published')}</p>
          </div>

          <div className="divider"></div>

          <div className="form-control w-full mb-4">
            <label className="label">
              <span className="label-text font-semibold">{t('editor.fields.template')}</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.theme}
              onChange={(e) => handleContentChange('theme', e.target.value)}
            >
              <option value="default">{t('editor.templates.classic')}</option>
              <option value="modern">{t('editor.templates.modern')}</option>
              <option value="minimal">{t('editor.templates.minimal')}</option>
              <option value="professional">{t('editor.templates.professional')}</option>
              <option value="corporate">{t('editor.templates.corporate')}</option>
              <option value="tech">{t('editor.templates.tech')}</option>
            </select>
          </div>

          <div className="divider"></div>

          <div className="form-control mb-4">
            <label className="label cursor-pointer">
              <span className="label-text">Show Musashi Index Badge</span>
              <input
                type="checkbox"
                className="toggle toggle-info"
                checked={showMusashiBadge}
                onChange={(e) => {
                  setShowMusashiBadge(e.target.checked);
                  setHasUnsavedChanges(true);
                }}
              />
            </label>
            <p className="text-xs text-base-content/60 mt-1">
              When enabled, your public resume shows a live Musashi IM badge computed from resume + AI context.
            </p>
          </div>

          <div className="divider"></div>

          <div className="alert alert-info">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span className="text-xs">{t('editor.info.markdown_support')}</span>
          </div>
        </div>

        {/* Editor and Preview */}
        <div className={`editor-main ${showPreview ? 'split-view' : 'full-view'}`}>
          {/* Markdown Editor */}
          <div className="editor-pane">
            <div className="flex justify-between items-center mb-4">
              <div className="tabs tabs-boxed">
                <a
                  className={`tab ${activeTab === 'content' ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab('content')}
                >
                  {t('editor.tabs.content')}
                </a>
                <a
                  className={`tab ${activeTab === 'ai-context' ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab('ai-context')}
                >
                  {t('editor.tabs.ai_context')}
                  <span className="badge badge-secondary badge-sm ml-2">{t('editor.labels.private')}</span>
                </a>
              </div>

              {activeTab === 'content' && (
                <button
                  className="btn btn-outline btn-sm gap-2"
                  onClick={() => setShowFileInsertModal(true)}
                  title={t('editor.tooltips.insert_file')}
                >
                  {t('editor.actions.insert_file')}
                </button>
              )}
            </div>

            {activeTab === 'content' ? (
              <div className="relative h-full">
                <textarea
                  ref={textareaRef}
                  className="textarea textarea-bordered w-full h-full font-mono text-sm"
                  value={formData.content}
                  onChange={(e) => handleContentChange('content', e.target.value)}
                  onMouseUp={handleTextSelection}
                  onKeyUp={handleTextSelection}
                  placeholder={t('editor.placeholders.content')}
                ></textarea>

                {/* AI Improve Button - Fixed position at bottom right */}
                {showImproveButton && selectedText && (
                  <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="card bg-base-100 shadow-2xl border border-primary/20">
                      <div className="card-body p-4 gap-3">
                        <p className="text-sm flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                          {t('editor.labels.characters_selected', { count: selectedText.length })}
                        </p>
                        <div className="flex gap-2">
                          <button
                            className={`btn btn-primary btn-sm gap-2 ${isImprovingText ? 'loading' : ''}`}
                            onClick={improveSelectedText}
                            disabled={isImprovingText}
                          >
                            {isImprovingText ? (
                              <>
                                <span className="loading loading-spinner loading-xs"></span>
                                {t('editor.ai.improving')}
                              </>
                            ) : (
                              <>
                                ✨ {t('editor.ai.improve_button')}
                              </>
                            )}
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              setShowImproveButton(false);
                              setSelectedText('');
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="alert alert-info mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span className="text-xs">{t('editor.info.ai_context_help')}</span>
                </div>
                <textarea
                  className="textarea textarea-bordered flex-1 font-mono text-sm"
                  value={formData.llmContext}
                  onChange={(e) => handleContentChange('llmContext', e.target.value)}
                  placeholder={t('editor.placeholders.ai_context')}
                ></textarea>
              </div>
            )}
          </div>

          {/* Preview */}
          {showPreview && (
            <div className="preview-pane">
              <h3 className="text-lg font-bold mb-4">{t('editor.sections.preview')}</h3>
              <div className="preview-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                  {formData.content}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Improvement Modal */}
      {showImproveModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-xl mb-4">{t('editor.ai.modal_title')}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Original Text */}
              <div>
                <h4 className="font-semibold mb-2 text-sm text-base-content/70">{t('editor.ai.original_label')}</h4>
                <div className="p-4 bg-base-200 rounded-lg border border-base-300">
                  <p className="whitespace-pre-wrap">{originalSelectedText}</p>
                </div>
              </div>

              {/* Improved Text - Editable */}
              <div>
                <h4 className="font-semibold mb-2 text-sm text-primary">{t('editor.ai.improved_label')}</h4>
                <textarea
                  className="textarea textarea-bordered w-full h-32 font-mono text-sm"
                  value={improvedText}
                  onChange={(e) => setImprovedText(e.target.value)}
                  placeholder={t('editor.ai.improved_placeholder')}
                />
              </div>
            </div>

            <div className="alert alert-info mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span className="text-sm">{t('editor.ai.modal_info')}</span>
            </div>

            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={cancelImprovedText}
              >
                {t('editor.actions.cancel')}
              </button>
              <button
                className="btn btn-primary gap-2"
                onClick={acceptImprovedText}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {t('editor.actions.accept_replace')}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={cancelImprovedText}></div>
        </div>
      )}

      {/* File Insert Modal */}
      <FileInsertModal
        isOpen={showFileInsertModal}
        onClose={() => setShowFileInsertModal(false)}
        onInsert={handleInsertFile}
      />
    </div>
  );
}
