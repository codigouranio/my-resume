import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { TemplateProps } from '../types';
import './TechTemplate.css';

export function TechTemplate({
  content,
  components
}: TemplateProps) {
  return (
    <div className="tech-template">
      <div className="tech-accent-bar"></div>
      <div className="tech-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={components}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
