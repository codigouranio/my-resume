import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { TemplateProps } from '../types';
import './CorporateTemplate.css';

export function CorporateTemplate({
  content,
  components
}: TemplateProps) {
  return (
    <div className="corporate-template">
      <div className="corporate-sidebar"></div>
      <div className="corporate-content">
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
