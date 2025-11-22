import {vi} from 'vitest';

// Mock window.requestIdleCallback and cancelIdleCallback if not available
if (typeof window !== 'undefined') {
  if (!window.requestIdleCallback) {
    window.requestIdleCallback = vi.fn((cb) => {
      const start = Date.now();
      return setTimeout(() => {
        cb({
          didTimeout: false,
          timeRemaining() {
            return Math.max(0, 50 - (Date.now() - start));
          },
        });
      }, 1) as unknown as number;
    });
  }

  if (!window.cancelIdleCallback) {
    window.cancelIdleCallback = vi.fn((id) => {
      clearTimeout(id);
    });
  }
}

// Global test utilities
(global as typeof global & {vi: typeof vi}).vi = vi;
