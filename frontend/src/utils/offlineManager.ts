/**
 * Offline Manager
 * Detects online/offline status and manages action queuing
 */

import {logger} from './logger';

export type OnlineStatus = 'online' | 'offline' | 'unknown';

export interface QueuedAction {
  id: string;
  type: string;
  payload: unknown;
  timestamp: number;
  retries: number;
  maxRetries?: number;
}

class OfflineManager {
  private onlineStatus: OnlineStatus =
    typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'unknown';
  private listeners: Set<(status: OnlineStatus) => void> = new Set();
  private queuedActions: QueuedAction[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
      this.onlineStatus = navigator.onLine ? 'online' : 'offline';
    }
  }

  private handleOnline = (): void => {
    logger.info('Network status: online');
    this.onlineStatus = 'online';
    this.notifyListeners();
  };

  private handleOffline = (): void => {
    logger.info('Network status: offline');
    this.onlineStatus = 'offline';
    this.notifyListeners();
  };

  private notifyListeners = (): void => {
    this.listeners.forEach((listener) => listener(this.onlineStatus));
  };

  /**
   * Get current online status
   */
  isOnline(): boolean {
    return this.onlineStatus === 'online';
  }

  /**
   * Get current status
   */
  getStatus(): OnlineStatus {
    return this.onlineStatus;
  }

  /**
   * Subscribe to online/offline status changes
   */
  subscribe(listener: (status: OnlineStatus) => void): () => void {
    this.listeners.add(listener);
    // Immediately call with current status
    listener(this.onlineStatus);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Queue an action to be executed when back online
   */
  queueAction(action: Omit<QueuedAction, 'id' | 'timestamp' | 'retries'>): string {
    const id = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const queuedAction: QueuedAction = {
      ...action,
      id,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: action.maxRetries || 3,
    };
    this.queuedActions.push(queuedAction);
    logger.debug('Action queued', {id, type: action.type, queueLength: this.queuedActions.length});
    return id;
  }

  /**
   * Get all queued actions
   */
  getQueuedActions(): QueuedAction[] {
    return [...this.queuedActions];
  }

  /**
   * Remove a queued action (after successful execution)
   */
  removeQueuedAction(id: string): void {
    const index = this.queuedActions.findIndex((action) => action.id === id);
    if (index !== -1) {
      this.queuedActions.splice(index, 1);
      logger.debug('Action removed from queue', {id, queueLength: this.queuedActions.length});
    }
  }

  /**
   * Increment retry count for an action
   */
  incrementRetry(id: string): void {
    const action = this.queuedActions.find((a) => a.id === id);
    if (action) {
      action.retries += 1;
    }
  }

  /**
   * Clear all queued actions
   */
  clearQueue(): void {
    this.queuedActions = [];
    logger.info('Action queue cleared');
  }

  /**
   * Get queue length
   */
  getQueueLength(): number {
    return this.queuedActions.length;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
    this.listeners.clear();
    this.queuedActions = [];
  }
}

// Singleton instance
export const offlineManager = new OfflineManager();
