/**
 * Hook for UI state management
 * Manages selected cell, direction, pencil mode, etc.
 */

import { useCallback } from 'react';
import { useGameStore } from '@stores/gameStore';

interface UseGameUIReturn {
  selectedCell: { row: number; col: number } | null;
  selectedDirection: 'across' | 'down';
  isPencilMode: boolean;
  toggleDirection: () => void;
  togglePencilMode: () => void;
  setSelectedCell: (row: number, col: number) => void;
}

/**
 * Hook for UI state (selected cell, direction, pencil mode)
 * Uses selectors to only re-render when relevant state changes
 */
export function useGameUI(): UseGameUIReturn {
  const selectedCell = useGameStore((state) => state.selectedCell);
  const selectedDirection = useGameStore((state) => state.selectedDirection);
  const isPencilMode = useGameStore((state) => state.isPencilMode);
  const {
    toggleDirection,
    togglePencilMode,
    setSelectedCell: storeSetSelectedCell,
  } = useGameStore();

  const handleSetSelectedCell = useCallback(
    (row: number, col: number) => {
      storeSetSelectedCell(row, col);
    },
    [storeSetSelectedCell]
  );

  return {
    selectedCell,
    selectedDirection,
    isPencilMode,
    toggleDirection,
    togglePencilMode: togglePencilMode,
    setSelectedCell: handleSetSelectedCell,
  };
}
