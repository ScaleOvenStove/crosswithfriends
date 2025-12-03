import {useEffect, useRef} from 'react';

/**
 * Effect that runs only on updates, not on initial mount
 * @param effect Effect function
 * @param deps Dependency array
 */
export function useUpdateEffect(effect: React.EffectCallback, deps?: React.DependencyList): void {
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    return effect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

