/**
 * Generic hook for managing store subscriptions
 * Consolidates subscription setup/teardown logic across all store hooks
 */

import {useEffect} from 'react';

interface StoreWithSubscribe {
  subscribe: (path: string, event: string, callback: (data: unknown) => void) => () => void;
}

/**
 * Generic hook for managing store subscriptions
 * @param store - Store instance with a subscribe method
 * @param path - Path to the store instance
 * @param subscriptions - Map of event names to callback functions (undefined values are ignored)
 */
export function useStoreSubscriptions(
  store: StoreWithSubscribe,
  path: string,
  subscriptions: Partial<Record<string, (data: unknown) => void>>
): void {
  useEffect(() => {
    const unsubscribes = Object.entries(subscriptions)
      .filter(([_, callback]) => callback !== undefined)
      .map(([event, callback]) => store.subscribe(path, event, callback!));

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [store, path, ...Object.values(subscriptions)]);
}

