/**
 * Custom hooks exports - organized by feature
 */

// User hooks
export { useUser } from './user/useUser';
export { useChat } from './user/useChat';
export { default as useStats } from './user/useStats';

// Puzzle hooks
export { usePuzzles, usePuzzle } from './puzzle/usePuzzles';
export { useClues } from './puzzle/useClues';
export { default as usePuzzleList } from './puzzle/usePuzzleList';
export { useInfinitePuzzleList } from './puzzle/usePuzzleList';

// Game hooks
export { useGame } from './game/useGame';
export { default as useGameEvents } from './game/useGameEvents';
export { default as useRoomEvents } from './game/useRoomEvents';
export { default as useBattleMode } from './game/useBattleMode';

// UI hooks
export { useKeyboardNavigation } from './ui/useKeyboardNavigation';
export { default as useReplayPlayback } from './ui/useReplayPlayback';
export { default as useVirtualKeyboard } from './ui/useVirtualKeyboard';
export { default as useLatency } from './ui/useLatency';
export { useFilterState } from './ui/useFilterState';
export { useErrorHandler } from './ui/useErrorHandler';

// Firebase hooks
export { default as useFirebaseAuth } from './firebase/useFirebaseAuth';
export { default as useFirebaseDatabase } from './firebase/useFirebaseDatabase';
export { default as useFirebaseStorage } from './firebase/useFirebaseStorage';
