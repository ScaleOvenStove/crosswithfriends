# Cross with Friends - Frontend v2

A modern, real-time collaborative crossword puzzle platform built with React 19.

## Overview

Cross with Friends Frontend v2 is a complete rewrite of the frontend application, implementing all features from the [FRONTEND_FEATURES.md](../FRONTEND_FEATURES.md) specification. This version focuses on:

- **Modern React 19**: Leveraging the latest React features for optimal performance
- **Type Safety**: Full TypeScript implementation with strict type checking
- **State Management**: Zustand for efficient, lightweight state management
- **Real-time Collaboration**: Socket.io for seamless multi-user experiences
- **Performance**: Code splitting, lazy loading, and optimized builds
- **Testing**: Comprehensive test coverage with Vitest and Playwright
- **Developer Experience**: Fast HMR, excellent tooling, and clear architecture

## Tech Stack

### Core

- **React 19** - UI framework with latest features
- **TypeScript 5** - Type safety and developer experience
- **Vite 7** - Fast build tool and dev server

### State Management

- **Zustand** - Lightweight state management
- **React Query** - Server state management and caching

### Real-time

- **Socket.io Client** - WebSocket communication
- **Firebase** - Real-time database and authentication

### UI/Styling

- **MUI (Material-UI)** - Component library
- **Emotion** - CSS-in-JS styling
- **React Icons** - Icon library

### Routing

- **React Router v7** - Client-side routing

### Testing

- **Vitest** - Unit and integration testing
- **Testing Library** - React component testing
- **Playwright** - E2E and component testing

## Project Structure

```
frontendv2/
├── public/              # Static assets
├── src/
│   ├── api/            # API client functions
│   ├── components/     # React components
│   │   ├── common/     # Shared components
│   │   ├── Grid/       # Grid components
│   │   ├── Player/     # Player components
│   │   ├── Chat/       # Chat components
│   │   ├── Game/       # Game components
│   │   ├── Toolbar/    # Toolbar components
│   │   └── ...
│   ├── config/         # Configuration files
│   ├── hooks/          # Custom React hooks
│   ├── pages/          # Page components
│   ├── routes/         # Route definitions
│   ├── sockets/        # Socket.io integration
│   ├── stores/         # Zustand stores
│   ├── theme/          # Theme configuration
│   ├── types/          # TypeScript type definitions
│   ├── utils/          # Utility functions
│   ├── tests/          # Test files
│   ├── App.tsx         # Root component
│   ├── index.tsx       # Entry point
│   └── style.css       # Global styles
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

## Getting Started

### Prerequisites

- Node.js 18+
- Yarn workspace (monorepo setup)

### Installation

From the monorepo root:

```bash
yarn install
```

### Development

Start the development server:

```bash
cd frontendv2
yarn dev
```

The app will be available at `http://localhost:3021`

For local backend development:

```bash
yarn dev:local
```

### Building

Build for production:

```bash
yarn build
```

Build with production environment:

```bash
yarn build:prod
```

### Testing

Run unit tests:

```bash
yarn test
```

Run tests with UI:

```bash
yarn test:ui
```

Run E2E tests:

```bash
yarn test:e2e
```

### Linting & Formatting

Lint code:

```bash
yarn lint
yarn lint:fix
```

Format code:

```bash
yarn format
yarn format:check
```

Type check:

```bash
yarn type-check
```

## Architecture

### State Management

The application uses **Zustand** for global state management with the following stores:

- **gameStore** - Game state, cells, users, clock
- **userStore** - User profile, authentication, preferences
- **puzzleStore** - Puzzle data and metadata
- **battleStore** - Battle mode state and teams
- **compositionStore** - Puzzle composition/creation state

### Real-time Communication

Real-time features are powered by **Socket.io**:

- Game events (cell updates, cursor movements)
- Chat messages
- Room events
- Battle mode events

The `SocketProvider` manages the WebSocket connection lifecycle, and custom hooks provide easy access to socket functionality.

### Routing

Application routing is defined in `/src/routes/index.tsx` with lazy-loaded page components for optimal code splitting.

### Component Organization

Components are organized by feature/domain:

- **common/** - Shared components (Nav, ErrorBoundary, LoadingSpinner)
- **Grid/** - Crossword grid components
- **Player/** - Player interaction components
- **Chat/** - Chat system components
- **Game/** - Game-specific components
- **Toolbar/** - Toolbar and controls

## Features Implementation Status

This scaffold implements the foundational architecture for all features specified in `FRONTEND_FEATURES.md`:

### ✅ Completed

- Project setup and configuration
- TypeScript configuration
- Routing structure
- State management stores
- Socket.io integration
- Base component structure
- Testing infrastructure
- Dark mode support
- Error boundaries
- Loading states

### 🚧 To Implement

- Grid interaction components
- Clue display system
- Game tools (check, reveal, reset)
- Chat system
- Puzzle upload/creation
- Replay functionality
- Battle mode UI
- Fencing mode UI
- User authentication
- API integration

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

#### Server Configuration

The following environment variables control which backend server the frontend connects to:

- `VITE_API_URL` - **Full API URL** (e.g., `http://localhost:3021`) - Overrides all other server settings. Use this for complete control over the API endpoint.
- `VITE_WS_URL` - **Full WebSocket URL** (e.g., `http://localhost:3021`) - Overrides WebSocket connection. If not set, uses `VITE_API_URL` or falls back to other settings.
- `VITE_SERVER_PORT` - **Server port** (default: `3021`) - Used when `VITE_USE_LOCAL_SERVER=1` to construct localhost URLs.
- `VITE_USE_LOCAL_SERVER` - **Use local server** (`0` or `1`, default: `0`) - When enabled, connects to `http://localhost:${VITE_SERVER_PORT}`.

**Priority order for API/WebSocket URLs:**

1. `VITE_API_URL` / `VITE_WS_URL` (explicit URLs - highest priority)
2. `VITE_USE_LOCAL_SERVER=1` with `VITE_SERVER_PORT` (localhost mode)
3. `VITE_ENV=production` (production server)
4. Default (staging server)

**Examples:**

```bash
# Connect to local server on default port 3021
VITE_USE_LOCAL_SERVER=1

# Connect to local server on custom port 4000
VITE_USE_LOCAL_SERVER=1
VITE_SERVER_PORT=4000

# Connect to custom server URL
VITE_API_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080

# Use production server
VITE_ENV=production
```

#### Other Variables

- `VITE_ENV` - Environment mode (`development`, `production`, `staging`)
- Firebase configuration variables (see Firebase setup)

### Vite Configuration

See `vite.config.ts` for:

- Path aliases
- Build optimization
- Code splitting strategy
- Plugin configuration

## Development Guidelines

### Code Style

- Use TypeScript strict mode
- Follow ESLint and Prettier configurations
- Use functional components and hooks
- Implement proper error handling
- Write tests for new features

### Component Guidelines

- Keep components focused and single-purpose
- Use TypeScript interfaces for props
- Implement proper accessibility (ARIA labels, keyboard navigation)
- Use semantic HTML
- Follow REQ specifications from FRONTEND_FEATURES.md

### State Management

- Use Zustand stores for global state
- Use React Query for server data
- Keep component state local when possible
- Follow immutable update patterns

### Testing

- Write tests alongside feature development
- Test user interactions and edge cases
- Use Testing Library best practices
- Maintain >80% code coverage goal

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile browsers (iOS Safari, Chrome Android)

## Performance

The application is optimized for performance:

- Code splitting by route and feature
- Lazy loading of components
- Optimized bundle sizes
- Efficient re-renders with Zustand
- React Query caching
- Virtual scrolling for long lists

## Contributing

When adding features:

1. Reference the requirement from FRONTEND_FEATURES.md
2. Update TypeScript types as needed
3. Add tests for new functionality
4. Update documentation
5. Follow the existing code patterns

## License

Copyright © 2024 Cross with Friends

## Related Documentation

- [Frontend Features Specification](../FRONTEND_FEATURES.md)
- [Original Frontend](../frontend/)
- [Shared Package](../shared/)
