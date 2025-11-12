/**
 * React Query hook for creating games
 */

import {useMutation} from '@tanstack/react-query';
import {createGame} from '../../api/create_game';
import type {CreateGameRequest, CreateGameResponse} from '@crosswithfriends/shared/types';

interface UseCreateGameOptions {
  onSuccess?: (data: CreateGameResponse) => void;
  onError?: (error: Error) => void;
}

export function useCreateGame(options: UseCreateGameOptions = {}) {
  return useMutation({
    mutationFn: async (data: CreateGameRequest) => {
      return createGame(data);
    },
    onSuccess: options.onSuccess,
    onError: options.onError,
  });
}

