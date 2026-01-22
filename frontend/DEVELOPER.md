# Frontend Developer Guide

This guide provides in-depth technical documentation for developers working on the Cross with Friends frontend. For basic setup and usage, see [README.md](./README.md).

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [State Management](#state-management)
- [Hooks System](#hooks-system)
- [Real-time Communication](#real-time-communication)
- [Component Patterns](#component-patterns)
- [API Integration](#api-integration)
- [Firebase Integration](#firebase-integration)
- [Testing Strategy](#testing-strategy)
- [Build and Optimization](#build-and-optimization)
- [Adding New Features](#adding-new-features)

---

## Architecture Overview

### Directory Structure

```
src/
├── api/                    # API client layer
│   ├── apiClient.ts        # Configured axios/fetch instances with auth
│   ├── types.ts            # Request/response types
│   ├── upload.ts           # File upload utilities
│   └── generated/          # OpenAPI-generated client code
│
├── components/             # React components (feature-organized)
│   ├── Grid/               # Crossword grid rendering
│   ├── Chat/               # Real-time chat system
│   ├── Toolbar/            # Game controls
│   ├── Game/               # Game-specific components
│   ├── PuzzleList/         # Puzzle browsing
│   ├── Battle/             # Battle mode UI
│   ├── Replay/             # Game replay
│   ├── Account/            # User profile
│   ├── Stats/              # Statistics
│   ├── Upload/             # Puzzle upload
│   ├── Compose/            # Puzzle creation
│   ├── Mobile/             # Mobile-specific
│   ├── Help/               # Help and shortcuts
│   └── common/             # Shared (Nav, ErrorBoundary, etc.)
│
├── config/                 # Centralized configuration
│   └── index.ts            # Environment-based config
│
├── contexts/               # React Context providers
│   ├── FirebaseContext.tsx # Firebase initialization
│   └── ThemeContext.tsx    # Dark mode management
│
├── firebase/               # Firebase integration
│   ├── auth.ts             # Authentication functions
│   ├── config.ts           # Firebase configuration
│   ├── realtimeDb.ts       # Realtime database operations
│   └── storage.ts          # File storage operations
│
├── hooks/                  # Custom React hooks
│   ├── firebase/           # Auth, DB, storage hooks
│   ├── game/               # Game state and events
│   ├── puzzle/             # Puzzle data and clues
│   ├── ui/                 # UI interactions
│   ├── user/               # User profile and chat
│   └── index.ts            # Centralized exports
│
├── pages/                  # Route page components (lazy-loaded)
├── routes/                 # React Router configuration
├── schemas/                # Zod validation schemas
├── services/               # Business logic utilities
├── sockets/                # Socket.io integration
├── stores/                 # Zustand state stores
├── theme/                  # MUI theme configuration
├── types/                  # TypeScript definitions
├── utils/                  # Utility functions
└── tests/                  # Test configuration
```

### Provider Hierarchy

The app wraps components in several providers (see `App.tsx`):

```tsx
<ErrorBoundary>
  <ThemeProvider>
    {' '}
    {/* Dark mode context */}
    <QueryClientProvider>
      {' '}
      {/* React Query */}
      <SocketProvider>
        {' '}
        {/* WebSocket connection */}
        <RouterProvider /> {/* React Router */}
      </SocketProvider>
    </QueryClientProvider>
  </ThemeProvider>
</ErrorBoundary>
```

---

## State Management

### Zustand Stores

All global state is managed via Zustand stores in `src/stores/`. Each store follows a consistent pattern:

#### Store Pattern

```typescript
// stores/exampleStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface ExampleState {
  // State
  data: string;
  isLoading: boolean;

  // Actions
  setData: (data: string) => void;
  reset: () => void;
}

const initialState = {
  data: '',
  isLoading: false,
};

export const useExampleStore = create<ExampleState>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        setData: (data) => set({ data }),
        reset: () => set(initialState),
      }),
      { name: 'example-storage' } // localStorage key
    ),
    { name: 'ExampleStore' } // DevTools name
  )
);
```

### Available Stores

#### `gameStore` - Core Game State

Manages all game-related state including:

| State          | Type                               | Description                 |
| -------------- | ---------------------------------- | --------------------------- |
| `gid`          | `string \| null`                   | Current game ID             |
| `pid`          | `string \| null`                   | Current puzzle ID           |
| `cells`        | `Cell[][]`                         | Grid cell values and states |
| `solution`     | `string[][]`                       | Correct answers             |
| `clues`        | `{ across: Clue[], down: Clue[] }` | All clues                   |
| `activeUsers`  | `Map<string, UserCursor>`          | Connected users             |
| `selectedCell` | `{ row: number, col: number }`     | Current selection           |
| `direction`    | `'across' \| 'down'`               | Current typing direction    |
| `isPencil`     | `boolean`                          | Pencil mode enabled         |
| `isAutoCheck`  | `boolean`                          | Auto-check mode             |
| `clockRunning` | `boolean`                          | Timer state                 |
| `elapsedTime`  | `number`                           | Seconds elapsed             |

**Key Actions:**

- `setCell(row, col, value)` - Update cell value
- `toggleDirection()` - Switch across/down
- `checkCell()`, `checkWord()`, `checkPuzzle()` - Validation
- `revealCell()`, `revealWord()`, `revealPuzzle()` - Reveals
- `resetPuzzle()` - Clear all cells

#### `userStore` - User Profile & Preferences

Persisted to localStorage for offline access:

| State             | Type                            | Description            |
| ----------------- | ------------------------------- | ---------------------- |
| `user`            | `User \| null`                  | Current user profile   |
| `isAuthenticated` | `boolean`                       | Auth state             |
| `darkMode`        | `'light' \| 'dark' \| 'system'` | Theme preference       |
| `solvedPuzzles`   | `string[]`                      | History of solved PIDs |

#### `puzzleStore` - Puzzle Data

| State        | Type                             | Description         |
| ------------ | -------------------------------- | ------------------- |
| `puzzle`     | `Puzzle \| null`                 | Current puzzle data |
| `dimensions` | `{ rows: number, cols: number }` | Grid size           |
| `title`      | `string`                         | Puzzle title        |
| `author`     | `string`                         | Puzzle author       |

#### `battleStore` - Battle Mode

| State         | Type             | Description         |
| ------------- | ---------------- | ------------------- |
| `battleId`    | `string \| null` | Current battle ID   |
| `teams`       | `Team[]`         | Team information    |
| `powerUps`    | `PowerUp[]`      | Available power-ups |
| `currentTeam` | `string`         | Active team         |
| `winner`      | `string \| null` | Winning team        |

#### `compositionStore` - Puzzle Creation

For the puzzle composition/creation feature.

### Selector Patterns

Use selectors to avoid unnecessary re-renders:

```typescript
// Bad - subscribes to entire store
const { cells, selectedCell, direction } = useGameStore();

// Good - only subscribes to needed state
const cells = useGameStore((state) => state.cells);
const selectedCell = useGameStore((state) => state.selectedCell);

// Better - memoized selector for derived state
const currentClue = useGameStore(
  useCallback((state) => {
    const { selectedCell, direction, clues } = state;
    return findClueForCell(selectedCell, direction, clues);
  }, [])
);
```

---

## Hooks System

Hooks are organized by domain in `src/hooks/`:

### Firebase Hooks (`hooks/firebase/`)

```typescript
// Authentication
const { user, loading, error, signIn, signOut } = useAuth();

// Realtime Database
const { data, loading, error, set, update } = useRealtimeDb(path);

// Storage
const { upload, downloadUrl, progress, error } = useStorage();
```

### Game Hooks (`hooks/game/`)

```typescript
// Game state management
const { game, loading, joinGame, leaveGame } = useGame(gid);

// Game events (cell updates, cursor positions)
const { emitCellUpdate, emitCursorMove } = useGameEvents();

// Room/lobby management
const { room, users, joinRoom, leaveRoom } = useRoom(rid);
```

### Puzzle Hooks (`hooks/puzzle/`)

```typescript
// Puzzle data fetching
const { puzzle, loading, error, refetch } = usePuzzle(pid);

// Puzzle list with filtering
const { puzzles, loading, filters, setFilters } = usePuzzleList();

// Clue navigation
const { currentClue, nextClue, prevClue, goToClue } = useClueNavigation();
```

### UI Hooks (`hooks/ui/`)

```typescript
// Keyboard navigation
const { handleKeyDown, bindKeys, unbindKeys } = useKeyboardNav();

// Filter state management
const { filters, setFilter, resetFilters } = useFilters();

// Error handling
const { error, setError, clearError } = useErrorHandler();

// Window/viewport utilities
const { width, height, isMobile } = useViewport();
```

### Hook Composition Example

```typescript
// Combining multiple hooks for a game page
function useGamePage(gid: string) {
  const { game, loading: gameLoading } = useGame(gid);
  const { puzzle, loading: puzzleLoading } = usePuzzle(game?.pid);
  const { emitCellUpdate } = useGameEvents();
  const { handleKeyDown } = useKeyboardNav();

  const loading = gameLoading || puzzleLoading;

  const handleCellInput = useCallback(
    (row: number, col: number, value: string) => {
      useGameStore.getState().setCell(row, col, value);
      emitCellUpdate({ row, col, value });
    },
    [emitCellUpdate]
  );

  return { game, puzzle, loading, handleCellInput, handleKeyDown };
}
```

---

## Real-time Communication

### Socket.io Setup

The socket connection is managed via `SocketProvider` in `src/sockets/SocketContext.tsx`:

```typescript
// Connecting to socket
const { socket, connected, latency } = useSocket();

// Emitting events
socket.emit('game_event', { type: 'cell_update', data: { row, col, value } });

// Listening to events
useEffect(() => {
  socket.on('game_event', handleGameEvent);
  return () => socket.off('game_event', handleGameEvent);
}, [socket]);
```

### Socket Events

#### Client → Server

| Event                  | Payload                 | Description           |
| ---------------------- | ----------------------- | --------------------- |
| `join_game`            | `{ gid: string }`       | Join game room        |
| `leave_game`           | `{ gid: string }`       | Leave game room       |
| `game_event`           | `GameEvent`             | Emit game update      |
| `sync_all_game_events` | `{ gid: string }`       | Request event history |
| `join_room`            | `{ rid: string }`       | Join lobby room       |
| `room_event`           | `RoomEvent`             | Emit room update      |
| `latency_ping`         | `{ timestamp: number }` | Measure latency       |

#### Server → Client

| Event          | Payload                 | Description           |
| -------------- | ----------------------- | --------------------- |
| `game_event`   | `GameEvent`             | Game update broadcast |
| `room_event`   | `RoomEvent`             | Room update broadcast |
| `latency_pong` | `{ timestamp: number }` | Latency response      |

### Game Event Types

```typescript
type GameEventType =
  | 'cell_update' // Cell value changed
  | 'cursor_move' // User cursor moved
  | 'user_join' // User joined game
  | 'user_leave' // User left game
  | 'check_cell' // Cell checked
  | 'reveal_cell' // Cell revealed
  | 'clock_start' // Timer started
  | 'clock_stop' // Timer stopped
  | 'game_complete'; // Puzzle solved
```

### Connection Recovery

The `socketRecoveryService` handles reconnection:

```typescript
// src/services/socketRecoveryService.ts
export class SocketRecoveryService {
  private pendingEvents: GameEvent[] = [];

  queueEvent(event: GameEvent) {
    this.pendingEvents.push(event);
  }

  async recover(socket: Socket) {
    for (const event of this.pendingEvents) {
      await socket.emitWithAck('game_event', event);
    }
    this.pendingEvents = [];
  }
}
```

---

## Component Patterns

### Grid Component Architecture

The grid is the core UI component:

```
Grid/
├── Grid.tsx              # Main grid container
├── GridCell.tsx          # Individual cell (input handling)
├── GridRow.tsx           # Row container
├── CluePanel.tsx         # Current clue display
├── ClueList.tsx          # All clues list
├── ClueItem.tsx          # Single clue item
└── ActiveHint.tsx        # Highlighted active clue
```

#### Cell Rendering

```typescript
// GridCell.tsx
interface GridCellProps {
  row: number;
  col: number;
  value: string;
  isBlack: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  isPencil: boolean;
  isCorrect?: boolean;
  isRevealed?: boolean;
  hasCircle?: boolean;
  clueNumber?: number;
  onInput: (value: string) => void;
  onClick: () => void;
}

const GridCell: React.FC<GridCellProps> = memo(
  ({ row, col, value, isBlack, isSelected, ...props }) => {
    // Render logic
  }
);
```

### Error Boundaries

Two levels of error handling:

```typescript
// Global - catches all errors
<ErrorBoundary fallback={<ErrorPage />}>
  <App />
</ErrorBoundary>

// Component-level - graceful degradation
<ComponentErrorBoundary fallback={<ComponentFallback />}>
  <FeatureComponent />
</ComponentErrorBoundary>
```

### Loading States

Consistent loading patterns:

```typescript
// Page-level loading
if (loading) return <LoadingSpinner fullPage />;

// Component-level loading
if (loading) return <Skeleton variant="rectangular" height={200} />;

// Suspense for lazy components
<Suspense fallback={<LoadingSpinner />}>
  <LazyComponent />
</Suspense>
```

---

## API Integration

### API Client Setup

The API client in `src/api/apiClient.ts` provides:

- Automatic auth token injection
- Token refresh on 401
- Request/response interceptors
- Type-safe API calls

```typescript
// Usage
import { puzzlesApi, gamesApi } from '@/api/apiClient';

// Fetch puzzle
const puzzle = await puzzlesApi.getPuzzleById({ pid: '123' });

// Create game
const game = await gamesApi.createGame({ gid: 'abc', pid: '123' });
```

### Generated Types

Types are auto-generated from the OpenAPI spec:

```bash
# Regenerate after API changes
yarn api:generate
```

### Auth Token Flow

```
1. User signs in via Firebase
2. Firebase ID token obtained
3. Token exchanged for backend JWT via /api/auth/firebase
4. JWT stored and attached to all API requests
5. On 401, token is refreshed automatically
```

---

## Firebase Integration

### Configuration

Firebase config in `src/firebase/config.ts`:

```typescript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  // ...
};
```

### Authentication

```typescript
// src/firebase/auth.ts
export const signInWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);

export const signOut = () => auth.signOut();
```

### Realtime Database

Used for real-time game state sync as backup to Socket.io:

```typescript
// src/firebase/realtimeDb.ts
export const subscribeToGame = (gid: string, callback: (data: Game) => void) => {
  const gameRef = ref(database, `games/${gid}`);
  return onValue(gameRef, (snapshot) => callback(snapshot.val()));
};
```

---

## Testing Strategy

### Test Structure

```
src/
├── __tests__/           # Unit tests alongside source
├── tests/
│   ├── setup.ts         # Vitest setup
│   └── utils.tsx        # Test utilities
```

### Unit Tests (Vitest)

```typescript
// Example: hooks/__tests__/useGame.test.ts
import { renderHook, act } from '@testing-library/react';
import { useGame } from '../game/useGame';

describe('useGame', () => {
  it('should join game on mount', async () => {
    const { result } = renderHook(() => useGame('test-gid'));

    await waitFor(() => {
      expect(result.current.game).toBeDefined();
    });
  });
});
```

### Component Tests

```typescript
// Example: components/Grid/__tests__/GridCell.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { GridCell } from '../GridCell';

describe('GridCell', () => {
  it('should call onInput when typing', () => {
    const onInput = vi.fn();
    render(<GridCell row={0} col={0} onInput={onInput} {...defaultProps} />);

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'A' });
    expect(onInput).toHaveBeenCalledWith('A');
  });
});
```

### E2E Tests (Playwright)

```typescript
// e2e/game.spec.ts
import { test, expect } from '@playwright/test';

test('user can solve a puzzle', async ({ page }) => {
  await page.goto('/game/test-game');

  // Type in cells
  await page.keyboard.type('HELLO');

  // Verify completion
  await expect(page.locator('.game-complete')).toBeVisible();
});
```

### Running Tests

```bash
yarn test              # Unit tests
yarn test:ui           # Interactive UI
yarn test:coverage     # With coverage
yarn test:e2e          # E2E tests
yarn test:e2e:debug    # E2E debug mode
```

---

## Build and Optimization

### Vite Configuration

Key optimizations in `vite.config.ts`:

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router'],
          'mui-vendor': ['@mui/material', '@emotion/react'],
          'firebase-vendor': ['firebase/app', 'firebase/auth'],
          'socket-vendor': ['socket.io-client'],
          // ...
        },
      },
    },
  },
});
```

### Code Splitting

Routes are lazy-loaded:

```typescript
// routes/index.tsx
const Game = lazy(() => import('@/pages/Game'));
const Account = lazy(() => import('@/pages/Account'));
```

### Bundle Analysis

```bash
# Analyze bundle size
yarn build && npx vite-bundle-visualizer
```

---

## Adding New Features

### Checklist

1. **Define types** in `src/types/`
2. **Create store slice** if needed in `src/stores/`
3. **Add hooks** in `src/hooks/` for data fetching/state
4. **Build components** in `src/components/`
5. **Create page** in `src/pages/` if route needed
6. **Add route** in `src/routes/index.tsx`
7. **Write tests** alongside components
8. **Update types** from API if needed: `yarn api:generate`

### Example: Adding a New Game Mode

```typescript
// 1. Define types
// src/types/newMode.ts
export interface NewModeState {
  modeId: string;
  score: number;
  // ...
}

// 2. Create store
// src/stores/newModeStore.ts
export const useNewModeStore = create<NewModeState>()(...);

// 3. Add hooks
// src/hooks/newMode/useNewMode.ts
export function useNewMode(modeId: string) {
  // Implementation
}

// 4. Build components
// src/components/NewMode/NewModeUI.tsx

// 5. Create page
// src/pages/NewMode.tsx

// 6. Add route
// src/routes/index.tsx
{ path: '/new-mode/:modeId', element: <NewMode /> }
```

---

## Environment Variables Reference

| Variable                            | Description           | Default       |
| ----------------------------------- | --------------------- | ------------- |
| `VITE_API_URL`                      | Backend API URL       | Auto-detected |
| `VITE_WS_URL`                       | WebSocket URL         | Auto-detected |
| `VITE_USE_LOCAL_SERVER`             | Use localhost         | `0`           |
| `VITE_SERVER_PORT`                  | Backend port          | `3021`        |
| `VITE_ENV`                          | Environment           | `development` |
| `VITE_FIREBASE_API_KEY`             | Firebase API key      | Required      |
| `VITE_FIREBASE_AUTH_DOMAIN`         | Firebase auth domain  | Required      |
| `VITE_FIREBASE_PROJECT_ID`          | Firebase project ID   | Required      |
| `VITE_FIREBASE_STORAGE_BUCKET`      | Firebase storage      | Required      |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging    | Required      |
| `VITE_FIREBASE_APP_ID`              | Firebase app ID       | Required      |
| `VITE_SENTRY_DSN`                   | Sentry error tracking | Optional      |

---

## Troubleshooting

### Common Issues

**Socket connection fails**

- Check `VITE_WS_URL` is correct
- Verify backend is running
- Check browser console for CORS errors

**State not updating**

- Ensure using selectors correctly
- Check DevTools for state changes
- Verify actions are being called

**Build fails with type errors**

- Run `yarn api:generate` to sync types
- Check `tsconfig.json` paths
- Clear `.vite` cache: `rm -rf node_modules/.vite`

**Tests failing**

- Run `yarn test --clearCache`
- Check mock setup in `tests/setup.ts`
- Ensure providers are wrapped in test utils
