# AlignSpeak Web V2

React + TypeScript + Vite + MUI frontend for AlignSpeak.

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **UI Library**: Material-UI (MUI)
- **State Management**: Zustand
- **Routing**: React Router v6
- **i18n**: react-i18next
- **HTTP Client**: Axios
- **Testing**: Vitest + React Testing Library

## Project Structure

```
src/
├── components/       # Reusable UI components
├── pages/           # Page components (Start, Editor, Practice, Result, Me)
├── stores/          # Zustand stores (auth, flow, sync)
├── services/        # API services
├── hooks/           # Custom React hooks
├── utils/           # Utility functions
├── types/           # TypeScript type definitions
├── locales/         # i18n translations (zh, en)
├── theme/           # MUI theme configuration
├── test/            # Test setup
└── __mocks__/       # Mock data for testing
    └── fixtures/    # Mock fixtures by module
```

## Getting Started

### Install Dependencies

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

```bash
npm run build
```

### Test

```bash
# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Lint

```bash
npm run lint
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
API_PROXY_TARGET=http://localhost:8000
VITE_USE_MOCK=false
```

## Key Features

- **Guided Flow**: No bottom tab navigation, step-by-step guided flow
- **State Management**: Zustand for auth, flow, and sync state
- **Offline Support**: LocalStorage-based sync queue with exponential backoff retry
- **i18n**: Chinese and English UI support
- **Dark Theme**: Based on previews design system
- **Type Safety**: Full TypeScript coverage

## Development Guidelines

- Use MUI components with custom theme
- Follow the guided flow architecture (no free navigation)
- Implement PCM audio recording with AudioContext/AudioWorklet
- Handle sync failures gracefully with retry mechanism
- Write tests for core business logic (80%+ coverage target)

## Documentation

See `docs/` directory for detailed specifications:
- `TECH_DECISIONS.md` - All technical decisions
- `TECH_STACK.md` - Technology stack details
- `GUIDED_FLOW_V2_FINAL.md` - Flow architecture
- `pages/` - Individual page specifications

## Search Engine Indexing

The production Nginx config now serves these SEO endpoints automatically by request host:

- `/robots.txt`
- `/sitemap.xml`

After deployment, verify both URLs are reachable on your public domain, then submit:

1. `https://your-domain/sitemap.xml` in Google Search Console
2. Request indexing for `https://your-domain/`

Important: Most app routes are authentication-protected. Search engines can mainly index public entry pages unless you add public, crawlable content pages or move to SSR/prerender for those pages.
