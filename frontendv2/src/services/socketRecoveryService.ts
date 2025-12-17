/**
 * Socket Recovery Service
 * Handles socket reconnection and state synchronization
 */

import type { Socket } from 'socket.io-client';

export interface RecoveryState {
  isReconnecting: boolean;
  reconnectAttempts: number;
  lastSyncTime: number | null;
  pendingEvents: Array<{ event: string; data: unknown; timestamp: number }>;
}

export class SocketRecoveryService {
  private state: RecoveryState = {
    isReconnecting: false,
    reconnectAttempts: 0,
    lastSyncTime: null,
    pendingEvents: [],
  };

  private maxReconnectAttempts = 10;
  private syncCallback: ((gameId: string) => Promise<void>) | null = null;
  private onConnectionChange: ((connected: boolean) => void) | null = null;

  /**
   * Set callback for syncing game state after reconnection
   */
  setSyncCallback(callback: (gameId: string) => Promise<void>): void {
    this.syncCallback = callback;
  }

  /**
   * Set callback for connection status changes
   */
  setConnectionChangeCallback(callback: (connected: boolean) => void): void {
    this.onConnectionChange = callback;
  }

  /**
   * Handle socket disconnection
   */
  handleDisconnect(reason: string): void {
    console.warn('[SocketRecovery] Disconnected:', reason);
    this.state.isReconnecting = true;
    this.onConnectionChange?.(false);
  }

  /**
   * Handle socket reconnection
   */
  async handleReconnect(socket: Socket, gameId: string | null): Promise<void> {
    console.log('[SocketRecovery] Reconnected, syncing state...');
    this.state.isReconnecting = false;
    this.state.reconnectAttempts = 0;
    this.onConnectionChange?.(true);

    if (gameId && this.syncCallback) {
      try {
        await this.syncCallback(gameId);
        this.state.lastSyncTime = Date.now();
        console.log('[SocketRecovery] State synced successfully');
      } catch (error) {
        console.error('[SocketRecovery] Failed to sync state:', error);
      }
    }

    // Replay pending events
    await this.replayPendingEvents(socket);
  }

  /**
   * Handle reconnection attempt
   */
  handleReconnectAttempt(attempt: number): void {
    this.state.reconnectAttempts = attempt;
    console.log(`[SocketRecovery] Reconnection attempt ${attempt}/${this.maxReconnectAttempts}`);
  }

  /**
   * Handle reconnection failure
   */
  handleReconnectFailed(): void {
    console.error('[SocketRecovery] Reconnection failed after all attempts');
    this.state.isReconnecting = false;
    this.onConnectionChange?.(false);
  }

  /**
   * Queue an event that failed to send
   */
  queueEvent(event: string, data: unknown): void {
    this.state.pendingEvents.push({
      event,
      data,
      timestamp: Date.now(),
    });
    console.log(
      '[SocketRecovery] Queued event:',
      event,
      this.state.pendingEvents.length,
      'pending'
    );
  }

  /**
   * Replay pending events after reconnection
   */
  private async replayPendingEvents(socket: Socket): Promise<void> {
    if (this.state.pendingEvents.length === 0) return;

    console.log('[SocketRecovery] Replaying', this.state.pendingEvents.length, 'pending events');

    // Sort by timestamp to maintain order
    const sortedEvents = [...this.state.pendingEvents].sort((a, b) => a.timestamp - b.timestamp);

    // Replay events
    for (const { event, data } of sortedEvents) {
      try {
        socket.emit(event, data);
        console.log('[SocketRecovery] Replayed event:', event);
      } catch (error) {
        console.error('[SocketRecovery] Failed to replay event:', event, error);
      }
    }

    // Clear pending events
    this.state.pendingEvents = [];
  }

  /**
   * Get current recovery state
   */
  getState(): Readonly<RecoveryState> {
    return { ...this.state };
  }

  /**
   * Clear pending events
   */
  clearPendingEvents(): void {
    this.state.pendingEvents = [];
  }
}

// Singleton instance
export const socketRecoveryService = new SocketRecoveryService();
