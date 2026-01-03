# Resume Template System

## Overview

The resume platform now supports multiple templates that users can choose from when creating or editing their resumes. Each template is a self-contained component with its own styling in a separate folder.

## Available Templates

### 1. Classic (default)
- **File**: `features/templates/default/`
- **Style**: Traditional resume layout with prose styling
- **Features**: Clean typography, primary/secondary colors, professional appearance
- **Best for**: Traditional industries, formal resumes

### 2. Modern
- **File**: `features/templates/modern/`
- **Style**: Contemporary design with gradients and accent bar
- **Features**: Vertical gradient accent bar, bold gradient text effects, custom bullet points (▸), larger text
- **Best for**: Creative industries, tech roles, modern companies

### 3. Minimal
- **File**: `features/templates/minimal/`
- **Style**: Clean typography-focused design
- **Features**: Serif fonts (Georgia), uppercase section headers, generous whitespace, minimal colors (black/gray/white)
- **Best for**: Academic CVs, minimalist aesthetic, content-focused presentations

## Architecture

### File Structure
```
apps/my-resume/src/features/templates/
├── index.ts                          # Template registry and exports
├── default/
│   ├── DefaultTemplate.tsx           # Classic template component
│   └── DefaultTemplate.css           # Classic template styles
├── modern/
│   ├── ModernTemplate.tsx            # Modern template component
│   └── ModernTemplate.css            # Modern template styles
└── minimal/
    ├── MinimalTemplate.tsx           # Minimal template component
    └── MinimalTemplate.css           # Minimal template styles
```

### Template Props Interface
```typescript
export interface TemplateProps {
  content: string;              // Markdown content to render
  viewCount?: number | null;    // Optional view count for footer
  onContactClick?: () => void;  // Optional callback for contact button
  components?: any;             // Custom ReactMarkdown components (for badges, videos, etc.)
}
```

### Template Registry
```typescript
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
```

## How It Works

### 1. Template Selection (Editor)
- Users can select a template from the dropdown in the editor sidebar
- Template choice is stored in the `Resume.theme` field in the database
- Default theme is `'default'` (Classic template)

**Editor UI** (`EditorPage.tsx`):
```tsx
<select
  className="select select-bordered w-full"
  value={formData.theme}
  onChange={(e) => handleContentChange('theme', e.target.value)}
>
  <option value="default">Classic - Traditional resume layout</option>
  <option value="modern">Modern - Contemporary with gradients</option>
  <option value="minimal">Minimal - Clean typography-focused</option>
</select>
```

### 2. Template Rendering (Public View)
- Resume.tsx dynamically loads the selected template
- Custom components (badges, videos, certificates) are passed to templates
- Each template uses ReactMarkdown with the same custom components

**Dynamic Loading** (`Resume.tsx`):
```tsx
const templateType = (resumeData?.theme || 'default') as TemplateType;
const customComponents = { /* GitHub stats, Coursera certs, videos, etc. */ };

if (templateType === 'modern') {
  const { ModernTemplate } = require('../templates');
  return <ModernTemplate content={markdown} viewCount={viewCount} components={customComponents} />;
} else if (templateType === 'minimal') {
  const { MinimalTemplate } = require('../templates');
  return <MinimalTemplate content={markdown} viewCount={viewCount} components={customComponents} />;
} else {
  const { DefaultTemplate } = require('../templates');
  return <DefaultTemplate content={markdown} viewCount={viewCount} components={customComponents} />;
}
```

### 3. Custom Components
All templates support custom markdown components:
- **Videos**: YouTube embeds with thumbnails (```video ... ```)
- **Coursera Certificates**: 3D card components (```coursera ... ```)
- **GitHub Stats**: SVG badges (`![](github?username=...)`)
- **Badge Images**: Custom badges from `/badges/` API

## Database Schema

The `Resume` model already includes the `theme` field:

```prisma
model Resume {
  id         String   @id @default(cuid())
  title      String
  slug       String   @unique
  content    String   @db.Text
  theme      String?  @default("default")  // Template selection
  // ... other fields
}
```

## Adding New Templates

To add a new template:

1. **Create folder**: `apps/my-resume/src/features/templates/my-template/`

2. **Create component** (`MyTemplate.tsx`):
```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { TemplateProps } from '../index';
import './MyTemplate.css';

export function MyTemplate({ content, viewCount, components }: TemplateProps) {
  return (
    <div className="my-template">
      <div className="prose max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={components}
        >
          {content}
        </ReactMarkdown>
      </div>
      
      {viewCount !== null && viewCount !== undefined && (
        <div className="template-footer">
          <span>{viewCount.toLocaleString()} views</span>
        </div>
      )}
    </div>
  );
}
```

3. **Create styles** (`MyTemplate.css`):
```css
.my-template {
  @apply bg-base-100 rounded-box shadow-xl p-8;
}

.my-template .prose h1 {
  @apply text-4xl font-bold text-primary;
}

/* ... more styles */
```

4. **Register template** in `index.ts`:
```typescript
export { MyTemplate } from './my-template/MyTemplate';

export const TEMPLATES = {
  // ... existing templates
  mytemplate: {
    name: 'My Template',
    description: 'Description of my template',
    component: 'MyTemplate',
  },
} as const;
```

5. **Add to editor dropdown** in `EditorPage.tsx`:
```tsx
<option value="mytemplate">My Template - Description</option>
```

6. **Add rendering logic** in `Resume.tsx`:
```tsx
else if (templateType === 'mytemplate') {
  const { MyTemplate } = require('../templates');
  return <MyTemplate content={markdown} viewCount={viewCount} components={customComponents} />;
}
```

## Styling Guidelines

### Use Tailwind CSS
All templates use Tailwind's `@apply` directives:
```css
.my-template .prose h1 {
  @apply text-4xl font-bold text-primary mb-4;
}
```

### DaisyUI Theme Variables
Use DaisyUI color variables for theme consistency:
- `text-primary`, `text-secondary`, `text-accent`
- `bg-base-100`, `bg-base-200`, `bg-base-300`
- `border-base-300`

### Responsive Design
Always include responsive breakpoints:
```css
.my-template {
  @apply p-4 md:p-8 lg:p-12;
}
```

## Testing

### Local Testing
1. Start dev server: `cd apps/my-resume && yarn dev`
2. Create/edit a resume
3. Select different templates from dropdown
4. Preview changes in real-time
5. Save and view public resume

### Production Build
```bash
cd apps/my-resume
yarn build
```

## Future Enhancements

### Potential Features
- **Template Preview Thumbnails**: Show visual previews in editor
- **Template Categories**: Group templates (Professional, Creative, Academic)
- **Custom Template Builder**: Let PRO users create custom templates
- **Template Marketplace**: Share community templates
- **A/B Testing**: Track which templates get more views/interactions
- **Template Analytics**: Show which templates perform best

### Technical Improvements
- **Lazy Loading**: Load template components on-demand
- **Template Validation**: Ensure templates follow required structure
- **Template Versioning**: Support template updates without breaking existing resumes
- **Template Inheritance**: Create base template class with shared functionality

## Troubleshooting

### Template Not Showing
- Check `Resume.theme` value in database
- Verify template is registered in `TEMPLATES` object
- Check console for loading errors

### Styling Issues
- Ensure CSS file is imported in template component
- Check Tailwind classes are compiled
- Use browser DevTools to inspect applied styles

### Custom Components Not Working
- Verify `components` prop is passed to ReactMarkdown
- Check custom component logic in Resume.tsx
- Test with simpler markdown first

## References

- **Templates Folder**: `apps/my-resume/src/features/templates/`
- **Editor**: `apps/my-resume/src/features/editor/EditorPage.tsx`
- **Public View**: `apps/my-resume/src/features/resume/Resume.tsx`
- **Database Schema**: `apps/api-service/prisma/schema.prisma`

