# Resume App - Screaming Architecture

Feature-based project structure that makes it clear what the application does.

## Structure

```
src/
├── features/           # Application features (what the app DOES)
│   ├── resume/        # Resume display feature
│   │   ├── Resume.tsx
│   │   ├── Resume.css
│   │   ├── index.ts
│   │   └── README.md
│   └── chat/          # AI Chat assistant feature
│       ├── ChatWidget.tsx
│       ├── ChatWidget.css
│       ├── index.ts
│       └── README.md
├── shared/            # Shared resources across features
│   ├── components/    # Reusable UI components
│   ├── styles/        # Global styles
│   ├── types/         # TypeScript types
│   └── utils/         # Helper functions
├── App.tsx           # Main app component
├── index.tsx         # Entry point
└── env.d.ts          # Environment type definitions
```

## Features

### Resume (`features/resume/`)
Displays professional resume content from markdown with company logos and embedded videos.

### Chat (`features/chat/`)
AI-powered chatbot that answers questions about career experience using the LLM service.

## Principles

1. **Feature-based organization** - Group by what the app does, not by technical type
2. **Self-contained features** - Each feature has its own components, styles, and logic
3. **Shared resources** - Common code lives in `shared/`
4. **Clear boundaries** - Features can depend on shared, but not on each other

## Adding a New Feature

1. Create feature folder: `src/features/my-feature/`
2. Add components and styles
3. Create `index.ts` to export public API
4. Document in feature's `README.md`
