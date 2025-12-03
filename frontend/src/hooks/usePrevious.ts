import {useEffect, useState} from 'react';

/**
 * Get the previous value of a prop or state
 * @param value Current value
 * @returns Previous value
 */
export function usePrevious<T>(value: T): T | undefined {
  const [previous, setPrevious] = useState<T | undefined>(undefined);

  useEffect(() => {
    setPrevious(value);
  }, [value]);

  return previous;
}
