# Shared Resources

Common components, styles, types, and utilities used across features.

## Structure

```
shared/
├── components/     # Reusable UI components (buttons, inputs, etc.)
├── styles/         # Global styles and theme
├── types/          # TypeScript types/interfaces
└── utils/          # Helper functions and utilities
```

## Usage

Import shared resources from any feature:

```tsx
import { Button } from '@/shared/components';
import type { User } from '@/shared/types';
```
