import {useCallback, useState} from 'react';

/**
 * Toggle a boolean state value
 * @param initialValue Initial boolean value
 * @returns [value, toggle] tuple
 */
export function useToggle(initialValue = false): [boolean, (value?: boolean) => void] {
  const [value, setValue] = useState(initialValue);

  const toggle = useCallback((newValue?: boolean) => {
    if (newValue !== undefined) {
      setValue(newValue);
    } else {
      setValue((prev) => !prev);
    }
  }, []);

  return [value, toggle];
}

