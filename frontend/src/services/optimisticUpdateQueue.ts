/**
 * Optimistic Update Queue Service
 * Manages optimistic updates with rollback capability
 */

export interface OptimisticUpdate {
  id: string;
  type: 'cell' | 'clock' | 'cursor';
  timestamp: number;
  originalState: unknown;
  apply: () => void;
  rollback: () => void;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  retryCount?: number;
}

export class OptimisticUpdateQueue {
  private queue: Map<string, OptimisticUpdate> = new Map();
  private maxRetries = 3;
  private retryDelay = 1000; // Start with 1 second

  /**
   * Add an optimistic update to the queue
   */
  add(update: OptimisticUpdate): void {
    this.queue.set(update.id, update);
    // Apply the update immediately
    update.apply();
  }

  /**
   * Confirm an update was successful (remove from queue)
   */
  confirm(updateId: string): void {
    const update = this.queue.get(updateId);
    if (update) {
      update.onSuccess?.();
      this.queue.delete(updateId);
    }
  }

  /**
   * Rollback a failed update
   */
  rollback(updateId: string, error?: Error): void {
    const update = this.queue.get(updateId);
    if (!update) return;

    // Rollback the update
    update.rollback();

    // Call error handler
    if (error) {
      update.onError?.(error);
    }

    // Retry logic
    const retryCount = (update.retryCount || 0) + 1;
    if (retryCount <= this.maxRetries) {
      // Schedule retry with exponential backoff
      const delay = this.retryDelay * Math.pow(2, retryCount - 1);
      setTimeout(() => {
        const retryUpdate = { ...update, retryCount };
        this.add(retryUpdate);
      }, delay);
    } else {
      // Max retries reached, remove from queue
      this.queue.delete(updateId);
    }
  }

  /**
   * Rollback all pending updates (e.g., on connection loss)
   */
  rollbackAll(): void {
    const updates = Array.from(this.queue.values());
    updates.forEach((update) => {
      update.rollback();
      update.onError?.(new Error('Connection lost'));
    });
    this.queue.clear();
  }

  /**
   * Get all pending update IDs
   */
  getPendingIds(): string[] {
    return Array.from(this.queue.keys());
  }

  /**
   * Check if there are pending updates
   */
  hasPending(): boolean {
    return this.queue.size > 0;
  }

  /**
   * Clear all updates
   */
  clear(): void {
    this.queue.clear();
  }
}

// Singleton instance
export const optimisticUpdateQueue = new OptimisticUpdateQueue();
