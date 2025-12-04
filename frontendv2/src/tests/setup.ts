/**
 * Vitest Test Setup
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock localStorage with stateful implementation
const createLocalStorageMock = () => {
  const storage = new Map<string, string>();

  return {
    getItem: (key: string): string | null => {
      return storage.get(key) || null;
    },
    setItem: (key: string, value: string): void => {
      storage.set(key, String(value));
      // Update length property
      Object.defineProperty(localStorageMock, 'length', {
        value: storage.size,
        writable: false,
        configurable: true,
      });
    },
    removeItem: (key: string): void => {
      storage.delete(key);
      // Update length property
      Object.defineProperty(localStorageMock, 'length', {
        value: storage.size,
        writable: false,
        configurable: true,
      });
    },
    clear: (): void => {
      storage.clear();
      // Update length property
      Object.defineProperty(localStorageMock, 'length', {
        value: 0,
        writable: false,
        configurable: true,
      });
    },
    length: 0,
    key: (index: number): string | null => {
      const keys = Array.from(storage.keys());
      return keys[index] || null;
    },
  };
};

const localStorageMock = createLocalStorageMock();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});
