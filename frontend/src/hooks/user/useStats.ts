/**
 * useStats - Hook for fetching user statistics from API
 * Implements REQ-7: Stats page integration with /api/stats endpoint
 */

import { useQuery } from '@tanstack/react-query';
import { statsApi } from '@api/apiClient';
import { useUserStore } from '@stores/userStore';
import { useMemo } from 'react';
import type { PuzzleSizeStats, PuzzleHistoryItem } from '@api/types';

export const useStats = () => {
  const { history } = useUserStore();

  // Get list of game IDs from user history
  const gameIds = useMemo(() => {
    return history.solvedPuzzles || [];
  }, [history.solvedPuzzles]);

  // Fetch stats from API
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['stats', gameIds],
    queryFn: () => statsApi.submitStats({ gids: gameIds }),
    enabled: gameIds.length > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Type assertions for the response data
  const stats = useMemo(() => {
    return (data?.stats as PuzzleSizeStats[] | undefined) || [];
  }, [data?.stats]);

  const historyItems = useMemo(() => {
    return (data?.history as PuzzleHistoryItem[] | undefined) || [];
  }, [data?.history]);

  // Calculate aggregate stats
  const aggregateStats = useMemo(() => {
    const totalPuzzlesSolved = stats.reduce((sum, stat) => sum + stat.nPuzzlesSolved, 0);

    const allSolveTimes = historyItems.map((item) => item.solveTime);
    const avgSolveTime =
      allSolveTimes.length > 0
        ? allSolveTimes.reduce((sum, time) => sum + time, 0) / allSolveTimes.length
        : 0;

    const bestSolveTime = allSolveTimes.length > 0 ? Math.min(...allSolveTimes) : 0;

    const totalCheckedSquares = historyItems.reduce(
      (sum, item) => sum + item.checkedSquareCount,
      0
    );
    const totalRevealedSquares = historyItems.reduce(
      (sum, item) => sum + item.revealedSquareCount,
      0
    );

    return {
      totalPuzzlesSolved,
      avgSolveTime: Math.round(avgSolveTime),
      bestSolveTime,
      totalCheckedSquares,
      totalRevealedSquares,
      avgCheckedPerPuzzle:
        totalPuzzlesSolved > 0
          ? Math.round((totalCheckedSquares / totalPuzzlesSolved) * 100) / 100
          : 0,
      avgRevealedPerPuzzle:
        totalPuzzlesSolved > 0
          ? Math.round((totalRevealedSquares / totalPuzzlesSolved) * 100) / 100
          : 0,
    };
  }, [stats, historyItems]);

  // Group history by date for charts
  const historyByDate = useMemo(() => {
    const grouped: Record<string, number> = {};

    historyItems.forEach((item) => {
      const date = item.dateSolved;
      grouped[date] = (grouped[date] || 0) + 1;
    });

    // Convert to array and sort by date
    return Object.entries(grouped)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [historyItems]);

  // Group by puzzle size
  const statsBySize = useMemo(() => {
    return [...stats].sort((a, b) => a.size.localeCompare(b.size));
  }, [stats]);

  return {
    stats: statsBySize,
    history: historyItems,
    aggregateStats,
    historyByDate,
    isLoading,
    error,
    refetch,
  };
};

export default useStats;
