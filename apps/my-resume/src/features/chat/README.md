# Chat Feature

AI-powered chat widget for answering questions about Jose's career.

## Components

- `ChatWidget.tsx` - Floating chat interface
- `ChatWidget.css` - Chat widget styling

## API Integration

Connects to the LLM service at `PUBLIC_LLM_API_URL` (configured in .env).

## Usage

```tsx
import { ChatWidget } from '@/features/chat';

<ChatWidget />
```
