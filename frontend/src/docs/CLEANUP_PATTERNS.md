# Component Cleanup Patterns

This document outlines the cleanup patterns used throughout the codebase to prevent memory leaks and ensure proper resource management.

## Overview

All components and hooks that manage subscriptions, timers, or external resources must implement proper cleanup in `useEffect` return functions. This ensures resources are released when components unmount or dependencies change.

## Core Principles

1. **Always return a cleanup function** from `useEffect` when setting up subscriptions, timers, or other resources
2. **Clean up in reverse order** of setup (last created, first cleaned)
3. **Use stable references** for cleanup functions to avoid unnecessary re-runs
4. **Handle async cleanup** properly (e.g., cancel pending promises)

## Hook Patterns

### useGame Hook

The `useGame` hook uses `useStoreSubscriptions` which automatically handles cleanup:

```typescript
// frontend/src/hooks/useGame.ts
useStoreSubscriptions(gameStore, path || '', {
  event: onEvent,
  wsEvent: onWsEvent,
  // ... other subscriptions
});
```

**Cleanup:** Handled automatically by `useStoreSubscriptions` hook, which returns cleanup functions for all subscriptions.

### useGameSetup Hook

The `useGameSetup` hook properly cleans up both main game and opponent game:

```typescript
// frontend/src/hooks/useGameSetup.ts
useEffect(() => {
  if (gid && gamePath && gameHookRef.current) {
    gameHookRef.current.attach();
    return () => {
      if (gameHookRef.current) {
        gameHookRef.current.detach();
      }
    };
  }
}, [gid, gamePath]);

useEffect(() => {
  if (opponent && opponentGamePath && opponentGameHookRef.current) {
    opponentGameHookRef.current.attach();
    return () => {
      if (opponentGameHookRef.current) {
        opponentGameHookRef.current.detach();
      }
    };
  }
}, [opponent, opponentGamePath]);
```

**Cleanup:** Both effects return cleanup functions that call `detach()` on their respective games.

### useRoom Hook

The `useRoom` hook properly cleans up socket subscriptions:

```typescript
// frontend/src/hooks/useRoom.ts
useEffect(() => {
  if (!socket) return;

  const {syncPromise, unsubscribe} = subscribeToRoomEvents(socket, rid, setEvents);
  // ... setup code ...

  return () => {
    mounted = false;
    unsubscribe();
  };
}, [rid, socket]);
```

**Cleanup:** Returns cleanup function that calls `unsubscribe()` to remove event listeners and leave the room.

## Component Patterns

### Game.tsx

Uses `useGameSetup` which handles cleanup automatically. No additional cleanup needed at component level.

### Room.tsx

Uses `useRoom` for room management and has additional cleanup for window event listeners:

```typescript
// frontend/src/pages/Room.tsx
useUpdateEffect(() => {
  const renewActivity = throttle(sendUserPing, 1000 * 10);
  window.addEventListener('mousemove', renewActivity);
  window.addEventListener('keydown', renewActivity);
  return () => {
    window.removeEventListener('mousemove', renewActivity);
    window.removeEventListener('keydown', renewActivity);
  };
}, [rid, sendUserPing]);
```

**Cleanup:** Removes window event listeners in cleanup function.

### Replay.tsx

Has comprehensive cleanup for subscriptions, intervals, and debounced functions:

```typescript
// frontend/src/pages/Replay.tsx
useEffect(() => {
  const path = `/game/${gid}`;
  // ... setup code ...
  const unsubscribeWsEvent = gameStore.subscribe(path, 'wsEvent', handler);
  const unsubscribeWsCreateEvent = gameStore.subscribe(path, 'wsCreateEvent', handler);
  gameStore.attach(path);

  return () => {
    debouncedRecomputeHistoryRef.current?.flush();
    unsubscribeWsEvent();
    unsubscribeWsCreateEvent();
    gameStore.detach(path);
  };
}, [gid]);
```

**Cleanup:**

- Flushes pending debounced executions
- Unsubscribes from all event subscriptions
- Detaches the game from the store

## Store-Level Cleanup

The game store implements automatic cleanup policies:

1. **Game Cleanup Policy**: Games are automatically detached after 30 minutes of inactivity
2. **LRU Eviction**: Maximum 10 games in memory, oldest games evicted when limit exceeded
3. **Cache Cleanup**: Game state cache limited to 50 entries with LRU eviction
4. **Subscription Tracking**: Development-mode tracking detects subscription leaks

See `frontend/src/store/gameStore.ts` for implementation details.

## Common Pitfalls

### ❌ Missing Cleanup

```typescript
// BAD: No cleanup function
useEffect(() => {
  const interval = setInterval(() => {
    // do something
  }, 1000);
}, []);
```

### ✅ Proper Cleanup

```typescript
// GOOD: Cleanup function included
useEffect(() => {
  const interval = setInterval(() => {
    // do something
  }, 1000);
  return () => {
    clearInterval(interval);
  };
}, []);
```

### ❌ Stale Closures

```typescript
// BAD: Cleanup uses stale value
useEffect(() => {
  const timer = setTimeout(() => {
    doSomething(value);
  }, 1000);
  return () => clearTimeout(timer);
}, []); // Missing 'value' in dependencies
```

### ✅ Using Refs for Latest Values

```typescript
// GOOD: Use ref for latest value
const valueRef = useRef(value);
useEffect(() => {
  valueRef.current = value;
}, [value]);

useEffect(() => {
  const timer = setTimeout(() => {
    doSomething(valueRef.current);
  }, 1000);
  return () => clearTimeout(timer);
}, []);
```

## Testing Cleanup

When writing tests, verify that cleanup functions are called:

```typescript
it('should cleanup on unmount', () => {
  const cleanup = jest.fn();
  const {unmount} = render(<Component />);

  // Setup that registers cleanup
  // ...

  unmount();
  expect(cleanup).toHaveBeenCalled();
});
```

## ESLint Rules

Consider adding ESLint rules to catch missing cleanup:

```json
{
  "rules": {
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

The `exhaustive-deps` rule helps ensure all dependencies are included, which often catches missing cleanup scenarios.

## Summary

- ✅ All hooks (`useGame`, `useGameSetup`, `useRoom`) implement proper cleanup
- ✅ All page components (`Game.tsx`, `Room.tsx`, `Replay.tsx`) have cleanup in useEffect returns
- ✅ Store-level automatic cleanup policies prevent memory leaks
- ✅ Development-mode subscription tracking helps detect leaks early

## Related Files

- `frontend/src/hooks/useGame.ts` - Game hook with automatic subscription cleanup
- `frontend/src/hooks/useGameSetup.ts` - Game setup with attach/detach cleanup
- `frontend/src/hooks/useRoom.ts` - Room hook with socket cleanup
- `frontend/src/hooks/useStoreSubscriptions.ts` - Generic subscription cleanup helper
- `frontend/src/store/gameStore.ts` - Store with automatic cleanup policies
- `frontend/src/pages/Game.tsx` - Game page component
- `frontend/src/pages/Room.tsx` - Room page component
- `frontend/src/pages/Replay.tsx` - Replay page component
