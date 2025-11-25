/**
 * Shared TypeScript utility types and helper functions
 */

/**
 * Properly typed debounce function
 */
export type DebouncedFunction<T extends (...args: never[]) => unknown> = {
  (...args: Parameters<T>): void;
  cancel: () => void;
};

export function debounce<T extends (...args: never[]) => unknown>(
  fn: T,
  delay: number = 0
): DebouncedFunction<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };

  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

/**
 * Properly typed throttle function
 */
export type ThrottledFunction<T extends (...args: never[]) => unknown> = {
  (...args: Parameters<T>): void;
  cancel: () => void;
};

export function throttle<T extends (...args: never[]) => unknown>(
  fn: T,
  limit: number
): ThrottledFunction<T> {
  let lastRan: number | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const throttled = (...args: Parameters<T>) => {
    const now = Date.now();

    if (lastRan === null || now - lastRan >= limit) {
      fn(...args);
      lastRan = now;
    } else {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(
        () => {
          fn(...args);
          lastRan = Date.now();
          timeoutId = null;
        },
        limit - (now - lastRan)
      );
    }
  };

  throttled.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return throttled;
}

/**
 * Type guard to check if a value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard for Error objects
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Extract error message safely from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

/**
 * Type-safe Object.keys
 */
export function keys<T extends object>(obj: T): Array<keyof T> {
  return Object.keys(obj) as Array<keyof T>;
}

/**
 * Type-safe Object.entries
 */
export function entries<T extends object>(obj: T): Array<[keyof T, T[keyof T]]> {
  return Object.entries(obj) as Array<[keyof T, T[keyof T]]>;
}

/**
 * Utility type for making certain properties required
 */
export type RequireProps<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Utility type for making certain properties optional
 */
export type PartialProps<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
