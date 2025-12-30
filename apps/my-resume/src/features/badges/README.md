# Badges Feature

This feature contains reusable badge components for the resume application.

## Components

### GitHubStats
Displays GitHub statistics for a user including repos, stars, forks, and top languages.

**Usage:**
```tsx
import { GitHubStats } from '../badges';

<GitHubStats username="codigouranio" theme="dark" />
```

**Props:**
- `username` (required): GitHub username
- `theme` (optional): "light" or "dark" (default: "dark")

## Adding New Badges

To add a new badge component:

1. Create a new component file in this directory (e.g., `LinkedInBadge.tsx`)
2. Export it from `index.ts`
3. Use it in the resume by parsing markdown image syntax

### Markdown Integration

Badges are rendered through the Resume component's custom image renderer. 
To use a badge in markdown:

```markdown
![Badge Name](badge-type?param1=value1&param2=value2)
```

Example:
```markdown
![GitHub Stats](github?username=codigouranio&theme=dark)
```
