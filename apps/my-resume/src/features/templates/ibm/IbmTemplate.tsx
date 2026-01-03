import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { TemplateProps } from '../types';
import './IbmTemplate.css';

export function IbmTemplate({ 
  content, 
  components 
}: TemplateProps) {
  return (
    <div className="ibm-template">
      <div className="ibm-sidebar"></div>
      <div className="ibm-content">
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
