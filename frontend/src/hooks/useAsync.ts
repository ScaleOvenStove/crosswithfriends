import {useEffect, useState} from 'react';

/**
 * Execute an async function and track its state
 * @param asyncFn Async function to execute
 * @returns Object with loading, error, and value
 */
export function useAsync<T>(asyncFn: () => Promise<T>): {
  loading: boolean;
  error: Error | undefined;
  value: T | undefined;
} {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [value, setValue] = useState<T | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    setError(undefined);

    asyncFn()
      .then((result) => {
        if (!cancelled) {
          setValue(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [asyncFn]);

  return {loading, error, value};
}
