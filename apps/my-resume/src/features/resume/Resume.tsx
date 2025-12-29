import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { apiClient } from '../../shared/api/client';
import { ChatWidget } from '../chat';
import './Resume.css';

export default function Resume() {
  const { slug } = useParams<{ slug?: string }>();
  const [markdown, setMarkdown] = useState<string>('');
  const [resumeData, setResumeData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

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
      <article className="prose prose-lg max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
        >
          {markdown}
        </ReactMarkdown>
      </article>

      {/* Resume Footer */}
      {resumeData && (
        <footer className="mt-12 pt-8 border-t border-base-300">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-base-content/60">
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

            <div className="flex items-center gap-2">
              <span>Powered by</span>
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
    </div>
  );
}
