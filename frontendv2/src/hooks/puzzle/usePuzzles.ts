/**
 * Hook for fetching and managing puzzles
 * Implements REQ-3.1: Puzzle Discovery
 */

import { useQuery } from '@tanstack/react-query';
import { puzzlesApi, gamesApi } from '@api/apiClient';
import { usePuzzleStore } from '@stores/puzzleStore';
import { useEffect } from 'react';
import type { Puzzle } from '@types/index';
import type { PuzzleJson } from '@api/types';

/**
 * Convert API PuzzleJson to internal Puzzle type
 */
function convertPuzzle(pid: string, puzzleJson: PuzzleJson): Puzzle {
  return {
    id: pid,
    title: puzzleJson.title,
    author: puzzleJson.author,
    grid: puzzleJson.solution,
    clues: {
      across: (puzzleJson.clues?.Across || []).map((clue) => {
        const [number, text] = Array.isArray(clue) ? clue : [clue.number, clue.clue];
        return {
          number: parseInt(number),
          clue: text,
          answer: '', // Not provided in list
          direction: 'across' as const,
        };
      }),
      down: (puzzleJson.clues?.Down || []).map((clue) => {
        const [number, text] = Array.isArray(clue) ? clue : [clue.number, clue.clue];
        return {
          number: parseInt(number),
          clue: text,
          answer: '', // Not provided in list
          direction: 'down' as const,
        };
      }),
    },
    width: puzzleJson.dimensions?.width || 0,
    height: puzzleJson.dimensions?.height || 0,
  };
}

export const usePuzzles = (page: number = 0, pageSize: number = 50) => {
  const { setPuzzles, setLoading, setError } = usePuzzleStore();

  const query = useQuery({
    queryKey: ['puzzles', page, pageSize],
    queryFn: () => puzzlesApi.listPuzzles(page.toString(), pageSize.toString()),
  });

  useEffect(() => {
    if (query.data) {
      const puzzles =
        query.data.puzzles?.map((item: any) => convertPuzzle(item.pid, item.content)) || [];
      setPuzzles(puzzles);
    }
    setLoading(query.isLoading);
    setError(query.error?.message || null);
  }, [query.data, query.isLoading, query.error, setPuzzles, setLoading, setError]);

  return {
    puzzles: query.data?.puzzles?.map((item: any) => convertPuzzle(item.pid, item.content)) || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

export const usePuzzle = (puzzleId: string | undefined) => {
  const { setPuzzle, setCurrentPuzzle, setLoading, setError } = usePuzzleStore();

  const query = useQuery({
    queryKey: ['puzzle', puzzleId],
    queryFn: () => puzzlesApi.getPuzzleById(puzzleId!),
    enabled: !!puzzleId,
  });

  useEffect(() => {
    if (query.data && puzzleId) {
      // Convert PuzzleJson to internal Puzzle type
      const puzzle = convertPuzzle(puzzleId, query.data);
      setPuzzle(puzzle);
      setCurrentPuzzle(puzzleId);
    }
    setLoading(query.isLoading);
    setError(query.error?.message || null);
  }, [
    query.data,
    query.isLoading,
    query.error,
    setPuzzle,
    setCurrentPuzzle,
    setLoading,
    setError,
    puzzleId,
  ]);

  return {
    puzzle: query.data ? convertPuzzle(puzzleId!, query.data) : undefined,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};
