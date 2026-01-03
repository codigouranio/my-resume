import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { TemplateProps } from '../types';
import './ProfessionalTemplate.css';

export function ProfessionalTemplate({
  content,
  components
}: TemplateProps) {
  return (
    <div className="professional-template">
      <div className="professional-gradient-bg"></div>
      <div className="professional-content">
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
