export { DefaultTemplate } from './default/DefaultTemplate';
export { ModernTemplate } from './modern/ModernTemplate';
export { MinimalTemplate } from './minimal/MinimalTemplate';
export { ProfessionalTemplate } from './professional/ProfessionalTemplate';
export { CorporateTemplate } from './corporate/CorporateTemplate';
export { TechTemplate } from './tech/TechTemplate';

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
  professional: {
    name: 'Professional',
    description: 'Clean gradient design with modern SaaS aesthetics',
    component: 'ProfessionalTemplate',
  },
  corporate: {
    name: 'Corporate',
    description: 'Dark corporate theme with blue accents',
    component: 'CorporateTemplate',
  },
  tech: {
    name: 'Tech',
    description: 'Tech-forward design with orange accents',
    component: 'TechTemplate',
  },
} as const;

export type TemplateType = keyof typeof TEMPLATES;
