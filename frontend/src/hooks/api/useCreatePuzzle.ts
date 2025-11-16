/**
 * React Query hook for creating puzzles
 */

import type {AddPuzzleRequest, AddPuzzleResponse} from '@crosswithfriends/shared/types';
import {useMutation} from '@tanstack/react-query';

import {createNewPuzzle} from '../../api/puzzle';

interface UseCreatePuzzleOptions {
  onSuccess?: (data: AddPuzzleResponse) => void;
  onError?: (error: Error) => void;
}

export function useCreatePuzzle(options: UseCreatePuzzleOptions = {}) {
  return useMutation({
    mutationFn: async ({
      puzzle,
      pid,
      isPublic = false,
    }: {
      puzzle: AddPuzzleRequest;
      pid?: string;
      isPublic?: boolean;
    }) => {
      return createNewPuzzle(puzzle, pid, {isPublic});
    },
    onSuccess: options.onSuccess,
    onError: options.onError,
  });
}
