# Custom Hooks

This directory contains all custom React hooks used in the frontendv2 application, organized by feature category for better maintainability and discoverability.

## Directory Structure

```
hooks/
├── firebase/          # Firebase integration hooks
├── game/              # Game state and event hooks
├── puzzle/            # Puzzle data and clue hooks
├── ui/                # UI interaction and utility hooks
├── user/              # User profile and chat hooks
├── index.ts           # Centralized exports
└── README.md          # This file
```

## Hook Categories

### 🔥 Firebase Hooks (`hooks/firebase/`)

Firebase authentication, database, and storage hooks.

- **`useFirebaseAuth`** - Firebase authentication state and methods
- **`useFirebaseDatabase`** - Realtime database operations
- **`useFirebaseStorage`** - File upload/download from Firebase Storage

**Example:**

```typescript
import { useFirebaseAuth } from '@hooks';

const { user, signIn, signOut, isLoading } = useFirebaseAuth();
```

---

### 🎮 Game Hooks (`hooks/game/`)

Game state, events, and multiplayer functionality.

- **`useGame`** - Main game state orchestration (cells, solution, users, clock)
- **`useGameEvents`** - Game event handlers (cell updates, checks, reveals)
- **`useRoomEvents`** - Collaborative room event management
- **`useBattleMode`** - Competitive battle mode state

**Example:**

```typescript
import { useGame } from '@hooks';

const { cells, selectedCell, handleCellUpdate, checkPuzzle } = useGame(gameId);
```

---

### 🧩 Puzzle Hooks (`hooks/puzzle/`)

Puzzle data fetching, management, and clue handling.

- **`usePuzzles`** - Fetch individual puzzles or create new ones
- **`usePuzzleList`** - Paginated puzzle list with infinite scroll support
- **`useClues`** - Clue navigation and highlighting logic

**Example:**

```typescript
import { usePuzzleList } from '@hooks';

const { puzzles, isLoading, fetchNextPage, hasNextPage } = usePuzzleList(filters);
```

---

### 🎨 UI Hooks (`hooks/ui/`)

User interface interactions, keyboard navigation, and utilities.

- **`useKeyboardNavigation`** - Grid cell navigation with arrow keys
- **`useFilterState`** - URL-synced filter state management
- **`useErrorHandler`** - Standardized error handling and display
- **`useVirtualKeyboard`** - Mobile virtual keyboard support
- **`useReplayPlayback`** - Game replay timeline controls
- **`useLatency`** - Network latency measurement

**Example:**

```typescript
import { useErrorHandler } from '@hooks';

const {
  error,
  setError,
  isNotFoundError,
  getErrorTitle
} = useErrorHandler();

// Set error
setError('Puzzle not found');

// Display error
if (isNotFoundError) {
  return <ErrorPage title={getErrorTitle()} />;
}
```

---

### 👤 User Hooks (`hooks/user/`)

User profile, authentication, and social features.

- **`useUser`** - Current user profile and authentication state
- **`useChat`** - Chat message management for games/rooms
- **`useStats`** - User statistics and solve history

**Example:**

```typescript
import { useUser } from '@hooks';

const { user, isAuthenticated, updateProfile } = useUser();
```

---

## Usage Guidelines

### Importing Hooks

All hooks are re-exported from the main hooks index for convenience:

```typescript
// ✅ Preferred - use barrel export
import { useGame, usePuzzles, useErrorHandler } from '@hooks';

// ❌ Avoid - direct imports make refactoring harder
import { useGame } from '@hooks/game/useGame';
```

### Hook Naming Conventions

- Start with `use` prefix (React convention)
- Use camelCase
- Be descriptive about what the hook manages
- Examples: `useGame`, `useFirebaseAuth`, `useErrorHandler`

### Creating New Hooks

When creating a new hook:

1. **Choose the right category** - Place it in the appropriate subdirectory
2. **Export from index** - Add export to `hooks/index.ts`
3. **Document it** - Add JSDoc comments explaining usage
4. **Test it** - Create unit tests in `__tests__/`

**Example structure:**

```typescript
/**
 * Custom hook for managing feature X
 *
 * @example
 * const { data, isLoading, error } = useFeatureX();
 */
export function useFeatureX() {
  // Implementation
  return { data, isLoading, error };
}
```

---

## Testing

Hook tests are located in `hooks/__tests__/`. We use Vitest + React Testing Library.

**Example test:**

```typescript
import { renderHook } from '@testing-library/react';
import { useErrorHandler } from '../ui/useErrorHandler';

test('categorizes 404 errors correctly', () => {
  const { result } = renderHook(() => useErrorHandler());

  act(() => {
    result.current.setError('Puzzle not found');
  });

  expect(result.current.isNotFoundError).toBe(true);
  expect(result.current.getErrorTitle()).toBe('Not Found');
});
```

---

## Common Patterns

### Hook Composition

Hooks can use other hooks to compose functionality:

```typescript
export function useGameWithClues(gameId: string) {
  const game = useGame(gameId);
  const clues = useClues(game.puzzle);

  return { ...game, ...clues };
}
```

### Dependency Injection

Pass dependencies as parameters for better testability:

```typescript
// ✅ Good - testable
export function useFeature(api: ApiClient) {
  const [data, setData] = useState(null);
  // Use api parameter
}

// ❌ Avoid - hard to test
export function useFeature() {
  // Directly importing and using global API
}
```

### Error Handling

Use the `useErrorHandler` hook for consistent error handling:

```typescript
export function useDataFetch(id: string) {
  const { setError } = useErrorHandler();

  useEffect(() => {
    fetchData(id).catch((err) => setError(err));
  }, [id]);
}
```

---

## Migration Guide

If you have hooks in the old flat structure, here's how to migrate:

### Before (old structure):

```
hooks/
├── useGame.ts
├── useFirebaseAuth.ts
├── useKeyboardNavigation.ts
└── index.ts
```

### After (new structure):

```
hooks/
├── game/
│   └── useGame.ts
├── firebase/
│   └── useFirebaseAuth.ts
├── ui/
│   └── useKeyboardNavigation.ts
└── index.ts
```

**Import paths stay the same** - the barrel export in `index.ts` maintains backwards compatibility!

---

## Performance Considerations

### Memoization

Use `useMemo` and `useCallback` for expensive computations:

```typescript
export function useExpensiveComputation(data: Data[]) {
  const processed = useMemo(() => {
    return expensiveOperation(data);
  }, [data]);

  return processed;
}
```

### Avoiding Unnecessary Re-renders

Return stable references:

```typescript
export function useStableHandlers() {
  const handleClick = useCallback(() => {
    // Handler logic
  }, []); // Empty deps = stable reference

  return { handleClick };
}
```

---

## Best Practices

1. **Single Responsibility** - Each hook should do one thing well
2. **Clear Dependencies** - Specify all dependencies in useEffect/useMemo/useCallback
3. **Error Handling** - Always handle errors gracefully
4. **Documentation** - Add JSDoc comments with examples
5. **Testing** - Write unit tests for complex hooks
6. **Type Safety** - Use TypeScript types for all parameters and return values

---

## Future Improvements

Planned enhancements to the hooks system:

- [ ] Add more comprehensive tests for all hooks
- [ ] Create hook composition utilities
- [ ] Add performance monitoring for expensive hooks
- [ ] Document advanced patterns (e.g., hook factories)
- [ ] Create hook generator CLI tool

---

For questions or suggestions, please check the main project documentation or reach out to the team.
