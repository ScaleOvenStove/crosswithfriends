/**
 * Shared subscription utilities for Zustand stores
 * Eliminates duplicate subscription logic across battleStore, gameStore, and compositionStore
 */

import {logger} from './logger';

interface SubscriptionInstance {
  subscriptions: Map<string, Set<(data: unknown) => void>>;
}

/**
 * Creates standardized subscribe and once methods for store instances
 */
export function createSubscriptionHelpers<TState extends {[path: string]: SubscriptionInstance | undefined}>(
  getState: () => TState,
  getInstanceKey: (path: string) => keyof TState = (path) => path as keyof TState
) {
  /**
   * Emit an event to all subscribers
   */
  const emit = (path: string, event: string, data: unknown): void => {
    const state = getState();
    const instance = state[getInstanceKey(path)];
    if (!instance) return;

    const subscribers = instance.subscriptions.get(event);
    if (subscribers) {
      subscribers.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          logger.errorWithException(`Error in subscription callback for ${event}`, error, {path});
        }
      });
    }
  };

  /**
   * Subscribe to an event
   */
  const subscribe = (path: string, event: string, callback: (data: unknown) => void): (() => void) => {
    const state = getState();
    const instance = state[getInstanceKey(path)];
    if (!instance) return () => {};

    // Get or create subscription set for this event
    if (!instance.subscriptions.has(event)) {
      instance.subscriptions.set(event, new Set());
    }
    const subscribers = instance.subscriptions.get(event)!;

    // Add callback to subscribers
    subscribers.add(callback);

    // Return unsubscribe function
    return () => {
      const currentState = getState();
      const currentInstance = currentState[getInstanceKey(path)];
      if (!currentInstance) return;

      const currentSubscribers = currentInstance.subscriptions.get(event);
      if (currentSubscribers) {
        currentSubscribers.delete(callback);
        // Clean up empty sets
        if (currentSubscribers.size === 0) {
          currentInstance.subscriptions.delete(event);
        }
      }
    };
  };

  /**
   * Subscribe once - automatically unsubscribes after first call
   */
  const once = (path: string, event: string, callback: (data: unknown) => void): (() => void) => {
    const state = getState();
    const instance = state[getInstanceKey(path)];
    if (!instance) return () => {};

    // Wrap callback to auto-unsubscribe after first call
    let called = false;
    const wrappedCallback = (data: unknown) => {
      if (!called) {
        called = true;
        callback(data);
        // Auto-unsubscribe
        const currentState = getState();
        const currentInstance = currentState[getInstanceKey(path)];
        if (currentInstance) {
          const subscribers = currentInstance.subscriptions.get(event);
          if (subscribers) {
            subscribers.delete(wrappedCallback);
            if (subscribers.size === 0) {
              currentInstance.subscriptions.delete(event);
            }
          }
        }
      }
    };

    // Get or create subscription set for this event
    if (!instance.subscriptions.has(event)) {
      instance.subscriptions.set(event, new Set());
    }
    const subscribers = instance.subscriptions.get(event)!;
    subscribers.add(wrappedCallback);

    // Return unsubscribe function
    return () => {
      const currentState = getState();
      const currentInstance = currentState[getInstanceKey(path)];
      if (!currentInstance) return;

      const currentSubscribers = currentInstance.subscriptions.get(event);
      if (currentSubscribers) {
        currentSubscribers.delete(wrappedCallback);
        if (currentSubscribers.size === 0) {
          currentInstance.subscriptions.delete(event);
        }
      }
    };
  };

  return {emit, subscribe, once};
}
