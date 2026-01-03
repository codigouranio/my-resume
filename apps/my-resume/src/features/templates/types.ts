export interface TemplateProps {
  content: string;
  viewCount?: number | null;
  onContactClick?: () => void;
  components?: any; // ReactMarkdown components prop
}
