import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import './Resume.css';

export default function Resume() {
  const [markdown, setMarkdown] = useState<string>('Loading...');

  useEffect(() => {
    fetch('/resume.md')
      .then((response) => response.text())
      .then((text) => setMarkdown(text))
      .catch((error) => {
        console.error('Error loading resume:', error);
        setMarkdown('Error loading resume. Please try again later.');
      });
  }, []);

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
    </div>
  );
}
