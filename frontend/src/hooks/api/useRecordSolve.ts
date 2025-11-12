/**
 * React Query hook for recording puzzle solves
 */

import {useMutation} from '@tanstack/react-query';
import {recordSolve} from '../../api/puzzle';

interface UseRecordSolveOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useRecordSolve(options: UseRecordSolveOptions = {}) {
  return useMutation({
    mutationFn: async ({pid, gid, time_to_solve}: {pid: string; gid: string; time_to_solve: number}) => {
      return recordSolve(pid, gid, time_to_solve);
    },
    onSuccess: options.onSuccess,
    onError: options.onError,
  });
}

