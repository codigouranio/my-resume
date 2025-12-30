import { useEffect, useState, isValidElement } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { apiClient } from '../../shared/api/client';
import { ChatWidget } from '../chat';
import { GitHubStats, CourseraCertificate } from '../badges';
import './Resume.css';

export default function Resume() {
  const { slug } = useParams<{ slug?: string }>();
  const [markdown, setMarkdown] = useState<string>('');
  const [resumeData, setResumeData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [showContactModal, setShowContactModal] = useState<boolean>(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    company: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [expandedVideo, setExpandedVideo] = useState<string | null>(null);
  const [viewCount, setViewCount] = useState<number | null>(null);

  useEffect(() => {
    if (slug) {
      // Load public resume by slug from API
      fetchPublicResume(slug);
    } else {
      // Fallback to local resume.md (for backward compatibility)
      fetchLocalResume();
    }
  }, [slug]);

  const fetchPublicResume = async (slug: string) => {
    try {
      const data = await apiClient.getPublicResume(slug);
      setResumeData(data);
      setMarkdown(data.content);
      
      // Fetch view count
      try {
        const stats = await apiClient.getPublicResumeStats(slug);
        setViewCount(stats.viewCount);
      } catch (err) {
        console.error('Failed to fetch view count:', err);
      }
    } catch (err: any) {
      setError(err.message || 'Resume not found');
      setMarkdown('');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLocalResume = () => {
    fetch('/resume.md')
      .then((response) => response.text())
      .then((text) => {
        setMarkdown(text);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Error loading resume:', error);
        setError('Error loading resume. Please try again later.');
        setIsLoading(false);
      });
  };

  const handleInterestClick = () => {
    setShowContactModal(true);
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await apiClient.submitRecruiterInterest({
        resumeSlug: slug || '',
        name: contactForm.name,
        email: contactForm.email,
        company: contactForm.company,
        message: contactForm.message,
      });

      setSubmitSuccess(true);
      setTimeout(() => {
        setShowContactModal(false);
        setSubmitSuccess(false);
        setContactForm({ name: '', email: '', company: '', message: '' });
      }, 2000);
    } catch (error: any) {
      console.error('Error submitting interest:', error);
      alert(error.message || 'Failed to submit your interest. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    // Handle video thumbnail clicks
    const handleVideoClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const videoContainer = target.closest('.video-container');

      if (videoContainer && !videoContainer.classList.contains('expanded')) {
        e.preventDefault();
        const iframe = videoContainer.querySelector('iframe');
        if (iframe) {
          setExpandedVideo(iframe.src);
        }
      }
    };

    document.addEventListener('click', handleVideoClick);
    return () => document.removeEventListener('click', handleVideoClick);
  }, []);

  if (isLoading) {
    return (
      <div className="resume-container">
        <div className="space-y-6">
          {/* Header skeleton */}
          <div className="space-y-4">
            <div className="skeleton h-12 w-3/4"></div>
            <div className="skeleton h-4 w-1/2"></div>
          </div>

          {/* Section skeleton */}
          <div className="space-y-3">
            <div className="skeleton h-8 w-1/3"></div>
            <div className="skeleton h-4 w-full"></div>
            <div className="skeleton h-4 w-full"></div>
            <div className="skeleton h-4 w-5/6"></div>
          </div>

          {/* Another section skeleton */}
          <div className="space-y-3">
            <div className="skeleton h-8 w-1/3"></div>
            <div className="skeleton h-4 w-full"></div>
            <div className="skeleton h-4 w-full"></div>
            <div className="skeleton h-4 w-4/5"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="alert alert-error max-w-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="resume-container">
      {/* Recruiter Interest Button */}
      <div className="sticky top-4 z-10 mb-8">
        <div className="flex justify-end">
          <button
            onClick={handleInterestClick}
            className="btn btn-primary btn-lg shadow-lg hover:shadow-xl transition-all gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            I'm Interested - Let's Talk!
          </button>
        </div>
      </div>

      <article className="prose prose-lg max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            pre: ({ node, children, ...props }: any) => {
              // Check if the child is a coursera code block
              if (isValidElement(children)) {
                const childProps = children.props as any;
                if (childProps?.className?.includes('language-coursera')) {
                  // Return just the child without the pre wrapper
                  return <>{children}</>;
                }
              }
              // For all other code blocks, keep the pre tag
              return <pre {...props}>{children}</pre>;
            },
            code: ({ node, inline, className, children, ...props }: any) => {
              const match = /language-(\w+)/.exec(className || '');
              const language = match ? match[1] : '';

              if (!inline && language === 'video') {
                const content = String(children).trim();
                const urls = content.split('\n').filter(url => url.trim());

                return (
                  <>
                    {urls.map((url, index) => {
                      const videoId = url.match(/(?:embed\/|v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1];

                      if (videoId) {
                        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
                        const embedUrl = `https://www.youtube.com/embed/${videoId}`;

                        return (
                          <div
                            key={index}
                            className="video-thumbnail-wrapper"
                            onClick={() => setExpandedVideo(embedUrl)}
                          >
                            <img
                              src={thumbnailUrl}
                              alt="Video thumbnail"
                              className="video-thumbnail-image"
                            />
                            <div className="video-play-button">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </>
                );
              }

              // Handle Coursera certificate code block
              if (!inline && language === 'coursera') {
                const content = String(children).trim();
                const lines = content.split('\n');
                const certData: Record<string, string> = {};

                // Parse key-value pairs
                lines.forEach(line => {
                  const colonIndex = line.indexOf(':');
                  if (colonIndex > -1) {
                    const key = line.substring(0, colonIndex).trim();
                    const value = line.substring(colonIndex + 1).trim();
                    certData[key] = value;
                  }
                });

                if (certData['name']) {
                  return (
                    <CourseraCertificate
                      title={certData['name']}
                      organization={certData['issuing organization']}
                      date={certData['issue date']}
                      credentialId={certData['credential id']}
                      credentialUrl={certData['credential url']}
                    />
                  );
                }
              }

              return inline ? (
                <code className={className} {...props}>{children}</code>
              ) : (
                <code className={className} {...props}>{children}</code>
              );
            },
            iframe: ({ node, ...props }: any) => (
              <div className="video-container">
                <iframe {...props} />
              </div>
            ),
            img: ({ node, src, alt, ...props }: any) => {
              // Handle GitHub Stats component
              if (src?.startsWith('github?') || src?.includes('username=')) {
                try {
                  const urlParams = new URLSearchParams(src.replace('github?', ''));
                  const username = urlParams.get('username');
                  const theme = urlParams.get('theme') || 'dark';

                  if (username) {
                    return <GitHubStats username={username} theme={theme as 'light' | 'dark'} />;
                  }
                } catch (error) {
                  console.error('Error parsing GitHub stats URL:', error);
                }
              }

              // Handle Coursera Certificate component
              if (src?.startsWith('coursera?') || src?.includes('accomplishments=')) {
                try {
                  const urlParams = new URLSearchParams(src.replace('coursera?', ''));
                  const certId = urlParams.get('accomplishments');
                  const title = urlParams.get('title') || 'Certificate';
                  const date = urlParams.get('date');

                  if (certId) {
                    return <CourseraCertificate certId={certId} title={title} date={date || undefined} />;
                  }
                } catch (error) {
                  console.error('Error parsing Coursera certificate URL:', error);
                }
              }

              // Handle badge images from our API
              if (src?.startsWith('/badges/')) {
                return (
                  <img
                    src={src}
                    alt={alt}
                    {...props}
                    className="inline-block max-w-full h-auto"
                  />
                );
              }

              // Default image rendering
              return <img src={src} alt={alt} {...props} />;
            },
          }}
        >
          {markdown}
        </ReactMarkdown>
      </article>

      {/* Resume Footer */}
      {resumeData && (
        <footer className="mt-12 pt-8 border-t border-base-300">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-base-content/60">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Last updated: {new Date(resumeData.updatedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</span>
              </div>
              {viewCount !== null && (
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span>{viewCount.toLocaleString()} {viewCount === 1 ? 'view' : 'views'}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span>Powered by</span>

              {/* Contact Modal */}
              {showContactModal && (
                <div className="modal modal-open">
                  <div className="modal-box max-w-2xl">
                    <h3 className="font-bold text-2xl mb-4">Express Your Interest</h3>

                    {submitSuccess ? (
                      <div className="alert alert-success">
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Thank you! Your interest has been submitted successfully.</span>
                      </div>
                    ) : (
                      <form onSubmit={handleContactSubmit} className="space-y-4">
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text">Your Name *</span>
                          </label>
                          <input
                            type="text"
                            placeholder="John Doe"
                            className="input input-bordered"
                            value={contactForm.name}
                            onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                            required
                          />
                        </div>

                        <div className="form-control">
                          <label className="label">
                            <span className="label-text">Email Address *</span>
                          </label>
                          <input
                            type="email"
                            placeholder="john@company.com"
                            className="input input-bordered"
                            value={contactForm.email}
                            onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                            required
                          />
                        </div>

                        <div className="form-control">
                          <label className="label">
                            <span className="label-text">Company</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Your Company"
                            className="input input-bordered"
                            value={contactForm.company}
                            onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })}
                          />
                        </div>

                        <div className="form-control">
                          <label className="label">
                            <span className="label-text">Message *</span>
                          </label>
                          <textarea
                            className="textarea textarea-bordered h-32"
                            placeholder="I'd like to discuss an opportunity with you..."
                            value={contactForm.message}
                            onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                            required
                          ></textarea>
                        </div>

                        <div className="modal-action">
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => setShowContactModal(false)}
                            disabled={isSubmitting}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? (
                              <>
                                <span className="loading loading-spinner"></span>
                                Sending...
                              </>
                            ) : (
                              'Send Message'
                            )}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                  <div className="modal-backdrop" onClick={() => !isSubmitting && setShowContactModal(false)}></div>
                </div>
              )}
              <a
                href="/"
                className="font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                My Resume
              </a>
            </div>
          </div>
        </footer>
      )}

      <ChatWidget />

      {/* Video Modal */}
      {expandedVideo && (
        <div className="modal modal-open">
          <div className="modal-box max-w-5xl w-full p-0">
            <button
              className="btn btn-sm btn-circle absolute right-2 top-2 z-10"
              onClick={() => setExpandedVideo(null)}
            >
              ✕
            </button>
            <div className="video-container expanded" style={{ maxWidth: '100%', paddingBottom: '56.25%' }}>
              <iframe
                src={expandedVideo}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setExpandedVideo(null)} />
        </div>
      )}
    </div>
  );
}
