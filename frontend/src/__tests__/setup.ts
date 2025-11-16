/**
 * Vitest global setup file
 * This file is automatically imported before all tests
 */

import '@testing-library/jest-dom';
import {vi, beforeEach} from 'vitest';

// Mock window.matchMedia for MUI components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Mock process.env for libraries that expect it
if (typeof globalThis.process === 'undefined') {
  (globalThis as {process?: {env: Record<string, string>}}).process = {env: {}};
}

// Mock requestIdleCallback and cancelIdleCallback
window.requestIdleCallback =
  window.requestIdleCallback ||
  vi.fn((cb: IdleRequestCallback) => {
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

window.cancelIdleCallback =
  window.cancelIdleCallback ||
  vi.fn((id: number) => {
    clearTimeout(id);
  });

// Reset mocks before each test
beforeEach(() => {
  localStorageMock.clear();
  sessionStorageMock.clear();
});
