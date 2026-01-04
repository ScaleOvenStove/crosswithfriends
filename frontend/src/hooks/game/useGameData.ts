/**
 * Hook for fetching game and puzzle data
 * Handles data loading, error handling, and state management
 */

import { useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useGameStore } from '@stores/gameStore';
import { puzzlesApi, gamesApi, ResponseError } from '@api/apiClient';
import { API_BASE_URL } from '../../config';
import {
  transformPuzzleToGrid,
  assignCellNumbers,
  extractCluesFromPuzzle,
} from '@utils/puzzleUtils';
import {
  validatePuzzleData as _validatePuzzleData,
  safeValidatePuzzleData,
} from '@schemas/puzzleSchemas';
import {
  validateGameInfo,
  validateActiveGameInfo,
  validateJoinGameResponse as _validateJoinGameResponse,
} from '@schemas/apiSchemas';
import {
  standardizeError,
  createUserFriendlyMessage,
  extractErrorDetails,
} from '@services/errorInterceptor';

interface UseGameDataReturn {
  isLoading: boolean;
  loadError: string | null;
  hasLoaded: boolean;
  puzzleId: string | null;
  refetch: () => void;
}

/**
 * Fetches puzzle ID from game ID or uses gameId as puzzleId
 */
async function resolvePuzzleId(gameId: string): Promise<string> {
  let puzzleId: string = gameId;

  // Try to fetch as a game ID first (for completed games only)
  try {
    const gameInfo = await gamesApi.getGameById(gameId);
    const validated = validateGameInfo(gameInfo);
    if (validated.pid) {
      puzzleId = validated.pid;
    }
  } catch (error) {
    // If 404, this could be an active game or a puzzle ID
    if (error instanceof ResponseError && error.response.status === 404) {
      // Try to get puzzle ID from active game
      try {
        const response = await fetch(`${API_BASE_URL}/game/${gameId}/pid`);
        if (response.ok) {
          const activeGameInfo = await response.json();
          const validated = validateActiveGameInfo(activeGameInfo);
          if (validated.pid) {
            puzzleId = validated.pid;
          }
        }
      } catch {
        // Failed to check active game, treat as puzzle ID
      }
    }
  }

  return puzzleId;
}

/**
 * Fetches and validates puzzle data
 */
async function fetchPuzzleData(puzzleId: string) {
  const puzzleData = await puzzlesApi.getPuzzleById(puzzleId);

  if (!puzzleData) {
    throw new Error('Puzzle data is invalid');
  }

  // Validate puzzle data with Zod
  const validation = safeValidatePuzzleData(puzzleData);
  if (!validation.success) {
    const errorMessages =
      validation.error?.errors?.map((e) => e.message).join(', ') || 'Unknown validation error';
    console.error('[useGameData] Puzzle validation failed:', validation.error);
    throw new Error(`Puzzle data validation failed: ${errorMessages}`);
  }

  // validation.success is true, so data is guaranteed to exist
  return validation.data;
}

export function useGameData(
  gameId: string | undefined,
  isPuzzleRoute: boolean = false,
  knownPuzzleId?: string
): UseGameDataReturn {
  const { setPuzzleId, setCells, setSolution, setClues } = useGameStore();
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Use React Query for puzzle data fetching
  const {
    data: puzzleData,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['puzzle', gameId, isPuzzleRoute, knownPuzzleId],
    queryFn: async () => {
      if (!gameId) throw new Error('Game ID is required');

      // Resolve puzzle ID - use known puzzle ID if available, skip game ID resolution if this is a puzzle route
      const puzzleId = knownPuzzleId || (isPuzzleRoute ? gameId : await resolvePuzzleId(gameId));

      // Fetch puzzle data
      const data = await fetchPuzzleData(puzzleId);

      return { puzzleId, data };
    },
    enabled: !!gameId && !hasLoaded,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Process puzzle data when loaded
  useEffect(() => {
    if (!puzzleData || hasLoaded) return;

    try {
      const { puzzleId, data } = puzzleData;

      // Transform puzzle data
      const { cells: transformedCells, solution } = transformPuzzleToGrid(data);

      // Auto-assign numbers if not already present
      const cellsWithNumbers = assignCellNumbers(transformedCells);

      // Extract clues
      const clues = extractCluesFromPuzzle(data);

      // Update store
      setCells(cellsWithNumbers);
      setSolution(solution);
      setClues(clues);
      setPuzzleId(puzzleId);

      setHasLoaded(true);
      setLoadError(null);
      // Puzzle loaded successfully - no logging needed in production
    } catch (error) {
      console.error('[useGameData] Failed to process puzzle data:', error);
      const standardized = standardizeError(error, { component: 'useGameData', action: 'process' });
      setLoadError(createUserFriendlyMessage(standardized));
      setHasLoaded(true);
    }
  }, [puzzleData, hasLoaded, setCells, setSolution, setClues, setPuzzleId]);

  // Handle query errors
  useEffect(() => {
    if (queryError && !hasLoaded) {
      console.error('[useGameData] Query error:', queryError);

      let errorMessage = 'Failed to load puzzle';

      if (queryError instanceof ResponseError) {
        const details = extractErrorDetails(queryError);
        const standardized = standardizeError(queryError, {
          component: 'useGameData',
          action: 'fetch',
          status: details.status,
        });

        if (details.status === 404) {
          // Check if this looks like a game ID (starts with "100313" pattern) vs puzzle ID (starts with "10000" pattern)
          // Game IDs are typically in the 100313xxx range, puzzle IDs are typically in the 10000xxxx range
          const idToCheck = gameId || '';
          const looksLikeGameId = /^100313\d+$/.test(idToCheck);
          const looksLikePuzzleId = /^10000\d+$/.test(idToCheck);

          if (isPuzzleRoute && looksLikeGameId && !looksLikePuzzleId) {
            errorMessage = `The ID "${gameId}" appears to be a game ID, not a puzzle ID. Puzzle IDs typically start with "10000". Please use the puzzle ID from the puzzle list, or navigate to /game/${gameId} instead.`;
          } else {
            errorMessage = `Puzzle "${gameId}" not found. It may have been deleted or the ID is incorrect.`;
          }
        } else if (details.status === 500) {
          // Check for schema validation errors
          if (details.body && typeof details.body === 'object') {
            const body = details.body as { message?: string; error?: string };
            const bodyMessage = body.message || body.error || '';
            if (bodyMessage.includes('does not match schema')) {
              errorMessage =
                "Puzzle data format error: This puzzle's data doesn't match the expected format. Please contact support.";
            } else {
              errorMessage =
                bodyMessage || 'Server error while loading puzzle. Please try again later.';
            }
          } else {
            errorMessage = 'Server error while loading puzzle. Please try again later.';
          }
        } else {
          errorMessage = createUserFriendlyMessage(standardized);
        }
      } else {
        const standardized = standardizeError(queryError, {
          component: 'useGameData',
          action: 'fetch',
        });
        errorMessage = createUserFriendlyMessage(standardized);
      }

      setLoadError(errorMessage);
      setHasLoaded(true);
    }
  }, [queryError, hasLoaded, gameId, isPuzzleRoute]);

  // Reset when gameId changes
  useEffect(() => {
    setHasLoaded(false);
    setLoadError(null);
  }, [gameId]);

  const handleRefetch = useCallback(() => {
    setHasLoaded(false);
    setLoadError(null);
    refetch();
  }, [refetch]);

  return {
    isLoading,
    loadError,
    hasLoaded,
    puzzleId: puzzleData?.puzzleId || null,
    refetch: handleRefetch,
  };
}
