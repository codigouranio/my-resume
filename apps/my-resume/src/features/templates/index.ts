export { DefaultTemplate } from './default/DefaultTemplate';
export { ModernTemplate } from './modern/ModernTemplate';
export { MinimalTemplate } from './minimal/MinimalTemplate';

export interface TemplateProps {
  content: string;
  viewCount?: number | null;
  onContactClick?: () => void;
  components?: any; // ReactMarkdown components prop
}

export const TEMPLATES = {
  default: {
    name: 'Classic',
    description: 'Traditional resume layout with sidebar',
    component: 'DefaultTemplate',
  },
  modern: {
    name: 'Modern',
    description: 'Contemporary design with accent colors',
    component: 'ModernTemplate',
  },
  minimal: {
    name: 'Minimal',
    description: 'Clean and simple typography-focused design',
    component: 'MinimalTemplate',
  },
} as const;

export type TemplateType = keyof typeof TEMPLATES;
