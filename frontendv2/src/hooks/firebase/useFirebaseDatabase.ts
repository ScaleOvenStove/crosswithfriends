/**
 * useFirebaseDatabase - Hook for Firebase Realtime Database
 * Provides real-time data synchronization
 */

import { useState, useEffect, useCallback } from 'react';
import * as database from '@lib/firebase/database';

interface UseFirebaseDatabaseOptions<T> {
  path: string;
  enabled?: boolean;
  initialData?: T | null;
}

export const useFirebaseDatabase = <T = unknown>({
  path,
  enabled = true,
  initialData = null,
}: UseFirebaseDatabaseOptions<T>) => {
  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    try {
      const unsubscribe = database.subscribeToData<T>(path, (newData) => {
        setData(newData);
        setLoading(false);
      });

      return () => {
        unsubscribe();
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to subscribe to data';
      setError(errorMessage);
      setLoading(false);
    }
  }, [path, enabled]);

  // Write data
  const write = useCallback(
    async (newData: T) => {
      try {
        setError(null);
        await database.writeData(path, newData);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to write data';
        setError(errorMessage);
        throw err;
      }
    },
    [path]
  );

  // Update data
  const update = useCallback(
    async (updates: Record<string, unknown>) => {
      try {
        setError(null);
        await database.updateData(path, updates);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update data';
        setError(errorMessage);
        throw err;
      }
    },
    [path]
  );

  // Delete data
  const remove = useCallback(async () => {
    try {
      setError(null);
      await database.deleteData(path);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete data';
      setError(errorMessage);
      throw err;
    }
  }, [path]);

  return {
    data,
    loading,
    error,
    write,
    update,
    remove,
  };
};

export default useFirebaseDatabase;
