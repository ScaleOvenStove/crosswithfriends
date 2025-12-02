/**
 * Throttle function to limit how often a function can be called
 * @param fn - Function to throttle
 * @param limit - Time limit in milliseconds
 * @param options - Optional configuration
 * @param options.trailing - If true, execute the function after the limit period
 * @returns Throttled function
 */
export const throttle = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number,
  options?: {trailing?: boolean}
): ((...args: Parameters<T>) => void) => {
  let lastRun = 0;
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastRun = now - lastRun;
    if (timeSinceLastRun >= limit) {
      fn(...args);
      lastRun = now;
    } else if (options?.trailing && !timeout) {
      timeout = setTimeout(() => {
        fn(...args);
        lastRun = Date.now();
        timeout = null;
      }, limit - timeSinceLastRun);
    }
  };
};
