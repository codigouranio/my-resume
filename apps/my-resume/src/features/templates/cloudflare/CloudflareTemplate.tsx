import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { TemplateProps } from '../types';
import './CloudflareTemplate.css';

export function CloudflareTemplate({ 
  content, 
  components 
}: TemplateProps) {
  return (
    <div className="cloudflare-template">
      <div className="cloudflare-accent-bar"></div>
      <div className="cloudflare-content">
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
